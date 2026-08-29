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
const movementDialog = sourceBetween(panel, "function MovementDialog(", "function StudentPicker(");
const studentPicker = sourceBetween(panel, "function StudentPicker(", "function MovementDetails(");
const manualMovementPayload = sourceBetween(
  api,
  "export type ManualFinancialMovementPayload = {",
  "};",
  true,
);
const manualMovementResponse = sourceBetween(
  api,
  "export type ManualFinancialMovement = {",
  "};",
  true,
);

includesAll(financePanel, [
  "ManualMovementsPanel",
  'financeArea === "movements"',
  'hasCapability(user, "manualMovements.manage")',
  "canManageManualMovements",
  "canManage={canManageManualMovements}",
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
  "Acadêmico opcional",
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
assert.doesNotMatch(
  panel,
  /Acadêmico obrigatório para usuário operacional\./,
  "Operational manual movement form must not require an academic anymore",
);
assert.doesNotMatch(
  panel,
  /Instituição|institutionId|defaultInstitutionId|InstitutionSelect|Selecione a instituição/,
  "Manual movement UI must not expose institution ownership controls",
);
assert.doesNotMatch(
  movementDialog,
  /<select\b[^>]*\brequired\b/,
  "Manual movement modal must not contain a native required select",
);
assert.doesNotMatch(
  movementDialog,
  /Instituição|institutionId|selectedInstitution|institutionOptions|requiresInstitution|Selecione a instituição/,
  "Manual movement modal must not render or validate institution fields",
);
assert.doesNotMatch(
  manualMovementPayload,
  /institutionId/,
  "Manual movement payload type must not expose institutionId",
);
assert.doesNotMatch(
  manualMovementResponse,
  /institutionId|institution\?:/,
  "Manual movement response type must not expose institution data",
);
assert.match(
  panel,
  /studentId:\s+movementType === "INCOME" \? student\?\.id : undefined/,
  "Manual movement expenses must not require or submit an academic by default",
);
assert.match(
  movementDialog,
  /movementType === "INCOME" \? \(/,
  "Manual movement expenses must hide the student picker",
);
assert.match(
  movementDialog,
  /movementType === "INCOME" \? \([\s\S]*<StudentPicker[\s\S]*\) : null/,
  "Manual movement income form must render the optional student picker",
);
assert.match(
  studentPicker,
  /api\.listManualMovementStudentOptions\(\{[\s\S]*search: query\.trim\(\),[\s\S]*limit: 10/,
  "Manual movement student picker must use the finance lookup without institution filter",
);
assert.doesNotMatch(
  studentPicker,
  /institutionId|selectedInstitution|institutionOptions|requiresInstitution/,
  "Manual movement student lookup must not depend on institution state",
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

function sourceBetween(source, start, end, includeEnd = false) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected source to include ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Expected source after ${start} to include ${end}`);
  return source.slice(startIndex, includeEnd ? endIndex + end.length : endIndex);
}
