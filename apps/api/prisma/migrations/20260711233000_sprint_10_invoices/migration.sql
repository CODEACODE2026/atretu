ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'INVOICE_CANCELLED';

ALTER TYPE "StudentHistoryEventType" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE 'INVOICE_CANCELLED';

CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CANCELLED');
CREATE TYPE "InvoiceCancellationReason" AS ENUM ('MANUAL_CORRECTION', 'DUPLICATE', 'OTHER');

ALTER TABLE "student_history_events"
  ADD COLUMN "invoice_id" UUID;

CREATE TABLE "invoices" (
  "id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "description" VARCHAR(300),
  "idempotency_key" VARCHAR(120) NOT NULL,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" "InvoiceCancellationReason",
  "cancellation_note" VARCHAR(500),
  "created_by_user_id" UUID,
  "cancelled_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_amount_cents_positive_check" CHECK ("amount_cents" > 0)
);

CREATE UNIQUE INDEX "invoices_idempotency_key_key" ON "invoices"("idempotency_key");
CREATE INDEX "invoices_student_id_created_at_idx" ON "invoices"("student_id", "created_at");
CREATE INDEX "invoices_enrollment_id_idx" ON "invoices"("enrollment_id");
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");
CREATE INDEX "invoices_created_by_user_id_created_at_idx" ON "invoices"("created_by_user_id", "created_at");
CREATE INDEX "student_history_events_invoice_id_occurred_at_idx" ON "student_history_events"("invoice_id", "occurred_at");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_cancelled_by_user_id_fkey"
  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_history_events"
  ADD CONSTRAINT "student_history_events_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
