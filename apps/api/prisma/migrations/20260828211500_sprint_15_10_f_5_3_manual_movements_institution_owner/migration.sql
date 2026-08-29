ALTER TABLE "manual_financial_movements"
  ADD COLUMN "institution_id" UUID;

ALTER TABLE "manual_financial_movements"
  ADD CONSTRAINT "manual_financial_movements_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "manual_financial_movements_institution_id_transaction_date_idx"
  ON "manual_financial_movements"("institution_id", "transaction_date");

CREATE INDEX "manual_financial_movements_institution_id_type_status_transaction_date_idx"
  ON "manual_financial_movements"("institution_id", "type", "status", "transaction_date");
