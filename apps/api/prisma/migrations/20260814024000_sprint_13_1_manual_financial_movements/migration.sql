-- Sprint 13.1 - Movimentacoes financeiras manuais

ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_PAID';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_CANCELLED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_UPLOADED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_REPLACED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_VIEWED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_DOWNLOADED';

ALTER TYPE "StudentHistoryEventType" ADD VALUE IF NOT EXISTS 'MANUAL_FINANCIAL_INCOME_RECORDED';

CREATE TYPE "ManualFinancialMovementType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "ManualFinancialMovementStatus" AS ENUM ('PENDING', 'RECEIVED', 'PAID', 'CANCELLED');
CREATE TYPE "ManualFinancialMovementCategory" AS ENUM (
  'SECOND_CARD_COPY',
  'XEROX',
  'ADMINISTRATIVE_FEE',
  'EXTRA_CONTRIBUTION',
  'DONATION',
  'FUEL',
  'MAINTENANCE',
  'ACCOUNTING',
  'OFFICE_SUPPLIES',
  'SERVICES',
  'TAXES',
  'PURCHASES',
  'OTHER'
);
CREATE TYPE "ManualFinancialMovementAttachmentStatus" AS ENUM ('ACTIVE', 'REPLACED', 'REMOVED');

CREATE TABLE "manual_financial_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ManualFinancialMovementType" NOT NULL,
  "status" "ManualFinancialMovementStatus" NOT NULL,
  "category" "ManualFinancialMovementCategory" NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "transaction_date" DATE NOT NULL,
  "competence_date" DATE,
  "due_date" DATE,
  "paid_at" DATE,
  "supplier_name" VARCHAR(180),
  "supplier_document" VARCHAR(14),
  "document_number" VARCHAR(80),
  "notes" VARCHAR(1000),
  "student_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID,
  "cancelled_by_user_id" UUID,
  "cancel_reason" VARCHAR(500),
  "cancelled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manual_financial_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "manual_financial_movement_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "movement_id" UUID NOT NULL,
  "status" "ManualFinancialMovementAttachmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "storage_key" VARCHAR(500) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "stored_file_name" VARCHAR(120) NOT NULL,
  "mime_type" VARCHAR(80) NOT NULL,
  "extension" VARCHAR(10) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" VARCHAR(64) NOT NULL,
  "metadata" JSONB,
  "uploaded_by_user_id" UUID,
  "replaced_by_id" UUID,
  "replaced_at" TIMESTAMPTZ(6),
  "removed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manual_financial_movement_attachments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "student_history_events"
  ADD COLUMN "manual_financial_movement_id" UUID;

CREATE UNIQUE INDEX "manual_financial_movement_attachments_storage_key_key"
  ON "manual_financial_movement_attachments"("storage_key");

CREATE INDEX "manual_financial_movements_type_status_transaction_date_idx"
  ON "manual_financial_movements"("type", "status", "transaction_date");
CREATE INDEX "manual_financial_movements_status_transaction_date_idx"
  ON "manual_financial_movements"("status", "transaction_date");
CREATE INDEX "manual_financial_movements_category_transaction_date_idx"
  ON "manual_financial_movements"("category", "transaction_date");
CREATE INDEX "manual_financial_movements_competence_date_idx"
  ON "manual_financial_movements"("competence_date");
CREATE INDEX "manual_financial_movements_student_id_transaction_date_idx"
  ON "manual_financial_movements"("student_id", "transaction_date");
CREATE INDEX "manual_financial_movements_created_by_user_id_created_at_idx"
  ON "manual_financial_movements"("created_by_user_id", "created_at");

CREATE INDEX "manual_financial_movement_attachments_movement_id_status_created_at_idx"
  ON "manual_financial_movement_attachments"("movement_id", "status", "created_at");
CREATE INDEX "manual_financial_movement_attachments_uploaded_by_user_id_created_at_idx"
  ON "manual_financial_movement_attachments"("uploaded_by_user_id", "created_at");
CREATE INDEX "manual_financial_movement_attachments_checksum_sha256_idx"
  ON "manual_financial_movement_attachments"("checksum_sha256");

CREATE INDEX "student_history_events_manual_financial_movement_id_occurred_at_idx"
  ON "student_history_events"("manual_financial_movement_id", "occurred_at");

ALTER TABLE "manual_financial_movements"
  ADD CONSTRAINT "manual_financial_movements_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manual_financial_movements"
  ADD CONSTRAINT "manual_financial_movements_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_financial_movements"
  ADD CONSTRAINT "manual_financial_movements_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manual_financial_movements"
  ADD CONSTRAINT "manual_financial_movements_cancelled_by_user_id_fkey"
  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "manual_financial_movement_attachments"
  ADD CONSTRAINT "manual_financial_movement_attachments_movement_id_fkey"
  FOREIGN KEY ("movement_id") REFERENCES "manual_financial_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_financial_movement_attachments"
  ADD CONSTRAINT "manual_financial_movement_attachments_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manual_financial_movement_attachments"
  ADD CONSTRAINT "manual_financial_movement_attachments_replaced_by_id_fkey"
  FOREIGN KEY ("replaced_by_id") REFERENCES "manual_financial_movement_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_history_events"
  ADD CONSTRAINT "student_history_events_manual_financial_movement_id_fkey"
  FOREIGN KEY ("manual_financial_movement_id") REFERENCES "manual_financial_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
