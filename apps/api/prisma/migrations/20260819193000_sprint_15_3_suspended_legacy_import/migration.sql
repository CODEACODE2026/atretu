ALTER TABLE "legacy_student_imports"
ALTER COLUMN "student_card_id" DROP NOT NULL,
ALTER COLUMN "previous_card_sequence_number" DROP NOT NULL,
ALTER COLUMN "generated_card_number" DROP NOT NULL;
