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
]);
includesAll(financeNavigation, ["Movimentações", "Entradas e despesas manuais"]);

includesAll(api, [
  "export type ManualFinancialMovement",
  "export type ManualFinancialMovementPayload",
  "export type ManualFinancialMovementSummary",
  "listManualFinancialMovements",
  "createManualFinancialMovement",
  "updateManualFinancialMovement",
  "markManualFinancialMovementPaid",
  "cancelManualFinancialMovement",
  "attachManualFinancialMovementDocument",
  "viewManualFinancialMovementAttachment",
  "downloadManualFinancialMovementAttachment",
  "/finance/manual-movements",
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
  "Marcar paga",
  "Cancelar",
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
