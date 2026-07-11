ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_SUSPENDED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_REACTIVATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_TERMINATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BOARD_MEMBERSHIP_STARTED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'BOARD_MEMBERSHIP_ENDED';

ALTER TYPE "StudentStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "StudentStatus" ADD VALUE 'TERMINATED';

ALTER TYPE "BusAssignmentEndReason" ADD VALUE 'SUSPENSION';
ALTER TYPE "BusAssignmentEndReason" ADD VALUE 'TERMINATION';

ALTER TYPE "BusAssignmentEventType" ADD VALUE 'SUSPENSION_RELEASED';
ALTER TYPE "BusAssignmentEventType" ADD VALUE 'TERMINATION_RELEASED';

CREATE TYPE "StudentHistoryEventType" AS ENUM (
  'STUDENT_SUSPENDED',
  'STUDENT_REACTIVATED',
  'STUDENT_TERMINATED',
  'BOARD_MEMBERSHIP_STARTED',
  'BOARD_MEMBERSHIP_ENDED'
);

CREATE TYPE "StudentSuspensionReason" AS ENUM (
  'NON_PAYMENT',
  'INFRACTION',
  'OTHER'
);

CREATE TYPE "StudentTerminationReason" AS ENUM (
  'WITHDRAWAL',
  'NON_PAYMENT'
);

CREATE TYPE "BoardMembershipStatus" AS ENUM (
  'ACTIVE',
  'ENDED'
);

CREATE TABLE "board_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "status" "BoardMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "started_by_user_id" UUID,
  "ended_by_user_id" UUID,
  "start_note" VARCHAR(500),
  "end_note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "board_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "board_memberships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "board_memberships_started_by_user_id_fkey" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "board_memberships_ended_by_user_id_fkey" FOREIGN KEY ("ended_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "board_memberships_status_consistency_check" CHECK (
    ("status" = 'ACTIVE' AND "ended_at" IS NULL AND "ended_by_user_id" IS NULL)
    OR
    ("status" = 'ENDED' AND "ended_at" IS NOT NULL AND "ended_by_user_id" IS NOT NULL)
  )
);

CREATE TABLE "student_history_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "event_type" "StudentHistoryEventType" NOT NULL,
  "suspension_reason" "StudentSuspensionReason",
  "termination_reason" "StudentTerminationReason",
  "justification" VARCHAR(500),
  "bus_seat_released" BOOLEAN,
  "bus_id" UUID,
  "bus_assignment_id" UUID,
  "board_membership_id" UUID,
  "performed_by_user_id" UUID,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_history_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_history_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_history_events_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_history_events_bus_assignment_id_fkey" FOREIGN KEY ("bus_assignment_id") REFERENCES "bus_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_history_events_board_membership_id_fkey" FOREIGN KEY ("board_membership_id") REFERENCES "board_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_history_events_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_history_events_reason_consistency_check" CHECK (
    ("event_type" = 'STUDENT_SUSPENDED' AND "suspension_reason" IS NOT NULL AND "termination_reason" IS NULL)
    OR
    ("event_type" = 'STUDENT_TERMINATED' AND "termination_reason" IS NOT NULL AND "suspension_reason" IS NULL)
    OR
    ("event_type" NOT IN ('STUDENT_SUSPENDED', 'STUDENT_TERMINATED') AND "suspension_reason" IS NULL AND "termination_reason" IS NULL)
  )
);

CREATE INDEX "board_memberships_student_id_status_idx" ON "board_memberships"("student_id", "status");
CREATE INDEX "board_memberships_status_created_at_idx" ON "board_memberships"("status", "created_at");
CREATE UNIQUE INDEX "board_memberships_one_active_per_student_idx"
  ON "board_memberships"("student_id")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "student_history_events_student_id_occurred_at_idx" ON "student_history_events"("student_id", "occurred_at");
CREATE INDEX "student_history_events_event_type_occurred_at_idx" ON "student_history_events"("event_type", "occurred_at");
CREATE INDEX "student_history_events_bus_assignment_id_occurred_at_idx" ON "student_history_events"("bus_assignment_id", "occurred_at");
CREATE INDEX "student_history_events_board_membership_id_occurred_at_idx" ON "student_history_events"("board_membership_id", "occurred_at");
