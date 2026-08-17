ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'LEGACY_IMPORT_BATCH_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'LEGACY_STUDENT_IMPORTED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'LEGACY_IMPORT_BATCH_ROLLED_BACK';

CREATE TABLE "legacy_import_batches" (
  "id" UUID NOT NULL,
  "source" VARCHAR(40) NOT NULL DEFAULT 'LEGACY',
  "legacy_table" VARCHAR(80) NOT NULL DEFAULT 'tab_academico',
  "file_name" VARCHAR(180),
  "total_records" INTEGER NOT NULL,
  "imported_count" INTEGER NOT NULL DEFAULT 0,
  "pending_count" INTEGER NOT NULL DEFAULT 0,
  "blocked_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "rolled_back_at" TIMESTAMPTZ(6),
  "imported_by_user_id" UUID,
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_student_imports" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "source" VARCHAR(40) NOT NULL DEFAULT 'LEGACY',
  "legacy_table" VARCHAR(80) NOT NULL DEFAULT 'tab_academico',
  "legacy_id" INTEGER NOT NULL,
  "student_id" UUID NOT NULL,
  "person_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "student_card_id" UUID NOT NULL,
  "bus_assignment_id" UUID,
  "legacy_card_number" VARCHAR(32),
  "generated_card_number" VARCHAR(32) NOT NULL,
  "imported_by_user_id" UUID,
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_student_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legacy_import_batches_source_legacy_table_imported_at_idx" ON "legacy_import_batches"("source", "legacy_table", "imported_at");
CREATE INDEX "legacy_import_batches_imported_by_user_id_imported_at_idx" ON "legacy_import_batches"("imported_by_user_id", "imported_at");
CREATE INDEX "legacy_student_imports_batch_id_idx" ON "legacy_student_imports"("batch_id");
CREATE INDEX "legacy_student_imports_legacy_id_idx" ON "legacy_student_imports"("legacy_id");
CREATE UNIQUE INDEX "legacy_student_imports_student_id_key" ON "legacy_student_imports"("student_id");
CREATE UNIQUE INDEX "legacy_student_imports_source_legacy_table_legacy_id_key" ON "legacy_student_imports"("source", "legacy_table", "legacy_id");

ALTER TABLE "legacy_import_batches"
  ADD CONSTRAINT "legacy_import_batches_imported_by_user_id_fkey"
  FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "legacy_student_imports"
  ADD CONSTRAINT "legacy_student_imports_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "legacy_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_student_imports"
  ADD CONSTRAINT "legacy_student_imports_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_student_imports"
  ADD CONSTRAINT "legacy_student_imports_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_student_imports"
  ADD CONSTRAINT "legacy_student_imports_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_student_imports"
  ADD CONSTRAINT "legacy_student_imports_student_card_id_fkey"
  FOREIGN KEY ("student_card_id") REFERENCES "student_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_student_imports"
  ADD CONSTRAINT "legacy_student_imports_bus_assignment_id_fkey"
  FOREIGN KEY ("bus_assignment_id") REFERENCES "bus_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
