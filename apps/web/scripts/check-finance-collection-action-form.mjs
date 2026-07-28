import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("src/lib/api.ts", "utf8");
const panel = readFileSync("src/app/admin/collections-panel.tsx", "utf8");
const detail = readFileSync(
  "src/app/admin/finance/collections/collection-details.tsx",
  "utf8",
);
const rootForm = readFileSync("src/app/admin/collection-action-form.tsx", "utf8");
const form = readFileSync(
  "src/app/admin/finance/collections/collection-action-form.tsx",
  "utf8",
);
const fields = readFileSync(
  "src/app/admin/finance/collections/collection-action-fields.tsx",
  "utf8",
);
const selector = readFileSync(
  "src/app/admin/finance/collections/collection-action-type-selector.tsx",
  "utf8",
);
const feedback = readFileSync(
  "src/app/admin/finance/collections/collection-action-feedback.tsx",
  "utf8",
);
const actionUtils = readFileSync(
  "src/app/admin/finance/collections/collection-action-display-utils.ts",
  "utf8",
);
const formatters = readFileSync("src/app/admin/collection-formatters.ts", "utf8");
const validation = readFileSync(
  "src/app/admin/collection-action-validation.ts",
  "utf8",
);

const bodyType = api.slice(
  api.indexOf("export type CreateCollectionActionBody"),
  api.indexOf("export type CollectionCase"),
);

for (const value of [
  "export type CreateCollectionActionBody",
  "actionType: CollectionActionType",
  "channel?: CollectionChannel",
  "contactedName?: string",
  "contactedDocumentMasked?: string",
  "note: string",
  "promisedAmountCents?: number",
  "promiseDueDate?: string",
  "nextFollowUpAt?: string",
  "createCollectionAction(invoiceId: string, body: CreateCollectionActionBody)",
  "/finance/collections/cases/${invoiceId}/actions",
  'method: "POST"',
]) {
  assert.ok(api.includes(value), `Expected API client to include ${value}`);
}

for (const forbidden of [
  "source",
  "createdByUserId",
  "createdAt",
  "invoiceStatus",
  "bankSlipStatus",
]) {
  assert.equal(
    bodyType.includes(forbidden),
    false,
    `CreateCollectionActionBody must not expose ${forbidden}`,
  );
}

assert.ok(
  rootForm.includes("export { CollectionActionForm }"),
  "Root action form must remain a compatibility export",
);

for (const value of [
  "CollectionActionForm",
  "api.createCollectionAction",
  "caseDetail.invoiceId",
  "validation.body",
  "submitting",
  "submittingRef",
  "setSubmitting(true)",
  "disabled={submitting}",
  "emptyCollectionActionForm",
  "readError(caught",
  "CollectionActionFeedback",
  "CollectionActionTypeSelector",
  "CollectionActionFields",
]) {
  assert.ok(form.includes(value), `Expected form to include ${value}`);
}

for (const value of [
  "collectionActionShowsChannel",
  "collectionActionShowsContact",
  "collectionActionShowsPromise",
  "collectionActionShowsFollowUp",
  "promisedAmountReais",
  "promiseDueDate",
  "nextFollowUpAt",
  "contactedDocumentMasked",
]) {
  assert.ok(fields.includes(value), `Expected action fields to include ${value}`);
}

for (const value of [
  "collectionActionTypes",
  "collectionActionTypeLabel",
  "collectionActionHelp",
]) {
  assert.ok(selector.includes(value), `Expected selector to include ${value}`);
}

for (const value of ["AlertCircle", "CheckCircle2"]) {
  assert.ok(feedback.includes(value), `Expected feedback to include ${value}`);
}

for (const value of [
  "CONTACT_ATTEMPT",
  "CONTACT_MADE",
  "PROMISE_TO_PAY",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW_NOTE",
  "INTERNAL_NOTE",
]) {
  assert.ok(formatters.includes(value), `Expected formatter to include ${value}`);
  assert.ok(actionUtils.includes(value), `Expected action utils to include ${value}`);
}

for (const value of [
  "collectionActionShowsChannel",
  "collectionActionShowsContact",
  "collectionActionShowsPromise",
  "collectionActionShowsFollowUp",
  "collectionActionHelp",
]) {
  assert.ok(actionUtils.includes(value), `Expected action utils to include ${value}`);
}

for (const value of [
  "validateCollectionActionForm",
  "parseMoneyToCents",
  "Number.parseInt(reais, 10) * 100",
  "actionType === \"PROMISE_TO_PAY\"",
  "actionType === \"FOLLOW_UP_SCHEDULED\"",
  "contactActionTypes.includes(actionType)",
  "looksLikeFullDocument",
  "toISOString()",
  "promiseDueDate",
  "nextFollowUpAt",
  "promisedAmountCents",
]) {
  assert.ok(validation.includes(value), `Expected validation to include ${value}`);
}

for (const value of [
  "CollectionDetails",
  "showActionForm",
  "handleActionCreated",
  "refreshDetail()",
  "onCollectionsChanged()",
  "canRegisterActions",
]) {
  assert.ok(panel.includes(value), `Expected panel integration to include ${value}`);
}

for (const value of [
  "CollectionActionForm",
  "showActionForm",
  "onActionCreated",
  "caseDetail.invoiceStatus === \"PAID\"",
  "caseDetail.invoiceStatus === \"CANCELLED\"",
  "canRegisterActions",
]) {
  assert.ok(detail.includes(value), `Expected detail integration to include ${value}`);
}

for (const forbidden of [
  "api.syncInvoiceBankSlip",
  "api.issueInvoiceBankSlip",
  "api.cancelInvoiceBankSlip",
  "api.cancelInvoice",
  "api.syncPaidBankSlipsDay",
  "alert(",
  "Consultar Sicredi",
  "Emitir boleto",
  "Cancelar boleto",
  "Dar baixa",
]) {
  assert.equal(
    [
      panel,
      detail,
      form,
      fields,
      selector,
      feedback,
      actionUtils,
    ].join("\n").includes(forbidden),
    false,
    `Collection action UI must not use ${forbidden}`,
  );
}

assert.equal(
  panel.includes("promisedAmountReais"),
  false,
  "collections-panel.tsx must not own the full action form body",
);
assert.equal(
  form.includes('method: "POST"'),
  false,
  "POST must stay centralized in src/lib/api.ts",
);
assert.equal(
  form.includes("createdByUserId"),
  false,
  "The action form must not mention createdByUserId",
);

console.log("Finance collection action form OK");
