ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PRE_REGISTRATION_RECEIVED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PRE_REGISTRATION_DOCUMENT_UPLOADED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PRE_REGISTRATION_DOCUMENT_VIEWED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PRE_REGISTRATION_APPROVED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PRE_REGISTRATION_REJECTED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PRE_REGISTRATION_DOCUMENT_PROMOTED';

CREATE TYPE "PreRegistrationStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "PreRegistrationDocumentStatus" AS ENUM (
  'UPLOADED',
  'PROMOTED',
  'REMOVED'
);

CREATE TABLE "public_pre_registrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "public_code" VARCHAR(32) NOT NULL,
  "status" "PreRegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "full_name" VARCHAR(160) NOT NULL,
  "normalized_name" VARCHAR(160) NOT NULL,
  "cpf" VARCHAR(11) NOT NULL,
  "rg" VARCHAR(30),
  "birth_date" DATE NOT NULL,
  "phone" VARCHAR(30),
  "email" VARCHAR(180),
  "address_street" VARCHAR(180) NOT NULL,
  "address_number" VARCHAR(30) NOT NULL,
  "address_neighborhood" VARCHAR(120) NOT NULL,
  "address_city" VARCHAR(120) NOT NULL,
  "guardian_full_name" VARCHAR(160),
  "guardian_cpf" VARCHAR(11),
  "guardian_rg" VARCHAR(30),
  "academic_year_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "shift_id" UUID NOT NULL,
  "course" VARCHAR(140) NOT NULL,
  "grade" VARCHAR(40) NOT NULL,
  "request_fingerprint_hash" VARCHAR(64),
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "rejection_reason" VARCHAR(500),
  "approved_student_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "public_pre_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "public_pre_registrations_status_state_check"
    CHECK (
      ("status" = 'PENDING' AND "reviewed_at" IS NULL AND "reviewed_by_user_id" IS NULL AND "rejection_reason" IS NULL AND "approved_student_id" IS NULL)
      OR
      ("status" = 'APPROVED' AND "reviewed_at" IS NOT NULL AND "reviewed_by_user_id" IS NOT NULL AND "rejection_reason" IS NULL AND "approved_student_id" IS NOT NULL)
      OR
      ("status" = 'REJECTED' AND "reviewed_at" IS NOT NULL AND "reviewed_by_user_id" IS NOT NULL AND "rejection_reason" IS NOT NULL AND "approved_student_id" IS NULL)
    )
);

CREATE TABLE "pre_registration_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pre_registration_id" UUID NOT NULL,
  "document_type" "StudentDocumentType" NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "stored_file_name" VARCHAR(120) NOT NULL,
  "mime_type" VARCHAR(80) NOT NULL,
  "extension" VARCHAR(10) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" VARCHAR(64) NOT NULL,
  "status" "PreRegistrationDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "promoted_to_student_document_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "pre_registration_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pre_registration_documents_size_positive_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "pre_registration_documents_status_state_check"
    CHECK (
      ("status" = 'UPLOADED' AND "promoted_to_student_document_id" IS NULL)
      OR
      ("status" = 'PROMOTED' AND "promoted_to_student_document_id" IS NOT NULL)
      OR
      ("status" = 'REMOVED' AND "promoted_to_student_document_id" IS NULL)
    )
);

CREATE UNIQUE INDEX "public_pre_registrations_public_code_key" ON "public_pre_registrations"("public_code");
CREATE UNIQUE INDEX "public_pre_registrations_approved_student_id_key" ON "public_pre_registrations"("approved_student_id");
CREATE UNIQUE INDEX "public_pre_registrations_one_pending_cpf_key"
  ON "public_pre_registrations"("cpf")
  WHERE "status" = 'PENDING';
CREATE INDEX "public_pre_registrations_status_created_at_idx" ON "public_pre_registrations"("status", "created_at");
CREATE INDEX "public_pre_registrations_cpf_status_idx" ON "public_pre_registrations"("cpf", "status");
CREATE INDEX "public_pre_registrations_normalized_name_idx" ON "public_pre_registrations"("normalized_name");
CREATE INDEX "public_pre_registrations_academic_year_id_idx" ON "public_pre_registrations"("academic_year_id");
CREATE INDEX "public_pre_registrations_institution_id_idx" ON "public_pre_registrations"("institution_id");
CREATE INDEX "public_pre_registrations_shift_id_idx" ON "public_pre_registrations"("shift_id");

CREATE UNIQUE INDEX "pre_registration_documents_storage_key_key" ON "pre_registration_documents"("storage_key");
CREATE UNIQUE INDEX "pre_registration_documents_promoted_to_student_document_id_key" ON "pre_registration_documents"("promoted_to_student_document_id");
CREATE UNIQUE INDEX "pre_registration_documents_one_uploaded_type_key"
  ON "pre_registration_documents"("pre_registration_id", "document_type")
  WHERE "status" = 'UPLOADED';
CREATE INDEX "pre_registration_documents_pre_registration_id_status_document_type_idx"
  ON "pre_registration_documents"("pre_registration_id", "status", "document_type");
CREATE INDEX "pre_registration_documents_checksum_sha256_idx" ON "pre_registration_documents"("checksum_sha256");

ALTER TABLE "public_pre_registrations"
  ADD CONSTRAINT "public_pre_registrations_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_pre_registrations"
  ADD CONSTRAINT "public_pre_registrations_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_pre_registrations"
  ADD CONSTRAINT "public_pre_registrations_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_pre_registrations"
  ADD CONSTRAINT "public_pre_registrations_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public_pre_registrations"
  ADD CONSTRAINT "public_pre_registrations_approved_student_id_fkey"
  FOREIGN KEY ("approved_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pre_registration_documents"
  ADD CONSTRAINT "pre_registration_documents_pre_registration_id_fkey"
  FOREIGN KEY ("pre_registration_id") REFERENCES "public_pre_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pre_registration_documents"
  ADD CONSTRAINT "pre_registration_documents_promoted_to_student_document_id_fkey"
  FOREIGN KEY ("promoted_to_student_document_id") REFERENCES "student_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
