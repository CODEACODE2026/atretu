import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(
  "src/app/admin/finance/manual-movements-panel.tsx",
  "utf8",
);
const money = readFileSync(
  "src/app/admin/finance/manual-movement-money.ts",
  "utf8",
);
const financePanel = readFileSync("src/app/admin/finance-panel.tsx", "utf8");
const financeNavigation = readFileSync(
  "src/app/admin/finance/finance-navigation.tsx",
  "utf8",
);
const api = readFileSync("src/lib/api.ts", "utf8");
const profileUtils = readFileSync(
  "src/app/admin/students/student-profile-utils.ts",
  "utf8",
);

includesAll(financePanel, [
  "ManualMovementsPanel",
  'financeArea === "movements"',
  'hasCapability(user, "manualMovements.manage")',
  "canManageManualMovements",
  "requiresManualMovementStudent",
  "canManage={canManageManualMovements}",
  "requiresStudent={requiresManualMovementStudent}",
]);
includesAll(financeNavigation, ["Movimentações", "Entradas e despesas manuais"]);

includesAll(api, [
  "export type ManualFinancialMovement",
  "export type ManualFinancialMovementPayload",
  "export type ManualFinancialMovementSummary",
  "listManualFinancialMovements",
  "listManualMovementStudentOptions",
  "createManualFinancialMovement",
  "updateManualFinancialMovement",
  "markManualFinancialMovementPaid",
  "cancelManualFinancialMovement",
  "attachManualFinancialMovementDocument",
  "viewManualFinancialMovementAttachment",
  "downloadManualFinancialMovementAttachment",
  "/finance/manual-movements",
  "/finance/manual-movements/student-options",
  "manualFinancialMovementFormData",
]);

includesAll(panel, [
  "Nova entrada",
  "Nova despesa",
  "pageError",
  "formError",
  "validationError",
  "SECOND_CARD_COPY",
  "XEROX",
  "ADMINISTRATIVE_FEE",
  "EXTRA_CONTRIBUTION",
  "DONATION",
  "FUEL",
  "MAINTENANCE",
  "ACCOUNTING",
  "OFFICE_SUPPLIES",
  "SERVICES",
  "TAXES",
  "PURCHASES",
  "Competência",
  "type=\"month\"",
  "`${competenceDate}-01`",
  "parseMoneyToCents",
  "onBlur={() => setAmount(formatMoneyInput(amount))}",
  "setValidationError(\"\")",
  "mapApiErrorMessage(visibleError)",
  "PDF, PNG, JPEG ou WebP",
  "requiresStudent",
  "Acadêmico obrigatório",
  "Acadêmico obrigatório para usuário operacional.",
  'studentId:',
  "Marcar paga",
  "Cancelar",
  'value="INCOME"',
  'value="EXPENSE"',
  'value="PENDING"',
  'value="RECEIVED"',
  'value="PAID"',
  'value="CANCELLED"',
  "studentFilterId",
]);

includesAll(money, [
  "formatMoneyInput",
  "parseMoneyToCents",
  "centsToInput",
  "style: \"currency\"",
  "currency: \"BRL\"",
  "Informe um valor maior que zero.",
  "Informe um valor valido, como 25,00.",
  "Number.parseInt(reais, 10) * 100",
]);

for (const forbidden of ["window.alert", "setError(caught instanceof Error ? caught.message : \"Erro ao salvar movimentação\")"]) {
  assert.equal(panel.includes(forbidden), false, `Manual movement modal must not use ${forbidden}`);
}

assert.match(
  financePanel,
  /const canManageManualMovements =\s+canManageFinance \|\| hasCapability\(user, "manualMovements\.manage"\);/,
  "Manual movements manage must be gated by manualMovements.manage",
);
assert.doesNotMatch(
  financePanel,
  /canManageManualMovements =\s+canManageFinance \|\| hasCapability\(user, "finance\.bankSlips\.manage"\);/,
  "Manual movements manage must not depend on bank slip management",
);
assert.equal(
  financePanel.includes("canManage={canManageFinance}"),
  false,
  "Manual movements actions must be gated by manualMovements.manage, not broad finance management only",
);
assert.match(
  financePanel,
  /const requiresManualMovementStudent =\s+user\.roles\.includes\("USER"\) && canManageManualMovements;/,
  "USER manual movements must require a student scope in the form",
);
assert.match(
  panel,
  /if \(requiresStudent && !student\?\.id\) \{[\s\S]*Acadêmico obrigatório para usuário operacional\./,
  "USER manual movement submit must require a selected student",
);
assert.match(
  panel,
  /studentId:\s+requiresStudent \|\| movementType === "INCOME" \? student\?\.id : undefined/,
  "USER manual movement expenses must submit studentId instead of becoming global movements",
);
assert.match(
  panel,
  /movementType === "INCOME" \|\| requiresStudent/,
  "USER manual movement expenses must expose the student picker",
);
assert.match(
  panel,
  /api\.listManualMovementStudentOptions\(\{[\s\S]*search: query\.trim\(\),[\s\S]*limit: 10/,
  "Manual movement student picker must use the scoped finance lookup",
);
assert.doesNotMatch(
  panel,
  /api\.getStudent\(studentId\)/,
  "Manual movement student picker must not fetch full student details",
);
assert.match(
  panel,
  /canManage \? \([\s\S]*Nova entrada[\s\S]*Nova despesa/,
  "Manage users must see manual movement creation actions",
);
assert.match(
  panel,
  /canManage \? \([\s\S]*Editar[\s\S]*Marcar paga[\s\S]*Cancelar/,
  "Manage users must see manual movement row actions",
);

includesAll(profileUtils, [
  "MANUAL_FINANCIAL_INCOME_RECORDED",
  "Entrada financeira",
]);

console.log("Finance manual movements frontend guard OK");

function includesAll(source, values) {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
}
