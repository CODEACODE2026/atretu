CREATE TYPE "OfficialDocumentType" AS ENUM ('TERMINATION_LETTER');

CREATE TYPE "OfficialDocumentIssueStatus" AS ENUM ('ISSUED');

ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_ISSUED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_REISSUED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_VIEWED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_DOWNLOADED';

CREATE TABLE "official_document_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "document_type" "OfficialDocumentType" NOT NULL,
  "status" "OfficialDocumentIssueStatus" NOT NULL DEFAULT 'ISSUED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "protocol" VARCHAR(40) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "file_name" VARCHAR(180) NOT NULL,
  "mime_type" VARCHAR(80) NOT NULL DEFAULT 'application/pdf',
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" VARCHAR(64) NOT NULL,
  "issued_by_user_id" UUID,
  "source_issue_id" UUID,
  "content_snapshot" JSONB NOT NULL,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "official_document_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_document_issues_protocol_key" ON "official_document_issues"("protocol");
CREATE UNIQUE INDEX "official_document_issues_storage_key_key" ON "official_document_issues"("storage_key");
CREATE INDEX "official_document_issues_student_id_document_type_issued_at_idx" ON "official_document_issues"("student_id", "document_type", "issued_at");
CREATE INDEX "official_document_issues_issued_by_user_id_issued_at_idx" ON "official_document_issues"("issued_by_user_id", "issued_at");
CREATE INDEX "official_document_issues_source_issue_id_idx" ON "official_document_issues"("source_issue_id");

ALTER TABLE "official_document_issues"
  ADD CONSTRAINT "official_document_issues_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "official_document_issues"
  ADD CONSTRAINT "official_document_issues_issued_by_user_id_fkey"
  FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "official_document_issues"
  ADD CONSTRAINT "official_document_issues_source_issue_id_fkey"
  FOREIGN KEY ("source_issue_id") REFERENCES "official_document_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
