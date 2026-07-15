import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve("src/app/admin/finance-panel.tsx"),
  "utf8",
);

assertIncludes("bankSlipSummary", "Finance views must consume bankSlipSummary");
assertIncludes("mergeBankSlipSummaries(response.data", "Invoice lists must hydrate bank slip summaries from the list response");
assertIncludes('UNKNOWN: "Situacao incerta"', "UNKNOWN BankSlip status must remain visible as Situacao incerta");
assertIncludes("api.getInvoiceBankSlip(invoice.id)", "Full BankSlip detail must stay available on demand");

const loadInvoicesBlocks = source.match(/async function loadInvoices\([^]*?\n  \}/g) ?? [];
assert(
  loadInvoicesBlocks.length >= 2,
  "FinancePanel and StudentInvoicesForStudent must both have list loaders",
);
for (const block of loadInvoicesBlocks) {
  assert(
    !block.includes("api.getInvoiceBankSlip"),
    "Invoice list loaders must not call the individual BankSlip endpoint per row",
  );
  assert(
    block.includes("mergeBankSlipSummaries(response.data"),
    "Invoice list loaders must use bankSlipSummary from the list response",
  );
}

const detailLoadBlocks = source.match(/async function loadFullBankSlip\([^]*?\n  \}/g) ?? [];
assert(
  detailLoadBlocks.length >= 2,
  "General finance panel and student invoice view must load full BankSlip details only on demand",
);
for (const block of detailLoadBlocks) {
  assert(
    block.includes("api.getInvoiceBankSlip(invoice.id)"),
    "Full BankSlip details must be fetched only by the explicit detail loader",
  );
}

const individualEndpointCalls = countOccurrences(source, "api.getInvoiceBankSlip(invoice.id)");
assert(
  individualEndpointCalls === detailLoadBlocks.length,
  "Individual BankSlip endpoint calls must be limited to detail loaders",
);

function assertIncludes(fragment, message) {
  assert(source.includes(fragment), message);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countOccurrences(text, fragment) {
  return text.split(fragment).length - 1;
}
