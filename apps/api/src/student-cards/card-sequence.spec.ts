import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const serviceSource = readFileSync(
  join(process.cwd(), "src", "student-cards", "student-cards.service.ts"),
  "utf8",
);
const schemaSource = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);
const migrationSource = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260811170000_sprint_12_7_single_card_sequence",
    "migration.sql",
  ),
  "utf8",
);

assert.match(serviceSource, /SELECT id FROM card_sequences[\s\S]*FOR UPDATE/);
assert.doesNotMatch(serviceSource, /academicYearId_cardType/);
assert.doesNotMatch(serviceSource, /card_type = .*StudentCardType/);
assert.doesNotMatch(serviceSource, /MAX\s*\(\s*sequenceNumber\s*\)\s*\+\s*1/i);

assert.match(schemaSource, /academicYearId\s+String\s+@unique\s+@map\("academic_year_id"\)/);
assert.match(schemaSource, /@@unique\(\[academicYearId, sequenceNumber\]\)/);
assert.match(schemaSource, /@@unique\(\[academicYearId, cardNumber\]\)/);
assert.doesNotMatch(schemaSource, /@@unique\(\[academicYearId, cardType, sequenceNumber\]\)/);

assert.match(migrationSource, /DROP COLUMN IF EXISTS card_type/);
assert.match(migrationSource, /CREATE UNIQUE INDEX student_cards_academic_year_id_sequence_number_key/);
assert.match(migrationSource, /CREATE UNIQUE INDEX card_sequences_academic_year_id_key/);
