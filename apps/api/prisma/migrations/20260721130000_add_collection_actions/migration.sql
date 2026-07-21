ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'COLLECTION_ACTION_CREATED';

CREATE TYPE "CollectionActionType" AS ENUM (
  'CONTACT_ATTEMPT',
  'CONTACT_MADE',
  'PROMISE_TO_PAY',
  'FOLLOW_UP_SCHEDULED',
  'NO_CONTACT',
  'PARTIAL_PAYMENT_REVIEW_NOTE',
  'INTERNAL_NOTE'
);

CREATE TYPE "CollectionChannel" AS ENUM (
  'PHONE',
  'WHATSAPP',
  'EMAIL',
  'IN_PERSON',
  'OTHER'
);

CREATE TYPE "CollectionActionSource" AS ENUM (
  'MANUAL',
  'SYSTEM',
  'WHATSAPP',
  'EMAIL'
);

CREATE TABLE "collection_actions" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "action_type" "CollectionActionType" NOT NULL,
  "channel" "CollectionChannel",
  "source" "CollectionActionSource" NOT NULL DEFAULT 'MANUAL',
  "contacted_name" VARCHAR(160),
  "contacted_document_masked" VARCHAR(30),
  "note" VARCHAR(1000) NOT NULL,
  "promised_amount_cents" INTEGER,
  "promise_due_date" DATE,
  "next_follow_up_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "collection_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collection_actions_promised_amount_cents_positive_check" CHECK ("promised_amount_cents" IS NULL OR "promised_amount_cents" > 0)
);

CREATE INDEX "collection_actions_invoice_id_created_at_idx" ON "collection_actions"("invoice_id", "created_at");
CREATE INDEX "collection_actions_created_by_user_id_created_at_idx" ON "collection_actions"("created_by_user_id", "created_at");
CREATE INDEX "collection_actions_action_type_created_at_idx" ON "collection_actions"("action_type", "created_at");
CREATE INDEX "collection_actions_next_follow_up_at_idx" ON "collection_actions"("next_follow_up_at");

ALTER TABLE "collection_actions"
  ADD CONSTRAINT "collection_actions_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "collection_actions"
  ADD CONSTRAINT "collection_actions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
