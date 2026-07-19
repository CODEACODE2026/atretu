ALTER TABLE "bank_slip_sync_runs"
  ADD COLUMN "unchanged_count" INTEGER NOT NULL DEFAULT 0;
