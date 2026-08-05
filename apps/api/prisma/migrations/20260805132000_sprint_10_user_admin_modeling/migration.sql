ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'GESTOR';

ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_BLOCKED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_UNBLOCKED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_PASSWORD_RESET';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_ROLE_CHANGED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_INSTITUTIONS_CHANGED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE IF NOT EXISTS 'USER_STATUS_CHANGED';

ALTER TABLE "users"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "password_changed_at" TIMESTAMPTZ(6),
  ADD COLUMN "blocked_at" TIMESTAMPTZ(6);

INSERT INTO "roles" ("id", "code", "description")
VALUES (gen_random_uuid(), 'GESTOR', 'Perfil gerencial preparado para regras futuras')
ON CONFLICT ("code") DO NOTHING;
