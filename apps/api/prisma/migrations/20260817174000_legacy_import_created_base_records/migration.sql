ALTER TABLE "legacy_import_batches"
  ADD COLUMN "created_base_records" JSONB NOT NULL DEFAULT '{"institutions":[],"shifts":[],"buses":[]}';
