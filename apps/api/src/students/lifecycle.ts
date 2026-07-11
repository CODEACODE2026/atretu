import { BoardMembershipStatus, StudentStatus } from "@prisma/client";

export function canReceiveFutureInvoices(input: {
  status: StudentStatus;
  boardMemberships: Array<{ status: BoardMembershipStatus }>;
}) {
  return (
    input.status === StudentStatus.ACTIVE &&
    !input.boardMemberships.some(
      (membership) => membership.status === BoardMembershipStatus.ACTIVE,
    )
  );
}

export function getReenrollmentBlockingReason(input: {
  status: StudentStatus;
  hasEnrollmentInTargetYear: boolean;
}) {
  if (input.status === StudentStatus.SUSPENDED) {
    return "Academico suspenso exige reativacao antes da rematricula";
  }
  if (input.status === StudentStatus.TERMINATED) {
    return "Academico desligado nao pode ser rematriculado nesta Sprint";
  }
  if (input.hasEnrollmentInTargetYear) {
    return "Academico ja possui matricula neste Ano Letivo";
  }
  return null;
}

export function canReenroll(input: {
  status: StudentStatus;
  hasEnrollmentInTargetYear: boolean;
}) {
  return getReenrollmentBlockingReason(input) === null;
}
