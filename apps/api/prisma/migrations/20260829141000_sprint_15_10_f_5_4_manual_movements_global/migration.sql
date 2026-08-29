DROP INDEX IF EXISTS "manual_financial_movements_institution_id_type_status_transaction_date_idx";

DROP INDEX IF EXISTS "manual_financial_movements_institution_id_transaction_date_idx";

ALTER TABLE "manual_financial_movements"
  DROP CONSTRAINT IF EXISTS "manual_financial_movements_institution_id_fkey";

ALTER TABLE "manual_financial_movements"
  DROP COLUMN IF EXISTS "institution_id";
