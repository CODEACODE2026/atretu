import assert from "node:assert/strict";
import {
  CollectionActionSource,
  CollectionActionType,
  CollectionChannel,
  Prisma,
} from "@prisma/client";

assert.deepEqual(Object.values(CollectionActionType), [
  "CONTACT_ATTEMPT",
  "CONTACT_MADE",
  "PROMISE_TO_PAY",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW_NOTE",
  "INTERNAL_NOTE",
]);

assert.deepEqual(Object.values(CollectionChannel), [
  "PHONE",
  "WHATSAPP",
  "EMAIL",
  "IN_PERSON",
  "OTHER",
]);

assert.deepEqual(Object.values(CollectionActionSource), [
  "MANUAL",
  "SYSTEM",
  "WHATSAPP",
  "EMAIL",
]);

const collectionAction = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "CollectionAction",
);
assert.ok(collectionAction);

const fields = new Map(
  collectionAction.fields.map((field) => [field.name, field]),
);
const scalarFields = Object.values(Prisma.CollectionActionScalarFieldEnum);

assert.deepEqual(scalarFields, [
  "id",
  "invoiceId",
  "actionType",
  "channel",
  "source",
  "contactedName",
  "contactedDocumentMasked",
  "note",
  "promisedAmountCents",
  "promiseDueDate",
  "nextFollowUpAt",
  "createdByUserId",
  "createdAt",
]);
assert.equal(fields.get("invoice")?.type, "Invoice");
assert.equal(fields.get("createdBy")?.type, "User");
assert.equal(fields.has("operationalStatus"), false);
