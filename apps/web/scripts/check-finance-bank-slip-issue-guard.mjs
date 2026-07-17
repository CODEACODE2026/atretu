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

console.log("Finance bank slip issue guard OK");
