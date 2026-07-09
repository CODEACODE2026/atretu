CREATE TYPE "RoleCode" AS ENUM ('SUPER_ADMIN', 'SECRETARIA');

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "AuditEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'ACCESS_DENIED', 'ADMIN_BOOTSTRAP');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(180) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "last_login_at" TIMESTAMPTZ(6),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" "RoleCode" NOT NULL,
  "description" VARCHAR(180) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "security_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" "AuditEventType" NOT NULL,
  "user_id" UUID,
  "email" VARCHAR(180),
  "ip" VARCHAR(80),
  "user_agent" VARCHAR(255),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

CREATE INDEX "security_audit_logs_event_type_created_at_idx" ON "security_audit_logs"("event_type", "created_at");

CREATE INDEX "security_audit_logs_user_id_created_at_idx" ON "security_audit_logs"("user_id", "created_at");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "roles" ("code", "description")
VALUES
  ('SUPER_ADMIN', 'Acesso completo ao sistema'),
  ('SECRETARIA', 'Acesso operacional administrativo');
