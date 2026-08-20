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
    latestEnrollmentYear: 2024,
    destinationYear: 2025,
  }),
  true,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2024,
    destinationYear: 2026,
  }),
  true,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2025,
    destinationYear: 2026,
  }),
  true,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: true,
    latestEnrollmentYear: 2026,
    destinationYear: 2026,
  }),
  false,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2026,
    destinationYear: 2026,
  }),
  false,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2026,
    destinationYear: 2025,
  }),
  false,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2026,
    destinationYear: 2024,
  }),
  false,
);

assert.equal(
  canReenroll({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2024,
    destinationYear: 2026,
  }),
  true,
);

assert.equal(
  canReenroll({
    status: StudentStatus.TERMINATED,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2024,
    destinationYear: 2026,
  }),
  false,
);

assert.equal(
  canReenroll({
    status: StudentStatus.SUSPENDED,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2024,
    destinationYear: 2026,
  }),
  false,
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

assert.equal(
  getReenrollmentBlockingReason({
    status: StudentStatus.ACTIVE,
    hasEnrollmentInTargetYear: false,
    latestEnrollmentYear: 2026,
    destinationYear: 2025,
  }),
  "Ano de destino deve ser posterior a matricula mais recente do academico",
);
