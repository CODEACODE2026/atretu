export function buildStudentCardNumber(sequenceNumber: number, year: number) {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error("sequenceNumber must be a positive integer");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("year must be a valid academic year");
  }

  return `${sequenceNumber}${year}`;
}
