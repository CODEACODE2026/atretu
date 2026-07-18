import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/admin/finance-panel.tsx", "utf8");

const refDeclarations = source.match(/const issueBankSlipInFlightRef = useRef\(""\);/g) ?? [];
assert.equal(
  refDeclarations.length,
  2,
  "Finance issue flows must each have a synchronous in-flight ref",
);

const guardedHandlers = source.match(
  /async function handleIssueBankSlip\(invoice: InvoiceRecord\) \{[\s\S]*?if \(issueBankSlipInFlightRef\.current\) \{[\s\S]*?return;[\s\S]*?issueBankSlipInFlightRef\.current = invoice\.id;[\s\S]*?window\.confirm[\s\S]*?api\.issueInvoiceBankSlip\(invoice\.id\)[\s\S]*?finally \{[\s\S]*?issueBankSlipInFlightRef\.current = "";[\s\S]*?\n  \}/g,
) ?? [];

assert.equal(
  guardedHandlers.length,
  2,
  "Finance issue handlers must guard before confirm/fetch and release in finally",
);

assert.match(
  source,
  /\{busy \? "Emitindo\.\.\." : issueBankSlipButtonLabel\(bankSlip\)\}/,
  "Issue button must show a busy indicator while disabled",
);

assert.match(
  source,
  /bankSlip\?\.status === "CANCELLED" \? "Emitir novo boleto" : "Emitir boleto"/,
  "Issue button must label reissue after external cancellation",
);

assert.match(
  source,
  /const issueBatchInFlightRef = useRef\(false\);/,
  "Batch issue flow must have a synchronous in-flight ref",
);

assert.match(
  source,
  /api\.createBankSlipIssueBatch\(selectedInvoiceIds\)/,
  "Finance panel must create issue batches from selected invoices",
);

assert.match(
  source,
  /setMessage\("Lote institucional de emissao criado"\);[\s\S]*?setIssueBatch\(batch\);[\s\S]*?refreshIssueBatch\(batch\.id\);[\s\S]*?loadInvoices\(\)/,
  "Institutional issue flow must record success and refresh the invoice list after creation",
);

assert.match(
  source,
  /item\.invoiceId \? item\.invoiceId\.slice\(0, 8\) : "Sem fatura"/,
  "Batch item rendering must handle skipped items without invoiceId",
);

assert.match(
  source,
  /formatDate\(issueBatch\.dueDate\)/,
  "Batch dueDate rendering must go through the defensive formatter",
);

assert.match(
  source,
  /Emitir selecionadas/,
  "Finance panel must expose the batch issue action",
);

console.log("Finance bank slip issue guard OK");
