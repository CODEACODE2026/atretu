CREATE TYPE "BankSlipSyncRunType" AS ENUM (
  'AUTOMATIC_OPEN_ISSUED',
  'MANUAL_OPEN_ISSUED',
  'MANUAL_PAID_DAY',
  'MANUAL_INVOICE'
);

CREATE TYPE "BankSlipSyncRunStatus" AS ENUM (
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'SKIPPED_ALREADY_RUNNING'
);

CREATE TYPE "BankSlipSyncRunItemStatus" AS ENUM (
  'CHECKED',
  'UPDATED',
  'PAID',
  'CANCELLED',
  'PARTIAL_PAYMENT_REVIEW',
  'NOT_FOUND',
  'ERROR'
);

CREATE TABLE "bank_slip_sync_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "BankSlipSyncRunType" NOT NULL,
  "status" "BankSlipSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "started_by_user_id" UUID,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  "scanned_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "paid_count" INTEGER NOT NULL DEFAULT 0,
  "cancelled_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,

  CONSTRAINT "bank_slip_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_slip_sync_run_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "bank_slip_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "status" "BankSlipSyncRunItemStatus" NOT NULL,
  "previous_status" "BankSlipStatus",
  "new_status" "BankSlipStatus",
  "provider_status" VARCHAR(80),
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "error_code" VARCHAR(80),
  "error_message" VARCHAR(500),
  "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "bank_slip_sync_run_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_slip_sync_runs_status_started_at_idx" ON "bank_slip_sync_runs"("status", "started_at");
CREATE INDEX "bank_slip_sync_runs_type_started_at_idx" ON "bank_slip_sync_runs"("type", "started_at");
CREATE INDEX "bank_slip_sync_runs_started_by_user_id_started_at_idx" ON "bank_slip_sync_runs"("started_by_user_id", "started_at");
CREATE INDEX "bank_slip_sync_run_items_run_id_checked_at_idx" ON "bank_slip_sync_run_items"("run_id", "checked_at");
CREATE INDEX "bank_slip_sync_run_items_bank_slip_id_checked_at_idx" ON "bank_slip_sync_run_items"("bank_slip_id", "checked_at");
CREATE INDEX "bank_slip_sync_run_items_invoice_id_checked_at_idx" ON "bank_slip_sync_run_items"("invoice_id", "checked_at");
CREATE INDEX "bank_slip_sync_run_items_status_checked_at_idx" ON "bank_slip_sync_run_items"("status", "checked_at");

ALTER TABLE "bank_slip_sync_runs"
  ADD CONSTRAINT "bank_slip_sync_runs_started_by_user_id_fkey"
  FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_slip_sync_run_items"
  ADD CONSTRAINT "bank_slip_sync_run_items_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "bank_slip_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_slip_sync_run_items"
  ADD CONSTRAINT "bank_slip_sync_run_items_bank_slip_id_fkey"
  FOREIGN KEY ("bank_slip_id") REFERENCES "bank_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_slip_sync_run_items"
  ADD CONSTRAINT "bank_slip_sync_run_items_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
