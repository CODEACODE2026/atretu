CREATE TYPE "BankSlipIssueBatchStatus" AS ENUM (
  'DRAFT',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "BankSlipIssueBatchItemStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'ISSUED',
  'SKIPPED',
  'FAILED',
  'UNKNOWN',
  'CANCELLED'
);

CREATE TABLE "bank_slip_issue_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" "BankSlipIssueBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "requested_by_user_id" UUID NOT NULL,
  "cancelled_by_user_id" UUID,
  "cancel_reason" VARCHAR(500),
  "total_items" INTEGER NOT NULL DEFAULT 0,
  "queued_items" INTEGER NOT NULL DEFAULT 0,
  "processing_items" INTEGER NOT NULL DEFAULT 0,
  "issued_items" INTEGER NOT NULL DEFAULT 0,
  "skipped_items" INTEGER NOT NULL DEFAULT 0,
  "failed_items" INTEGER NOT NULL DEFAULT 0,
  "unknown_items" INTEGER NOT NULL DEFAULT 0,
  "cancelled_items" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(6),
  "finished_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "bank_slip_issue_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_slip_issue_batch_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batch_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "bank_slip_id" UUID,
  "status" "BankSlipIssueBatchItemStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6),
  "locked_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "finished_at" TIMESTAMPTZ(6),
  "last_error_code" VARCHAR(80),
  "last_error_message" VARCHAR(500),
  "skip_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "bank_slip_issue_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_slip_issue_batches_status_created_at_idx" ON "bank_slip_issue_batches"("status", "created_at");
CREATE INDEX "bank_slip_issue_batches_requested_by_user_id_created_at_idx" ON "bank_slip_issue_batches"("requested_by_user_id", "created_at");
CREATE INDEX "bank_slip_issue_batches_cancelled_by_user_id_cancelled_at_idx" ON "bank_slip_issue_batches"("cancelled_by_user_id", "cancelled_at");
CREATE UNIQUE INDEX "bank_slip_issue_batch_items_batch_id_invoice_id_key" ON "bank_slip_issue_batch_items"("batch_id", "invoice_id");
CREATE INDEX "bank_slip_issue_batch_items_batch_id_status_idx" ON "bank_slip_issue_batch_items"("batch_id", "status");
CREATE INDEX "bank_slip_issue_batch_items_status_next_attempt_at_idx" ON "bank_slip_issue_batch_items"("status", "next_attempt_at");
CREATE INDEX "bank_slip_issue_batch_items_invoice_id_idx" ON "bank_slip_issue_batch_items"("invoice_id");
CREATE INDEX "bank_slip_issue_batch_items_bank_slip_id_idx" ON "bank_slip_issue_batch_items"("bank_slip_id");

ALTER TABLE "bank_slip_issue_batches"
  ADD CONSTRAINT "bank_slip_issue_batches_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_slip_issue_batches"
  ADD CONSTRAINT "bank_slip_issue_batches_cancelled_by_user_id_fkey"
  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_slip_issue_batch_items"
  ADD CONSTRAINT "bank_slip_issue_batch_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "bank_slip_issue_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_slip_issue_batch_items"
  ADD CONSTRAINT "bank_slip_issue_batch_items_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_slip_issue_batch_items"
  ADD CONSTRAINT "bank_slip_issue_batch_items_bank_slip_id_fkey"
  FOREIGN KEY ("bank_slip_id") REFERENCES "bank_slips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
