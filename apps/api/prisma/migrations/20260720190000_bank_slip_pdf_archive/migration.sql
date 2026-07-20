ALTER TABLE "bank_slips"
  ADD COLUMN "pdf_storage_key" VARCHAR(180),
  ADD COLUMN "pdf_stored_at" TIMESTAMPTZ(6),
  ADD COLUMN "pdf_sha256" CHAR(64),
  ADD COLUMN "pdf_size_bytes" INTEGER;

CREATE INDEX "bank_slips_pdf_stored_at_idx" ON "bank_slips"("pdf_stored_at");
