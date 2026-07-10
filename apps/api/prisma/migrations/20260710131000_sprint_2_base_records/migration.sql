CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "AdministrativeAuditEventType" AS ENUM (
  'BASE_RECORD_CREATED',
  'BASE_RECORD_UPDATED',
  'BASE_RECORD_INACTIVATED',
  'BASE_RECORD_REACTIVATED'
);

CREATE TABLE "institutions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(140) NOT NULL,
  "normalized_name" VARCHAR(140) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shifts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(80) NOT NULL,
  "normalized_name" VARCHAR(80) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "normalized_name" VARCHAR(100) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "buses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "buses_capacity_positive_check" CHECK ("capacity" > 0)
);

CREATE TABLE "administrative_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" "AdministrativeAuditEventType" NOT NULL,
  "user_id" UUID,
  "domain" VARCHAR(40) NOT NULL,
  "record_id" UUID NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "administrative_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutions_normalized_name_key" ON "institutions"("normalized_name");
CREATE INDEX "institutions_status_name_idx" ON "institutions"("status", "name");
CREATE INDEX "institutions_created_at_idx" ON "institutions"("created_at");

CREATE UNIQUE INDEX "shifts_normalized_name_key" ON "shifts"("normalized_name");
CREATE INDEX "shifts_status_name_idx" ON "shifts"("status", "name");
CREATE INDEX "shifts_created_at_idx" ON "shifts"("created_at");

CREATE UNIQUE INDEX "buses_normalized_name_key" ON "buses"("normalized_name");
CREATE INDEX "buses_status_name_idx" ON "buses"("status", "name");
CREATE INDEX "buses_created_at_idx" ON "buses"("created_at");

CREATE INDEX "administrative_audit_logs_domain_record_id_created_at_idx" ON "administrative_audit_logs"("domain", "record_id", "created_at");
CREATE INDEX "administrative_audit_logs_event_type_created_at_idx" ON "administrative_audit_logs"("event_type", "created_at");
CREATE INDEX "administrative_audit_logs_user_id_created_at_idx" ON "administrative_audit_logs"("user_id", "created_at");

ALTER TABLE "administrative_audit_logs"
  ADD CONSTRAINT "administrative_audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
