ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_DOCUMENT_UPLOADED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_DOCUMENT_REPLACED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_DOCUMENT_DOWNLOADED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_DOCUMENT_VIEWED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_DOCUMENT_REMOVED';

CREATE TYPE "StudentDocumentType" AS ENUM (
  'CPF',
  'RG',
  'PROOF_OF_ADDRESS',
  'PROOF_OF_ENROLLMENT'
);

CREATE TYPE "StudentDocumentStatus" AS ENUM (
  'ACTIVE',
  'REPLACED',
  'REMOVED'
);

CREATE TABLE "student_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "document_type" "StudentDocumentType" NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "stored_file_name" VARCHAR(120) NOT NULL,
  "mime_type" VARCHAR(80) NOT NULL,
  "extension" VARCHAR(10) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" VARCHAR(64) NOT NULL,
  "status" "StudentDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "uploaded_by_user_id" UUID,
  "removed_by_user_id" UUID,
  "replaced_by_id" UUID,
  "replaced_at" TIMESTAMPTZ(6),
  "removed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_documents_size_positive_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "student_documents_status_state_check"
    CHECK (
      ("status" = 'ACTIVE' AND "replaced_at" IS NULL AND "replaced_by_id" IS NULL AND "removed_at" IS NULL AND "removed_by_user_id" IS NULL)
      OR
      ("status" = 'REPLACED' AND "replaced_at" IS NOT NULL AND "replaced_by_id" IS NOT NULL AND "removed_at" IS NULL AND "removed_by_user_id" IS NULL)
      OR
      ("status" = 'REMOVED' AND "removed_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "student_documents_storage_key_key" ON "student_documents"("storage_key");
CREATE UNIQUE INDEX "student_documents_one_active_type_key"
  ON "student_documents"("student_id", "document_type")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "student_documents_student_id_status_document_type_idx" ON "student_documents"("student_id", "status", "document_type");
CREATE INDEX "student_documents_checksum_sha256_idx" ON "student_documents"("checksum_sha256");
CREATE INDEX "student_documents_uploaded_by_user_id_created_at_idx" ON "student_documents"("uploaded_by_user_id", "created_at");

ALTER TABLE "student_documents"
  ADD CONSTRAINT "student_documents_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_documents"
  ADD CONSTRAINT "student_documents_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_documents"
  ADD CONSTRAINT "student_documents_removed_by_user_id_fkey"
  FOREIGN KEY ("removed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_documents"
  ADD CONSTRAINT "student_documents_replaced_by_id_fkey"
  FOREIGN KEY ("replaced_by_id") REFERENCES "student_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
