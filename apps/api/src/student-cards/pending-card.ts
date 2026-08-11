import {
  BoardMembershipStatus,
  EnrollmentStatus,
  Prisma,
  StudentCardStatus,
  StudentCardType,
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
    OR: [
      {
        student: {
          ...(studentWhere as Prisma.StudentWhereInput),
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
          ...(studentWhere as Prisma.StudentWhereInput),
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
    ],
  };
}
