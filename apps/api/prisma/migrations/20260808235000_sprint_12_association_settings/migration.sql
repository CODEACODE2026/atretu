-- CreateEnum
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'ASSOCIATION_SETTINGS_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'ASSOCIATION_LOGO_UPDATED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "association_settings" (
  "id" VARCHAR(40) NOT NULL DEFAULT 'association-settings',
  "legal_name" VARCHAR(180) NOT NULL,
  "display_name" VARCHAR(120),
  "cnpj" VARCHAR(18) NOT NULL,
  "street" VARCHAR(180) NOT NULL,
  "number" VARCHAR(30) NOT NULL,
  "complement" VARCHAR(120),
  "district" VARCHAR(120) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "state" VARCHAR(2) NOT NULL,
  "postal_code" VARCHAR(10) NOT NULL,
  "primary_phone" VARCHAR(30) NOT NULL,
  "secondary_phone" VARCHAR(30),
  "email" VARCHAR(180) NOT NULL,
  "website" VARCHAR(180),
  "logo_storage_key" VARCHAR(500),
  "logo_content_type" VARCHAR(80),
  "logo_file_name" VARCHAR(180),
  "logo_size_bytes" INTEGER,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "association_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'association_settings_updated_by_user_id_fkey'
  ) THEN
    ALTER TABLE "association_settings"
      ADD CONSTRAINT "association_settings_updated_by_user_id_fkey"
      FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed singleton with current institutional data. The persisted row is the source of truth after this migration.
INSERT INTO "association_settings" (
  "id",
  "legal_name",
  "display_name",
  "cnpj",
  "street",
  "number",
  "district",
  "city",
  "state",
  "postal_code",
  "primary_phone",
  "secondary_phone",
  "email"
) VALUES (
  'association-settings',
  'ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS',
  'ATRETU',
  '49.682.667/0001-00',
  'Av. Claudio Domingos Soletti',
  '1276',
  'Centro',
  'Terra Rica',
  'PR',
  '87890-000',
  '44 99941-3565',
  '44 99144-1176',
  'atretu2022@gmail.com'
) ON CONFLICT ("id") DO NOTHING;
