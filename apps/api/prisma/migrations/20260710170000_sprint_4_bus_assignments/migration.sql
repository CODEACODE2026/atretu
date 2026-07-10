ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BUS_ASSIGNMENT_LINKED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BUS_ASSIGNMENT_RELEASED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BUS_ASSIGNMENT_SWITCHED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BUS_CAPACITY_UPDATED';

CREATE TYPE "BusAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "BusAssignmentEndReason" AS ENUM ('RELEASED', 'SWITCHED');
CREATE TYPE "BusAssignmentEventType" AS ENUM ('LINKED', 'RELEASED', 'SWITCHED');

CREATE TABLE "bus_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" UUID NOT NULL,
  "bus_id" UUID NOT NULL,
  "status" "BusAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "end_reason" "BusAssignmentEndReason",
  "note" VARCHAR(240),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "bus_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bus_assignments_end_state_check"
    CHECK (
      ("status" = 'ACTIVE' AND "ended_at" IS NULL AND "end_reason" IS NULL)
      OR
      ("status" = 'ENDED' AND "ended_at" IS NOT NULL AND "end_reason" IS NOT NULL)
    )
);

CREATE TABLE "bus_assignment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" UUID NOT NULL,
  "bus_assignment_id" UUID,
  "from_bus_id" UUID,
  "to_bus_id" UUID,
  "event_type" "BusAssignmentEventType" NOT NULL,
  "note" VARCHAR(240),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bus_assignment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bus_assignments_one_active_enrollment_key"
  ON "bus_assignments"("enrollment_id")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "bus_assignments_bus_id_status_idx" ON "bus_assignments"("bus_id", "status");
CREATE INDEX "bus_assignments_enrollment_id_status_idx" ON "bus_assignments"("enrollment_id", "status");
CREATE INDEX "bus_assignments_started_at_idx" ON "bus_assignments"("started_at");

CREATE INDEX "bus_assignment_events_enrollment_id_occurred_at_idx" ON "bus_assignment_events"("enrollment_id", "occurred_at");
CREATE INDEX "bus_assignment_events_bus_assignment_id_occurred_at_idx" ON "bus_assignment_events"("bus_assignment_id", "occurred_at");
CREATE INDEX "bus_assignment_events_from_bus_id_occurred_at_idx" ON "bus_assignment_events"("from_bus_id", "occurred_at");
CREATE INDEX "bus_assignment_events_to_bus_id_occurred_at_idx" ON "bus_assignment_events"("to_bus_id", "occurred_at");
CREATE INDEX "bus_assignment_events_event_type_occurred_at_idx" ON "bus_assignment_events"("event_type", "occurred_at");

ALTER TABLE "bus_assignments"
  ADD CONSTRAINT "bus_assignments_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bus_assignments"
  ADD CONSTRAINT "bus_assignments_bus_id_fkey"
  FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bus_assignment_events"
  ADD CONSTRAINT "bus_assignment_events_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bus_assignment_events"
  ADD CONSTRAINT "bus_assignment_events_bus_assignment_id_fkey"
  FOREIGN KEY ("bus_assignment_id") REFERENCES "bus_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bus_assignment_events"
  ADD CONSTRAINT "bus_assignment_events_from_bus_id_fkey"
  FOREIGN KEY ("from_bus_id") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bus_assignment_events"
  ADD CONSTRAINT "bus_assignment_events_to_bus_id_fkey"
  FOREIGN KEY ("to_bus_id") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
