ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'ADMINISTRATOR';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'USER';

CREATE TABLE "permission_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(240),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "permission_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permission_profile_permissions" (
  "profile_id" UUID NOT NULL,
  "permission_key" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_profile_permissions_pkey" PRIMARY KEY ("profile_id", "permission_key")
);

ALTER TABLE "users"
  ADD COLUMN "phone" VARCHAR(30),
  ADD COLUMN "position" VARCHAR(120),
  ADD COLUMN "permission_profile_id" UUID;

CREATE UNIQUE INDEX "permission_profiles_name_key" ON "permission_profiles"("name");
CREATE INDEX "permission_profiles_is_active_idx" ON "permission_profiles"("is_active");
CREATE INDEX "permission_profile_permissions_permission_key_idx" ON "permission_profile_permissions"("permission_key");
CREATE INDEX "users_permission_profile_id_idx" ON "users"("permission_profile_id");

ALTER TABLE "permission_profile_permissions" ADD CONSTRAINT "permission_profile_permissions_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "permission_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_permission_profile_id_fkey"
  FOREIGN KEY ("permission_profile_id") REFERENCES "permission_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "roles" ("id", "code", "description")
VALUES
  (gen_random_uuid(), 'ADMINISTRATOR', 'Acesso administrativo operacional preparado para regras futuras'),
  (gen_random_uuid(), 'USER', 'Usuario operacional controlado por perfil de permissoes')
ON CONFLICT ("code") DO NOTHING;
