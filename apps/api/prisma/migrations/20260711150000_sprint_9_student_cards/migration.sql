ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_CARD_ISSUED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_CARD_INVALIDATED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE 'STUDENT_CARD_ISSUED';
ALTER TYPE "StudentHistoryEventType" ADD VALUE 'STUDENT_CARD_INVALIDATED';

CREATE TYPE "StudentCardType" AS ENUM ('STUDENT', 'BOARD_MEMBER');
CREATE TYPE "StudentCardStatus" AS ENUM ('ACTIVE', 'INVALIDATED');
CREATE TYPE "StudentCardInvalidationReason" AS ENUM (
  'SUPERSEDED_BY_BOARD_CARD',
  'BOARD_MEMBERSHIP_ENDED',
  'STUDENT_TERMINATED',
  'MANUAL_CORRECTION',
  'OTHER'
);

CREATE TABLE "card_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "academic_year_id" uuid NOT NULL,
  "card_type" "StudentCardType" NOT NULL,
  "last_sequence_number" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_sequences_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "student_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "board_membership_id" uuid,
  "card_type" "StudentCardType" NOT NULL,
  "sequence_number" integer NOT NULL,
  "card_number" varchar(32) NOT NULL,
  "status" "StudentCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "issued_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invalidated_at" timestamptz(6),
  "invalidation_reason" "StudentCardInvalidationReason",
  "invalidation_note" varchar(500),
  "issued_by_user_id" uuid,
  "invalidated_by_user_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_cards_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_cards_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_cards_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_cards_board_membership_id_fkey"
    FOREIGN KEY ("board_membership_id") REFERENCES "board_memberships"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_cards_issued_by_user_id_fkey"
    FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "student_cards_invalidated_by_user_id_fkey"
    FOREIGN KEY ("invalidated_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "student_history_events"
  ADD COLUMN "student_card_id" uuid,
  ADD CONSTRAINT "student_history_events_student_card_id_fkey"
    FOREIGN KEY ("student_card_id") REFERENCES "student_cards"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "card_sequences_academic_year_id_card_type_key"
  ON "card_sequences"("academic_year_id", "card_type");
CREATE INDEX "card_sequences_card_type_idx"
  ON "card_sequences"("card_type");

CREATE UNIQUE INDEX "student_cards_academic_year_id_card_type_sequence_number_key"
  ON "student_cards"("academic_year_id", "card_type", "sequence_number");
CREATE UNIQUE INDEX "student_cards_academic_year_id_card_type_card_number_key"
  ON "student_cards"("academic_year_id", "card_type", "card_number");
CREATE UNIQUE INDEX "student_cards_one_active_per_enrollment_idx"
  ON "student_cards"("enrollment_id")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "student_cards_student_id_academic_year_id_idx"
  ON "student_cards"("student_id", "academic_year_id");
CREATE INDEX "student_cards_enrollment_id_idx"
  ON "student_cards"("enrollment_id");
CREATE INDEX "student_cards_board_membership_id_idx"
  ON "student_cards"("board_membership_id");
CREATE INDEX "student_cards_card_type_status_idx"
  ON "student_cards"("card_type", "status");
CREATE INDEX "student_cards_status_issued_at_idx"
  ON "student_cards"("status", "issued_at");
CREATE INDEX "student_history_events_student_card_id_occurred_at_idx"
  ON "student_history_events"("student_card_id", "occurred_at");
