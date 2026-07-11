import assert from "node:assert/strict";
import { BoardMembershipStatus, StudentStatus } from "@prisma/client";
import {
  canReceiveFutureInvoices,
  canReenroll,
  getFutureInvoiceBlockingReason,
  getReenrollmentBlockingReason,
} from "./lifecycle.js";

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

assert.equal(
  getFutureInvoiceBlockingReason({
    status: StudentStatus.ACTIVE,
    boardMemberships: [],
  }),
  null,
);

assert.equal(
  getFutureInvoiceBlockingReason({
    status: StudentStatus.SUSPENDED,
    boardMemberships: [],
  }),
  "Academico suspenso nao pode receber nova fatura",
);

assert.equal(
  getFutureInvoiceBlockingReason({
    status: StudentStatus.TERMINATED,
    boardMemberships: [],
  }),
  "Academico desligado nao pode receber nova fatura",
);

assert.equal(
  getFutureInvoiceBlockingReason({
    status: StudentStatus.ACTIVE,
    boardMemberships: [{ status: BoardMembershipStatus.ACTIVE }],
  }),
  "Academico com diretoria ativa nao pode receber nova fatura",
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
  }),
  true,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: true,
  }),
  false,
);

assert.equal(
  getReenrollmentBlockingReason({
    status: StudentStatus.SUSPENDED,
    hasEnrollmentInTargetYear: false,
  }),
  "Academico suspenso exige reativacao antes da rematricula",
);

assert.equal(
  getReenrollmentBlockingReason({
    status: StudentStatus.TERMINATED,
    hasEnrollmentInTargetYear: false,
  }),
  "Academico desligado nao pode ser rematriculado nesta Sprint",
);
