import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/admin/finance-panel.tsx", "utf8");
const apiSource = readFileSync("src/lib/api.ts", "utf8");
const invoiceBulkActionSource = readFileSync(
  "src/app/admin/finance/invoice-bulk-action-bar.tsx",
  "utf8",
);

const refDeclarations = source.match(/const issueBankSlipInFlightRef = useRef\(""\);/g) ?? [];
assert.equal(
  refDeclarations.length,
  2,
  "Finance issue flows must each have a synchronous in-flight ref",
);

const guardedHandlers = source.match(
  /async function handleIssueBankSlip\(invoice: InvoiceRecord\) \{[\s\S]*?if \(issueBankSlipInFlightRef\.current\) \{[\s\S]*?return;[\s\S]*?issueBankSlipInFlightRef\.current = invoice\.id;[\s\S]*?api\.issueInvoiceBankSlip\(invoice\.id\)[\s\S]*?finally \{[\s\S]*?issueBankSlipInFlightRef\.current = "";[\s\S]*?\n  \}/g,
) ?? [];

assert.equal(
  guardedHandlers.length,
  2,
  "Finance issue handlers must guard before fetch and release in finally",
);

assert.match(
  apiSource,
  /export class ApiRequestError extends Error \{[\s\S]*?readonly code\?: string[\s\S]*?throw new ApiRequestError\(formatApiErrorBody\(body\), response\.status, body\?\.code\)/,
  "API request errors must expose backend error codes to UI handlers",
);

assert.match(
  source,
  /const invoiceStatusIssueErrorCodes = new Set\(\[[\s\S]*?"INVOICE_ALREADY_PAID"[\s\S]*?"INVOICE_CANCELLED"[\s\S]*?"INVOICE_NOT_OPEN"[\s\S]*?\]\);/,
  "Finance panel must recognize invoice status issue error codes",
);

assert.match(
  source,
  /function shouldReloadInvoicesAfterIssueError\(caught: unknown\) \{[\s\S]*?caught instanceof ApiRequestError[\s\S]*?invoiceStatusIssueErrorCodes\.has\(caught\.code\)/,
  "Invoice status issue errors must be detected by backend code, not message text",
);

assert.match(
  source,
  /showBankSlipResult\("Emissão não confirmada", messageText, "danger"\);[\s\S]*?if \(shouldReloadInvoicesAfterIssueError\(caught\)\) \{[\s\S]*?await loadInvoices\(\);[\s\S]*?\} else \{[\s\S]*?await loadFullBankSlip\(invoice\);[\s\S]*?\}/,
  "Institutional invoice issue failures caused by invoice status must reload the list",
);

assert.match(
  source,
  /if \(shouldReloadInvoicesAfterIssueError\(caught\)\) \{[\s\S]*?await loadInvoices\(\);[\s\S]*?await onChanged\(\);[\s\S]*?\}/,
  "Student invoice issue failures caused by invoice status must reload the list",
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
  /setMessage\("Lote criado\. Emitindo boletos\.\.\."\);[\s\S]*?setIssueBatch\(batch\);[\s\S]*?refreshIssueBatch\(batch\.id\);[\s\S]*?loadInvoices\(\)/,
  "Institutional issue flow must record immediate processing status and refresh the invoice list after creation",
);

assert.match(
  source,
  /Boolean\(issueBatch && isIssueBatchRunning\(issueBatch\)\)/,
  "Institutional issue button must stay disabled while the batch is processing",
);

assert.match(
  source,
  /setMessage\(issueBatchCompletionMessage\(batch\)\)/,
  "Polling must publish a completion summary when the batch finishes",
);

assert.match(
  source,
  /IssueBatchProgressPanel/,
  "Finance panel must render a batch progress panel while polling",
);

assert.match(
  source,
  /batchProgress\(batch\)/,
  "Batch progress panel must use the frontend processed-items progress helper",
);

assert.match(
  source,
  /progress\.processedItems[\s\S]*?progress\.totalItems[\s\S]*?progress\.percent/,
  "Batch progress panel must show processed and total item counts",
);

assert.match(
  source,
  /latestIssueBatchEvents\(issueBatchItems\)/,
  "Batch progress panel must show the latest processed item events",
);

assert.match(
  source,
  /formatDuration\(elapsedMs\)/,
  "Batch progress panel must show elapsed time",
);

assert.match(
  source,
  /Ver detalhes do lote/,
  "Finished batch progress panel must expose a view details action",
);

assert.match(
  source,
  /Emissao concluida: \$\{batch\.issuedItems\} boleto\(s\) emitido\(s\), \$\{errors\} erro\(s\), \$\{batch\.skippedItems\} bloqueado\(s\)\./,
  "Completion summary must include issued, error, and blocked counts",
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
  `${source}\n${invoiceBulkActionSource}`,
  /Emitir selecionadas/,
  "Finance panel must expose the batch issue action",
);

console.log("Finance bank slip issue guard OK");
