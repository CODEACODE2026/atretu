import assert from "node:assert/strict";
import {
  EnrollmentStatus,
  StudentCardStatus,
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
assert.deepEqual(base.studentCards, {
  none: { status: StudentCardStatus.ACTIVE },
});
assert.deepEqual(base.student, { status: StudentStatus.ACTIVE });

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

