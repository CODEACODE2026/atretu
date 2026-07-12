ALTER TYPE "InvoiceStatus" ADD VALUE 'PAID';

ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_ISSUE_REQUESTED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_ISSUED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_ISSUE_FAILED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_PAYMENT_CONFIRMED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_CANCELLATION_REQUESTED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_CANCELLED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BANK_SLIP_SYNCED';

ALTER TYPE "StudentHistoryEventType" ADD VALUE 'BANK_SLIP_ISSUED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE 'BANK_SLIP_PAYMENT_CONFIRMED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE 'BANK_SLIP_CANCELLATION_REQUESTED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE 'BANK_SLIP_CANCELLED';

CREATE TYPE "BankSlipProvider" AS ENUM ('SICREDI');
CREATE TYPE "BankSlipEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "BankSlipStatus" AS ENUM (
  'PENDING_ISSUE',
  'ISSUED',
  'PAID',
  'PENDING_CANCELLATION',
  'CANCELLED',
  'ISSUE_FAILED',
  'CANCELLATION_FAILED',
  'UNKNOWN'
);

CREATE TABLE "bank_slips" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "provider" "BankSlipProvider" NOT NULL DEFAULT 'SICREDI',
  "environment" "BankSlipEnvironment" NOT NULL,
  "status" "BankSlipStatus" NOT NULL DEFAULT 'PENDING_ISSUE',
  "document_species" VARCHAR(40) NOT NULL DEFAULT 'RECIBO',
  "nosso_numero" VARCHAR(9),
  "seu_numero" VARCHAR(10) NOT NULL,
  "linha_digitavel" VARCHAR(47),
  "codigo_barras" VARCHAR(44),
  "original_amount_cents" INTEGER NOT NULL,
  "paid_amount_cents" INTEGER,
  "issued_at" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "last_checked_at" TIMESTAMPTZ(6),
  "provider_status" VARCHAR(80),
  "provider_error_code" VARCHAR(80),
  "provider_error_message" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "bank_slips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_slips_original_amount_cents_positive_check" CHECK ("original_amount_cents" > 0),
  CONSTRAINT "bank_slips_paid_amount_cents_positive_check" CHECK ("paid_amount_cents" IS NULL OR "paid_amount_cents" > 0)
);

ALTER TABLE "student_history_events"
  ADD COLUMN "bank_slip_id" UUID;

CREATE UNIQUE INDEX "bank_slips_invoice_id_key" ON "bank_slips"("invoice_id");
CREATE UNIQUE INDEX "bank_slips_provider_environment_seu_numero_key" ON "bank_slips"("provider", "environment", "seu_numero");
CREATE UNIQUE INDEX "bank_slips_provider_environment_nosso_numero_key" ON "bank_slips"("provider", "environment", "nosso_numero");
CREATE INDEX "bank_slips_status_updated_at_idx" ON "bank_slips"("status", "updated_at");
CREATE INDEX "bank_slips_last_checked_at_idx" ON "bank_slips"("last_checked_at");
CREATE INDEX "bank_slips_paid_at_idx" ON "bank_slips"("paid_at");
CREATE INDEX "bank_slips_cancelled_at_idx" ON "bank_slips"("cancelled_at");
CREATE INDEX "student_history_events_bank_slip_id_occurred_at_idx" ON "student_history_events"("bank_slip_id", "occurred_at");

ALTER TABLE "bank_slips"
  ADD CONSTRAINT "bank_slips_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_history_events"
  ADD CONSTRAINT "student_history_events_bank_slip_id_fkey"
  FOREIGN KEY ("bank_slip_id") REFERENCES "bank_slips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
