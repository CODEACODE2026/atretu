-- Sprint 12.7: student cards use one global sequence per academic year.
-- Existing duplicated numbers across STUDENT/BOARD_MEMBER are moved to the next
-- available number for the same year before the new unique indexes are created.

WITH duplicate_cards AS (
  SELECT
    sc.id,
    sc.academic_year_id,
    ay.year,
    ROW_NUMBER() OVER (
      PARTITION BY sc.academic_year_id, sc.sequence_number
      ORDER BY sc.issued_at ASC, sc.created_at ASC, sc.id ASC
    ) AS duplicate_rank
  FROM student_cards sc
  JOIN academic_years ay ON ay.id = sc.academic_year_id
),
cards_to_reassign AS (
  SELECT
    id,
    academic_year_id,
    year,
    ROW_NUMBER() OVER (
      PARTITION BY academic_year_id
      ORDER BY duplicate_rank ASC, id ASC
    ) AS reassignment_rank
  FROM duplicate_cards
  WHERE duplicate_rank > 1
),
year_max AS (
  SELECT academic_year_id, COALESCE(MAX(sequence_number), 0) AS max_sequence_number
  FROM student_cards
  GROUP BY academic_year_id
),
new_numbers AS (
  SELECT
    cards_to_reassign.id,
    cards_to_reassign.year,
    year_max.max_sequence_number + cards_to_reassign.reassignment_rank AS sequence_number
  FROM cards_to_reassign
  JOIN year_max ON year_max.academic_year_id = cards_to_reassign.academic_year_id
)
UPDATE student_cards sc
SET
  sequence_number = new_numbers.sequence_number,
  card_number = CONCAT(new_numbers.sequence_number::text, new_numbers.year::text)
FROM new_numbers
WHERE sc.id = new_numbers.id;

WITH sequence_years AS (
  SELECT
    cs.id,
    cs.academic_year_id,
    ROW_NUMBER() OVER (
      PARTITION BY cs.academic_year_id
      ORDER BY cs.created_at ASC, cs.id ASC
    ) AS row_rank,
    MAX(cs.last_sequence_number) OVER (
      PARTITION BY cs.academic_year_id
    ) AS max_sequence_number
  FROM card_sequences cs
),
card_year_max AS (
  SELECT academic_year_id, COALESCE(MAX(sequence_number), 0) AS max_card_sequence_number
  FROM student_cards
  GROUP BY academic_year_id
)
UPDATE card_sequences cs
SET last_sequence_number = GREATEST(
  sequence_years.max_sequence_number,
  COALESCE(card_year_max.max_card_sequence_number, 0)
)
FROM sequence_years
LEFT JOIN card_year_max ON card_year_max.academic_year_id = sequence_years.academic_year_id
WHERE cs.id = sequence_years.id
  AND sequence_years.row_rank = 1;

WITH sequence_years AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY academic_year_id
      ORDER BY created_at ASC, id ASC
    ) AS row_rank
  FROM card_sequences
)
DELETE FROM card_sequences cs
USING sequence_years
WHERE cs.id = sequence_years.id
  AND sequence_years.row_rank > 1;

DROP INDEX IF EXISTS card_sequences_academic_year_id_card_type_key;
DROP INDEX IF EXISTS card_sequences_card_type_idx;
DROP INDEX IF EXISTS student_cards_academic_year_id_card_type_sequence_number_key;
DROP INDEX IF EXISTS student_cards_academic_year_id_card_type_card_number_key;

ALTER TABLE card_sequences DROP COLUMN IF EXISTS card_type;

CREATE UNIQUE INDEX card_sequences_academic_year_id_key
  ON card_sequences(academic_year_id);

CREATE UNIQUE INDEX student_cards_academic_year_id_sequence_number_key
  ON student_cards(academic_year_id, sequence_number);

CREATE UNIQUE INDEX student_cards_academic_year_id_card_number_key
  ON student_cards(academic_year_id, card_number);
