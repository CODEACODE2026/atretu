import {
  EnrollmentStatus,
  Prisma,
  StudentCardStatus,
  StudentStatus,
} from "@prisma/client";

export function buildPendingCardEnrollmentWhere(
  enrollmentWhere: Prisma.EnrollmentWhereInput,
): Prisma.EnrollmentWhereInput {
  const { student, ...baseWhere } = enrollmentWhere;
  const studentWhere =
    student &&
    typeof student === "object" &&
    !("is" in student) &&
    !("isNot" in student)
      ? student
      : {};
  return {
    ...baseWhere,
    status: EnrollmentStatus.ACTIVE,
    student: { ...(studentWhere as Prisma.StudentWhereInput), status: StudentStatus.ACTIVE },
    studentCards: { none: { status: StudentCardStatus.ACTIVE } },
  };
}
