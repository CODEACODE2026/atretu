ALTER TABLE "board_memberships"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" DROP NOT NULL;

UPDATE "board_memberships"
SET "role" = NULL
WHERE "role" = 'MEMBER';
