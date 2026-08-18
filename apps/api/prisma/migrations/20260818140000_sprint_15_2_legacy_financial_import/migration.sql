ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'LEGACY_FINANCIAL_HISTORY_IMPORTED';

CREATE TYPE "LegacyFinancialStatus" AS ENUM ('PAGO', 'PENDENTE', 'BAIXADO', 'VENCIDO');

CREATE TABLE "legacy_financial_imports" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "legacy_student_import_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "source" VARCHAR(40) NOT NULL DEFAULT 'LEGACY',
  "legacy_table" VARCHAR(80) NOT NULL DEFAULT 'tab_financeiro',
  "legacy_financial_id" INTEGER NOT NULL,
  "legacy_student_id" INTEGER NOT NULL,
  "status" "LegacyFinancialStatus" NOT NULL,
  "situacao_boleto" INTEGER NOT NULL,
  "nominal_amount_cents" INTEGER NOT NULL,
  "paid_amount_cents" INTEGER,
  "fine_amount_cents" INTEGER NOT NULL DEFAULT 0,
  "interest_amount_cents" INTEGER NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMPTZ(6),
  "due_date" DATE,
  "paid_at" TIMESTAMPTZ(6),
  "nosso_numero" VARCHAR(80),
  "linha_digitavel" VARCHAR(120),
  "codigo_barras" VARCHAR(120),
  "boleto_path" VARCHAR(500),
  "mail_status" INTEGER,
  "sent_at" TIMESTAMPTZ(6),
  "metadata" JSONB,
  "imported_by_user_id" UUID,
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_financial_imports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legacy_financial_imports_source_legacy_table_legacy_financial_id_key"
  ON "legacy_financial_imports"("source", "legacy_table", "legacy_financial_id");
CREATE INDEX "legacy_financial_imports_batch_id_idx" ON "legacy_financial_imports"("batch_id");
CREATE INDEX "legacy_financial_imports_legacy_student_id_idx" ON "legacy_financial_imports"("legacy_student_id");
CREATE INDEX "legacy_financial_imports_student_id_idx" ON "legacy_financial_imports"("student_id");
CREATE INDEX "legacy_financial_imports_status_idx" ON "legacy_financial_imports"("status");
CREATE INDEX "legacy_financial_imports_due_date_idx" ON "legacy_financial_imports"("due_date");
CREATE INDEX "legacy_financial_imports_paid_at_idx" ON "legacy_financial_imports"("paid_at");

ALTER TABLE "legacy_financial_imports"
  ADD CONSTRAINT "legacy_financial_imports_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "legacy_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_financial_imports"
  ADD CONSTRAINT "legacy_financial_imports_legacy_student_import_id_fkey"
  FOREIGN KEY ("legacy_student_import_id") REFERENCES "legacy_student_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_financial_imports"
  ADD CONSTRAINT "legacy_financial_imports_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_financial_imports"
  ADD CONSTRAINT "legacy_financial_imports_imported_by_user_id_fkey"
  FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
