ALTER TABLE "bank_slips"
  ADD COLUMN "txid" VARCHAR(35);

DROP INDEX IF EXISTS "bank_slips_provider_environment_nosso_numero_key";

CREATE INDEX "bank_slips_provider_environment_nosso_numero_idx"
  ON "bank_slips"("provider", "environment", "nosso_numero");

CREATE INDEX "bank_slips_provider_environment_txid_idx"
  ON "bank_slips"("provider", "environment", "txid");

CREATE UNIQUE INDEX "bank_slips_provider_production_nosso_numero_key"
  ON "bank_slips"("provider", "nosso_numero")
  WHERE "environment" = 'PRODUCTION' AND "nosso_numero" IS NOT NULL;
