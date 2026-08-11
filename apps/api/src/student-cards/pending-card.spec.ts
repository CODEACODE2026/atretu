import assert from "node:assert/strict";
import {
  BoardMembershipStatus,
  EnrollmentStatus,
  StudentCardStatus,
  StudentCardType,
  StudentStatus,
} from "@prisma/client";
import { buildPendingCardEnrollmentWhere } from "./pending-card.js";

const base = buildPendingCardEnrollmentWhere({
  academicYearId: "year-1",
  institutionId: "institution-1",
});

assert.equal(base.academicYearId, "year-1");
assert.equal(base.institutionId, "institution-1");
assert.equal(base.status, EnrollmentStatus.ACTIVE);
assert.deepEqual(base.student, { status: StudentStatus.ACTIVE });
assert.deepEqual(base.OR, [
  {
    student: {
      status: StudentStatus.ACTIVE,
      boardMemberships: { some: { status: BoardMembershipStatus.ACTIVE } },
    },
    studentCards: {
      none: {
        status: StudentCardStatus.ACTIVE,
        cardType: StudentCardType.BOARD_MEMBER,
        boardMembership: { is: { status: BoardMembershipStatus.ACTIVE } },
      },
    },
  },
  {
    student: {
      status: StudentStatus.ACTIVE,
      boardMemberships: { none: { status: BoardMembershipStatus.ACTIVE } },
    },
    studentCards: {
      none: {
        status: StudentCardStatus.ACTIVE,
        cardType: StudentCardType.STUDENT,
      },
    },
  },
]);

const withSearch = buildPendingCardEnrollmentWhere({
  student: {
    person: {
      OR: [{ fullName: { contains: "Ana", mode: "insensitive" } }],
    },
  },
});

assert.deepEqual(withSearch.student, {
  person: {
    OR: [{ fullName: { contains: "Ana", mode: "insensitive" } }],
  },
  status: StudentStatus.ACTIVE,
});
assert.deepEqual(withSearch.OR?.[0], {
  student: {
    person: {
      OR: [{ fullName: { contains: "Ana", mode: "insensitive" } }],
    },
    status: StudentStatus.ACTIVE,
    boardMemberships: { some: { status: BoardMembershipStatus.ACTIVE } },
  },
  studentCards: {
    none: {
      status: StudentCardStatus.ACTIVE,
      cardType: StudentCardType.BOARD_MEMBER,
      boardMembership: { is: { status: BoardMembershipStatus.ACTIVE } },
    },
  },
});
