ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_INVALIDATED';

ALTER TYPE "StudentHistoryEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_ISSUED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE IF NOT EXISTS 'OFFICIAL_DOCUMENT_INVALIDATED';

ALTER TYPE "OfficialDocumentIssueStatus" ADD VALUE IF NOT EXISTS 'INVALIDATED';

ALTER TABLE "official_document_issues"
  ADD COLUMN "invalidated_by_user_id" UUID,
  ADD COLUMN "invalidation_reason" VARCHAR(500),
  ADD COLUMN "invalidated_at" TIMESTAMPTZ(6);

ALTER TABLE "official_document_issues"
  ADD CONSTRAINT "official_document_issues_invalidated_by_user_id_fkey"
  FOREIGN KEY ("invalidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_history_events"
  ADD COLUMN "official_document_issue_id" UUID;

ALTER TABLE "student_history_events"
  ADD CONSTRAINT "student_history_events_official_document_issue_id_fkey"
  FOREIGN KEY ("official_document_issue_id") REFERENCES "official_document_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "official_document_issues_invalidated_by_user_id_invalidated_at_idx"
  ON "official_document_issues"("invalidated_by_user_id", "invalidated_at");

CREATE INDEX "student_history_events_official_document_issue_id_occurred_at_idx"
  ON "student_history_events"("official_document_issue_id", "occurred_at");
