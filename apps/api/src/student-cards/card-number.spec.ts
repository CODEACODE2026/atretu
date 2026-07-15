import "reflect-metadata";
import assert from "node:assert/strict";
import { buildStudentCardNumber } from "./card-number.js";
import { StudentCardValidityFilter } from "./dto/student-cards.dto.js";
import { buildStudentCardValidityWhere } from "./student-cards.service.js";

assert.equal(buildStudentCardNumber(1, 2026), "12026");
assert.equal(buildStudentCardNumber(2, 2026), "22026");
assert.equal(buildStudentCardNumber(25, 2026), "252026");
assert.equal(buildStudentCardNumber(1, 2027), "12027");

assert.throws(() => buildStudentCardNumber(0, 2026), /sequenceNumber/);
assert.throws(() => buildStudentCardNumber(1.5, 2026), /sequenceNumber/);
assert.throws(() => buildStudentCardNumber(1, 1999), /valid academic year/);

assert.deepEqual(
  buildStudentCardValidityWhere(StudentCardValidityFilter.USABLE),
  {
    status: { not: "INVALIDATED" },
    student: { status: { notIn: ["SUSPENDED", "TERMINATED"] } },
    AND: [
      {
        OR: [
          { cardType: { not: "BOARD_MEMBER" } },
          { boardMembership: { is: { status: "ACTIVE" } } },
        ],
      },
      {
        OR: [
          { cardType: { not: "STUDENT" } },
          {
            student: {
              boardMemberships: {
                none: { status: "ACTIVE" },
              },
            },
          },
        ],
      },
    ],
  },
);
assert.deepEqual(
  buildStudentCardValidityWhere(StudentCardValidityFilter.NOT_USABLE),
  {
    NOT: buildStudentCardValidityWhere(StudentCardValidityFilter.USABLE),
  },
);
assert.equal(buildStudentCardValidityWhere(StudentCardValidityFilter.ALL), null);
