import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const service = readFileSync(new URL("./manual-movements.service.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("./manual-movements.controller.ts", import.meta.url), "utf8");
const dto = readFileSync(new URL("./dto/manual-movements.dto.ts", import.meta.url), "utf8");

assert.match(schema, /model ManualFinancialMovement \{/);
assert.match(schema, /type\s+ManualFinancialMovementType/);
assert.match(schema, /status\s+ManualFinancialMovementStatus/);
assert.match(schema, /amountCents\s+Int\s+@map\("amount_cents"\)/);
assert.match(schema, /transactionDate\s+DateTime\s+@map\("transaction_date"\) @db\.Date/);
assert.match(schema, /competenceDate\s+DateTime\?\s+@map\("competence_date"\) @db\.Date/);
assert.doesNotMatch(schema, /competence\s+String.*manual/i);
assert.match(schema, /model ManualFinancialMovementAttachment \{/);
assert.match(schema, /storageKey\s+String\s+@unique/);
assert.match(schema, /manualFinancialMovementId\s+String\?/);
assert.match(schema, /MANUAL_FINANCIAL_INCOME_RECORDED/);

assert.match(controller, /@Controller\("finance\/manual-movements"\)/);
assert.match(controller, /@Roles\(RoleCode\.SUPER_ADMIN, RoleCode\.SECRETARIA\)/);
assert.match(controller, /FileInterceptor\("file", singleDocumentUploadOptions\)/);
assert.match(controller, /mark-paid/);
assert.match(controller, /attachments\/:attachmentId\/download/);
assert.match(controller, /attachments\/:attachmentId\/view/);

assert.match(dto, /ManualFinancialMovementCategory/);
assert.match(dto, /competenceDate/);
assert.match(dto, /@Max\(MAX_INVOICE_AMOUNT_CENTS\)/);
assert.match(dto, /page = 1/);
assert.match(dto, /limit = 20/);

assert.match(service, /ManualFinancialMovementType\.INCOME[\s\S]*ManualFinancialMovementStatus\.RECEIVED/);
assert.match(service, /ManualFinancialMovementType\.EXPENSE[\s\S]*ManualFinancialMovementStatus\.PENDING/);
assert.match(service, /StudentHistoryEventType\.MANUAL_FINANCIAL_INCOME_RECORDED/);
assert.match(service, /formatInvoiceAmount\(movement\.amountCents\)/);
assert.match(service, /DocumentStorageService/);
assert.match(service, /image\/webp/);
assert.match(service, /WEBP/);
assert.match(service, /Assinatura do arquivo invalida/);
assert.match(service, /storage\.write/);
assert.doesNotMatch(service, /base64/i);
assert.match(service, /MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_UPLOADED/);
assert.match(service, /REPLACED/);
assert.match(service, /resolvePagination/);
assert.match(service, /incomeReceivedCents[\s\S]*expensePaidCents[\s\S]*netCents/);

console.log("Manual financial movements backend guard OK");
