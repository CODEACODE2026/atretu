ALTER TABLE "official_document_issues"
  ADD COLUMN "template_key" VARCHAR(80) NOT NULL DEFAULT 'termination-letter',
  ADD COLUMN "template_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "notes" VARCHAR(500);

ALTER TABLE "official_document_issues"
  ALTER COLUMN "template_key" DROP DEFAULT;

CREATE INDEX "official_document_issues_document_type_template_version_idx"
  ON "official_document_issues"("document_type", "template_version");
