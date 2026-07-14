DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcademicYearStatus') THEN
    CREATE TYPE "AcademicYearStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
END $$;

ALTER TABLE "academic_years"
  ADD COLUMN IF NOT EXISTS "status" "AcademicYearStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "academic_years_status_idx" ON "academic_years"("status");
