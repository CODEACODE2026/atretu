ALTER TABLE "bank_slip_issue_batches"
  ADD COLUMN "unit_amount_cents" INTEGER NOT NULL DEFAULT 0;

UPDATE "bank_slip_issue_batches"
SET "unit_amount_cents" = CASE
  WHEN COALESCE("metadata"#>>'{previewSummary,unitAmountCents}', '') ~ '^\d+$'
    THEN ("metadata"#>>'{previewSummary,unitAmountCents}')::integer
  WHEN "total_eligible" > 0 AND "total_value_cents" > 0
    THEN FLOOR("total_value_cents"::numeric / "total_eligible")::integer
  ELSE 0
END;
