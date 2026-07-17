CREATE TYPE "BankSlipIssueBatchSource" AS ENUM ('MANUAL', 'INSTITUTION');

ALTER TABLE "bank_slip_issue_batches"
  ADD COLUMN "source" "BankSlipIssueBatchSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "institution_id" UUID,
  ADD COLUMN "competence" VARCHAR(7),
  ADD COLUMN "due_date" DATE,
  ADD COLUMN "shift_id" UUID,
  ADD COLUMN "total_students" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_invoices" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_eligible" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_value_cents" INTEGER NOT NULL DEFAULT 0;

UPDATE "bank_slip_issue_batches"
SET
  "source" = CASE
    WHEN "metadata"->>'source' = 'INSTITUTION' THEN 'INSTITUTION'::"BankSlipIssueBatchSource"
    ELSE 'MANUAL'::"BankSlipIssueBatchSource"
  END,
  "institution_id" = CASE
    WHEN COALESCE("metadata"#>>'{filters,institutionId}', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN ("metadata"#>>'{filters,institutionId}')::uuid
    ELSE NULL
  END,
  "competence" = CASE
    WHEN COALESCE("metadata"#>>'{filters,competence}', '') ~ '^\d{4}-\d{2}$'
      THEN "metadata"#>>'{filters,competence}'
    ELSE NULL
  END,
  "due_date" = CASE
    WHEN COALESCE("metadata"#>>'{filters,dueDate}', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN ("metadata"#>>'{filters,dueDate}')::date
    ELSE NULL
  END,
  "shift_id" = CASE
    WHEN COALESCE("metadata"#>>'{filters,shiftId}', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN ("metadata"#>>'{filters,shiftId}')::uuid
    ELSE NULL
  END,
  "total_students" = CASE
    WHEN COALESCE("metadata"#>>'{previewSummary,totalStudentsFound}', '') ~ '^\d+$'
      THEN ("metadata"#>>'{previewSummary,totalStudentsFound}')::integer
    ELSE 0
  END,
  "total_invoices" = CASE
    WHEN COALESCE("metadata"#>>'{previewSummary,totalInvoicesFound}', '') ~ '^\d+$'
      THEN ("metadata"#>>'{previewSummary,totalInvoicesFound}')::integer
    ELSE "total_items"
  END,
  "total_eligible" = CASE
    WHEN COALESCE("metadata"#>>'{previewSummary,totalEligible}', '') ~ '^\d+$'
      THEN ("metadata"#>>'{previewSummary,totalEligible}')::integer
    ELSE "queued_items" + "issued_items" + "processing_items"
  END,
  "total_value_cents" = CASE
    WHEN COALESCE("metadata"#>>'{previewSummary,eligibleAmountCents}', '') ~ '^\d+$'
      THEN ("metadata"#>>'{previewSummary,eligibleAmountCents}')::integer
    WHEN COALESCE("metadata"#>>'{report,issuedAmountCents}', '') ~ '^\d+$'
      THEN ("metadata"#>>'{report,issuedAmountCents}')::integer
    ELSE 0
  END
WHERE "metadata" IS NOT NULL;

ALTER TABLE "bank_slip_issue_batches"
  ADD CONSTRAINT "bank_slip_issue_batches_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_slip_issue_batches"
  ADD CONSTRAINT "bank_slip_issue_batches_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bank_slip_issue_batches_source_created_at_idx" ON "bank_slip_issue_batches"("source", "created_at");
CREATE INDEX "bank_slip_issue_batches_institution_id_competence_idx" ON "bank_slip_issue_batches"("institution_id", "competence");
CREATE INDEX "bank_slip_issue_batches_institution_id_created_at_idx" ON "bank_slip_issue_batches"("institution_id", "created_at");
CREATE INDEX "bank_slip_issue_batches_competence_created_at_idx" ON "bank_slip_issue_batches"("competence", "created_at");
CREATE INDEX "bank_slip_issue_batches_shift_id_competence_idx" ON "bank_slip_issue_batches"("shift_id", "competence");
CREATE INDEX "bank_slip_issue_batches_due_date_idx" ON "bank_slip_issue_batches"("due_date");
