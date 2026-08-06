ALTER TYPE "OfficialDocumentType" ADD VALUE IF NOT EXISTS 'INTERNAL_REGULATION';

ALTER TABLE "official_document_issues"
  ALTER COLUMN "student_id" DROP NOT NULL;

CREATE INDEX "official_document_issues_document_type_issued_at_idx"
  ON "official_document_issues"("document_type", "issued_at");
