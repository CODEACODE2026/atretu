import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compactRow = readFileSync(
  "src/app/admin/finance/invoice-compact-row.tsx",
  "utf8",
);
const invoiceCard = readFileSync(
  "src/app/admin/finance/invoice-card.tsx",
  "utf8",
);
const financePanel = readFileSync("src/app/admin/finance-panel.tsx", "utf8");

for (const fragment of [
  "export function InvoiceCompactRow",
  "Acadêmico",
  "Valor",
  "Vencimento",
  "Competência",
  "Boleto",
  "Ver detalhes",
  "Ocultar detalhes",
  "InvoiceStatusBadge",
  "BankSlipStatusBadge",
  "invoiceOperationalTone",
  "bankSlipDisplayNumber",
]) {
  assert.ok(compactRow.includes(fragment), `Compact invoice row must include ${fragment}`);
}

for (const [source, message] of [
  [invoiceCard, "Finance invoice list must use the shared compact row"],
  [financePanel, "Student profile invoice list must use the shared compact row"],
]) {
  assert.ok(source.includes("InvoiceCompactRow"), message);
}

assert.ok(
  invoiceCard.includes("expandedActions={") &&
    invoiceCard.includes("Mais ações") &&
    invoiceCard.includes("expandedChildren={<InvoiceDetails"),
  "Finance invoice actions must stay behind the expanded detail area",
);

const studentInvoiceCard = sourceBetween(
  financePanel,
  "function StudentInvoiceCard",
  "function StudentInvoiceField",
);
assert.ok(
  studentInvoiceCard.includes("showStudent={false}"),
  "Student profile invoice cards must not repeat the current student's name",
);
assert.equal(
  studentInvoiceCard.includes("invoice.student.person.fullName"),
  false,
  "Student profile invoice card must avoid rendering the student name directly",
);
assert.ok(
  studentInvoiceCard.includes("expandedChildren={<InvoiceDetails"),
  "Student profile invoice cards must reuse the same invoice details component",
);
assert.ok(
  compactRow.includes("showStudent ?") && compactRow.includes(": null"),
  "Shared compact row must hide the context column on the student profile",
);

const legacyHistorySection = sourceBetween(
  financePanel,
  "<LegacyFinancialHistorySection",
  "function LegacyFinancialHistorySection",
);
assert.ok(
  legacyHistorySection.includes("expandedRecordId={expandedLegacyFinancialId}"),
  "Legacy financial history must remain independent below student invoices",
);

console.log("Invoice compact row guard OK");

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not locate source section ${start} -> ${end}`);
  }
  return source.slice(startIndex, endIndex);
}
