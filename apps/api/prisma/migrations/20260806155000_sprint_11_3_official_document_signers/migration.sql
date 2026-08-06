DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardMemberRole') THEN
    CREATE TYPE "BoardMemberRole" AS ENUM (
      'PRESIDENT',
      'VICE_PRESIDENT',
      'TREASURER',
      'SECRETARY',
      'MEMBER'
    );
  END IF;
END $$;

ALTER TABLE "board_memberships"
  ADD COLUMN IF NOT EXISTS "role" "BoardMemberRole" NOT NULL DEFAULT 'MEMBER';

CREATE INDEX IF NOT EXISTS "board_memberships_role_status_started_at_ended_at_idx"
  ON "board_memberships"("role", "status", "started_at", "ended_at");
