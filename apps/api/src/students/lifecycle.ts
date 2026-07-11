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
