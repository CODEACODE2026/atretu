ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_MODEL_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_MODEL_VERSION_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_MODEL_ACTIVATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_MODEL_INACTIVATED';

ALTER TYPE "OfficialDocumentType" ADD VALUE IF NOT EXISTS 'DYNAMIC_TEMPLATE';

CREATE TYPE "OfficialDocumentModelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "official_document_models" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "category" VARCHAR(80) NOT NULL,
  "status" "OfficialDocumentModelStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "official_document_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "official_document_model_versions" (
  "id" UUID NOT NULL,
  "model_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "variable_tokens" JSONB NOT NULL DEFAULT '[]',
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "official_document_model_versions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "official_document_issues"
  ADD COLUMN "document_model_id" UUID,
  ADD COLUMN "document_model_version_id" UUID;

CREATE INDEX "official_document_models_status_updated_at_idx"
  ON "official_document_models"("status", "updated_at");
CREATE INDEX "official_document_models_category_status_idx"
  ON "official_document_models"("category", "status");
CREATE UNIQUE INDEX "official_document_model_versions_model_id_version_key"
  ON "official_document_model_versions"("model_id", "version");
CREATE INDEX "official_document_model_versions_created_by_user_id_created_at_idx"
  ON "official_document_model_versions"("created_by_user_id", "created_at");
CREATE INDEX "official_document_issues_document_model_id_issued_at_idx"
  ON "official_document_issues"("document_model_id", "issued_at");
CREATE INDEX "official_document_issues_document_model_version_id_idx"
  ON "official_document_issues"("document_model_version_id");

ALTER TABLE "official_document_models"
  ADD CONSTRAINT "official_document_models_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "official_document_model_versions"
  ADD CONSTRAINT "official_document_model_versions_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "official_document_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "official_document_model_versions"
  ADD CONSTRAINT "official_document_model_versions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "official_document_issues"
  ADD CONSTRAINT "official_document_issues_document_model_id_fkey"
  FOREIGN KEY ("document_model_id") REFERENCES "official_document_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "official_document_issues"
  ADD CONSTRAINT "official_document_issues_document_model_version_id_fkey"
  FOREIGN KEY ("document_model_version_id") REFERENCES "official_document_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
