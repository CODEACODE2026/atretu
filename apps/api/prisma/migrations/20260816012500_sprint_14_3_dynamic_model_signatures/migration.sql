CREATE TYPE "OfficialDocumentDynamicSignatureMode" AS ENUM (
  'NONE',
  'STUDENT',
  'BOARD',
  'STUDENT_BOARD'
);

ALTER TABLE "official_document_model_versions"
  ADD COLUMN "signature_mode" "OfficialDocumentDynamicSignatureMode" NOT NULL DEFAULT 'STUDENT';
