ALTER TABLE "bank_slips"
  DROP CONSTRAINT "bank_slips_cancellation_requested_by_user_id_fkey";

ALTER TABLE "bank_slips"
  ADD CONSTRAINT "bank_slips_cancellation_requested_by_user_id_fkey"
  FOREIGN KEY ("cancellation_requested_by_user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
