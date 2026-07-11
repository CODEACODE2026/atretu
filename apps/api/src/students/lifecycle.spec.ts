import assert from "node:assert/strict";
import { BoardMembershipStatus, StudentStatus } from "@prisma/client";
import { canReceiveFutureInvoices } from "./lifecycle.js";

assert.equal(
  canReceiveFutureInvoices({
    status: StudentStatus.ACTIVE,
    boardMemberships: [],
  }),
  true,
);

assert.equal(
  canReceiveFutureInvoices({
    status: StudentStatus.SUSPENDED,
    boardMemberships: [],
  }),
  false,
);

assert.equal(
  canReceiveFutureInvoices({
    status: StudentStatus.TERMINATED,
    boardMemberships: [],
  }),
  false,
);

assert.equal(
  canReceiveFutureInvoices({
    status: StudentStatus.ACTIVE,
    boardMemberships: [{ status: BoardMembershipStatus.ACTIVE }],
  }),
  false,
);

assert.equal(
  canReceiveFutureInvoices({
    status: StudentStatus.ACTIVE,
    boardMemberships: [{ status: BoardMembershipStatus.ENDED }],
  }),
  true,
);
