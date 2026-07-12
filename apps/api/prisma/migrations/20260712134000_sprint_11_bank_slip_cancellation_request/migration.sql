ALTER TABLE "bank_slips"
  ADD COLUMN "cancellation_requested_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancellation_requested_by_user_id" UUID,
  ADD COLUMN "cancellation_reason" "InvoiceCancellationReason",
  ADD COLUMN "cancellation_note" VARCHAR(500);

ALTER TABLE "bank_slips"
  ADD CONSTRAINT "bank_slips_cancellation_requested_by_user_id_fkey"
  FOREIGN KEY ("cancellation_requested_by_user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "bank_slips"
  ADD CONSTRAINT "bank_slips_cancellation_request_fields_check"
  CHECK (
    (
      "cancellation_requested_at" IS NULL
      AND "cancellation_requested_by_user_id" IS NULL
      AND "cancellation_reason" IS NULL
      AND "cancellation_note" IS NULL
    )
    OR (
      "cancellation_requested_at" IS NOT NULL
      AND "cancellation_requested_by_user_id" IS NOT NULL
      AND "cancellation_reason" IS NOT NULL
    )
  );

ALTER TABLE "bank_slips"
  ADD CONSTRAINT "bank_slips_pending_cancellation_request_check"
  CHECK (
    "status" <> 'PENDING_CANCELLATION'
    OR (
      "cancellation_requested_at" IS NOT NULL
      AND "cancellation_requested_by_user_id" IS NOT NULL
      AND "cancellation_reason" IS NOT NULL
    )
  );

CREATE INDEX "bank_slips_cancellation_requested_by_user_id_cancellation_requested_at_idx"
  ON "bank_slips"("cancellation_requested_by_user_id", "cancellation_requested_at");
