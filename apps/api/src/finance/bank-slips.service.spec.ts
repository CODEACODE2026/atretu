import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BankSlipEnvironment,
  BankSlipIssueBatchItemStatus,
  BankSlipIssueBatchSource,
  BankSlipIssueBatchStatus,
  BankSlipProvider,
  BankSlipSyncRunItemStatus,
  BankSlipSyncRunStatus,
  BankSlipStatus,
  EnrollmentStatus,
  InvoiceCancellationReason,
  InvoiceStatus,
  RecordStatus,
  StudentHistoryEventType,
} from "@prisma/client";
import { BankSlipsService } from "./bank-slips.service.js";
import { SicrediClientError } from "./sicredi-client.js";
import type { SicrediConfig } from "./sicredi-config.js";

process.env.NODE_ENV = "test";

const config: SicrediConfig = {
  environment: "sandbox",
  authUrl: "https://sicredi.test/auth",
  baseUrl: "https://sicredi.test/api",
  apiKey: "secret-api-key",
  username: "user",
  password: "secret-password",
  cooperativa: "6789",
  posto: "03",
  codigoBeneficiario: "12345",
  timeoutMs: 10,
  requirePayerAddress: true,
  syncOpenIssuedEnabled: false,
  syncOpenIssuedIntervalMs: 900_000,
  syncOpenIssuedLimit: 50,
  issueBatchEnabled: false,
  issueBatchIntervalMs: 60_000,
  issueBatchConcurrency: 2,
  issueBatchLimit: 20,
};

async function testIssueBankSlipSuccess() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.issueForInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.seuNumero, "A000000001");
  assert.equal(result.nossoNumero, "251006142");
  assert.equal(sicredi.issueCalls.length, 1);
  assert.equal(sicredi.issueCalls[0]?.seuNumero, "A000000001");
  assert.equal((sicredi.issueCalls[0] as Record<string, unknown>).nossoNumero, undefined);
  assert.equal(prisma.bankSlips[0]?.originalAmountCents, 12050);
  assert.equal(prisma.bankSlips[0]?.txid, "tx-issue-1");
  assert.equal(prisma.historyEvents[0]?.eventType, StudentHistoryEventType.BANK_SLIP_ISSUED);
  assert.equal(
    prisma.auditLogs.some(
      (log) => log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUED,
    ),
    true,
  );
  const auditText = JSON.stringify(prisma.auditLogs);
  assert.doesNotMatch(auditText, /12345678909/);
  assert.doesNotMatch(auditText, /secret-api-key|secret-password|access_token/);
}

async function testIssueUncertainMarksUnknown() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message: "Sicredi request timed out",
    code: "TIMEOUT",
    transient: true,
    uncertain: true,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof ConflictException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.UNKNOWN);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "TIMEOUT");
  assert.equal(
    prisma.auditLogs.some(
      (log) => log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
    ),
    true,
  );
  assert.equal(
    prisma.historyEvents.some(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_ISSUED,
    ),
    false,
  );
}

async function testIssueDiagnosticsTrackServiceStagesSafely() {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousInfo = console.info;
  const logs: string[] = [];
  process.env.NODE_ENV = "development";
  console.info = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message:
      `Boleto nao encontrado CPF 12345678909 nome Aluno Teste endereco Rua Teste ` +
      `authorization Bearer access-1 x-api-key ${config.apiKey} senha ${config.password}`,
    code: "NOT_FOUND",
    statusCode: 404,
    providerStatus: 404,
    providerCode: "NOT_FOUND",
    providerMessage:
      `Boleto nao encontrado CPF 12345678909 nome Aluno Teste endereco Rua Teste ` +
      `authorization Bearer access-1 x-api-key ${config.apiKey} senha ${config.password}`,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);
  try {
    await assert.rejects(
      () => service.issueForInvoice("invoice-1", "user-1"),
      (error) => error instanceof BadRequestException,
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    console.info = previousInfo;
  }

  const log = logs.join("\n");
  assert.match(log, /"etapa":"issue-start"/);
  assert.match(log, /"invoiceId":"invoice-1"/);
  assert.match(log, /"etapa":"before-sicredi-client"/);
  assert.match(log, /"bankSlipId":/);
  assert.match(log, /"seuNumero":"A000000001"/);
  assert.match(log, /"etapa":"issue-catch"/);
  assert.match(log, /"operation":"issueBankSlip"/);
  assert.match(log, /"providerStatus":404/);
  assert.match(log, /"providerCode":"NOT_FOUND"/);
  assert.doesNotMatch(log, /secret-api-key/);
  assert.doesNotMatch(log, /secret-password/);
  assert.doesNotMatch(log, /access-1/);
  assert.doesNotMatch(log, /12345678909/);
  assert.doesNotMatch(log, /Aluno Teste/);
  assert.doesNotMatch(log, /Rua Teste/);
  assert.doesNotMatch(log, /Authorization/i);
  assert.doesNotMatch(log, /x-api-key/i);
  assert.doesNotMatch(log, /Bearer/i);
}

async function testSandboxAllowsDuplicateNossoNumero() {
  const prisma = new FakePrisma();
  prisma.addInvoice("invoice-2");
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const first = await service.issueForInvoice("invoice-1", "user-1");
  const second = await service.issueForInvoice("invoice-2", "user-1");

  assert.equal(first.status, BankSlipStatus.ISSUED);
  assert.equal(second.status, BankSlipStatus.ISSUED);
  assert.equal(first.nossoNumero, "251006142");
  assert.equal(second.nossoNumero, "251006142");
  assert.notEqual(first.seuNumero, second.seuNumero);
  assert.equal(prisma.bankSlips.length, 2);
}

async function testProductionRejectsDuplicateNossoNumeroAfter201() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    environment: BankSlipEnvironment.PRODUCTION,
    nossoNumero: "251006142",
    seuNumero: "A000000001",
  });
  prisma.addInvoice("invoice-2");
  const sicredi = new FakeSicrediClient();
  const productionConfig = { ...config, environment: "production" as const };
  const service = new BankSlipsService(prisma as never, sicredi as never, productionConfig);

  await assert.rejects(
    () => service.issueForInvoice("invoice-2", "user-1"),
    (error) => error instanceof ConflictException,
  );
  const failed = prisma.bankSlips.find((item) => item.invoiceId === "invoice-2");
  assert.equal(failed?.status, BankSlipStatus.UNKNOWN);
  assert.equal(failed?.providerStatus, "ISSUED");
  assert.equal(failed?.providerErrorCode, "BANK_SLIP_PERSISTENCE_CONFLICT");
  assert.equal(failed?.txid, "tx-issue-1");
  assert.equal(failed?.linhaDigitavel, "74891125110061420512803153351030188640000009990");
  assert.equal(failed?.codigoBarras, "74891886400000099901125100614205120315335103");
  assert.equal(
    prisma.auditLogs.some(
      (log) =>
        log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED &&
        (log.metadata as Record<string, unknown>).code === "BANK_SLIP_PERSISTENCE_CONFLICT",
    ),
    true,
  );
}

async function testManualRecoveryDoesNotIssueAgain() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.UNKNOWN,
    nossoNumero: null,
    txid: "tx-issue-1",
    seuNumero: "A000000001",
    linhaDigitavel: "74891125110061420512803153351030188640000009990",
    codigoBarras: "74891886400000099901125100614205120315335103",
    providerStatus: "ISSUED",
    providerErrorCode: "BANK_SLIP_PERSISTENCE_CONFLICT",
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.recoverIssuedFromProviderResponse("invoice-1", "user-1", {
    bankSlipId: "bank-slip-1",
    seuNumero: "A000000001",
    nossoNumero: "251006142",
    linhaDigitavel: "74891125110061420512803153351030188640000009990",
    codigoBarras: "74891886400000099901125100614205120315335103",
    txid: "tx-issue-1",
  });

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.nossoNumero, "251006142");
  assert.equal(result.txid, "tx-issue-1");
  assert.equal(sicredi.issueCalls.length, 0);
  assert.equal(
    prisma.auditLogs.some(
      (log) =>
        log.eventType === AdministrativeAuditEventType.BANK_SLIP_SYNCED &&
        (log.metadata as Record<string, unknown>).recovery === true,
    ),
    true,
  );
}

async function testRetryIssueFailedReusesBankSlip() {
  const prisma = new FakePrisma();
  const createdAt = new Date("2099-01-01T00:00:00.000Z");
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.ISSUE_FAILED,
    nossoNumero: "251000001",
    txid: "old-txid",
    seuNumero: "A000000001",
    linhaDigitavel: "linha-antiga",
    codigoBarras: "codigo-antigo",
    paidAmountCents: 1,
    issuedAt: new Date("2099-01-02T00:00:00.000Z"),
    paidAt: new Date("2099-01-03T00:00:00.000Z"),
    cancelledAt: new Date("2099-01-04T00:00:00.000Z"),
    cancellationRequestedAt: new Date("2099-01-05T00:00:00.000Z"),
    cancellationRequestedByUserId: "user-old",
    cancellationReason: InvoiceCancellationReason.OTHER,
    cancellationNote: "old cancellation",
    lastCheckedAt: new Date("2099-01-06T00:00:00.000Z"),
    providerStatus: "REJECTED",
    providerErrorCode: "FORBIDDEN",
    providerErrorMessage: "Access denied for this environment",
    createdAt,
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.issueForInvoice("invoice-1", "user-1");

  assert.equal(result.id, "bank-slip-1");
  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.seuNumero, "A000000002");
  assert.equal(result.nossoNumero, "251006142");
  assert.equal(result.txid, "tx-issue-1");
  assert.equal(prisma.bankSlips.length, 1);
  assert.equal(prisma.bankSlips[0]?.id, "bank-slip-1");
  assert.equal(prisma.bankSlips[0]?.createdAt, createdAt);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, null);
  assert.equal(prisma.bankSlips[0]?.providerErrorMessage, null);
  assert.equal(prisma.bankSlips[0]?.paidAmountCents, null);
  assert.equal(prisma.bankSlips[0]?.paidAt, null);
  assert.equal(prisma.bankSlips[0]?.cancelledAt, null);
  assert.equal(prisma.bankSlips[0]?.cancellationRequestedAt, null);
  assert.equal(prisma.bankSlips[0]?.cancellationRequestedByUserId, null);
  assert.equal(prisma.bankSlips[0]?.cancellationReason, null);
  assert.equal(prisma.bankSlips[0]?.cancellationNote, null);
  assert.equal(
    prisma.auditLogs.some(
      (log) =>
        log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_REQUESTED &&
        (log.metadata as Record<string, unknown>).previousStatus ===
          BankSlipStatus.ISSUE_FAILED &&
        (log.metadata as Record<string, unknown>).retry === true,
    ),
    true,
  );
}

async function testRetryCancelledReusesBankSlip() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.CANCELLED,
    nossoNumero: "251000001",
    seuNumero: "A000000001",
    linhaDigitavel: "linha-cancelada",
    codigoBarras: "codigo-cancelado",
    cancelledAt: new Date("2099-01-04T00:00:00.000Z"),
    cancellationRequestedAt: new Date("2099-01-05T00:00:00.000Z"),
    cancellationRequestedByUserId: "user-old",
    cancellationReason: InvoiceCancellationReason.OTHER,
    cancellationNote: "old cancellation",
    providerStatus: "BAIXADO POR SOLICITACAO",
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.issueForInvoice("invoice-1", "user-1");

  assert.equal(result.id, "bank-slip-1");
  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.seuNumero, "A000000002");
  assert.equal(prisma.bankSlips.length, 1);
  assert.equal(prisma.bankSlips[0]?.cancelledAt, null);
  assert.equal(prisma.bankSlips[0]?.cancellationRequestedAt, null);
  assert.equal(prisma.bankSlips[0]?.providerErrorMessage, null);
  assert.equal(
    prisma.auditLogs.some(
      (log) =>
        log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_REQUESTED &&
        (log.metadata as Record<string, unknown>).previousStatus ===
          BankSlipStatus.CANCELLED,
    ),
    true,
  );
}

async function testRetryIssueFailureCanFailAgain() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.ISSUE_FAILED,
    nossoNumero: "251000001",
    seuNumero: "A000000001",
    providerErrorCode: "OLD",
    providerErrorMessage: "Old error",
  });
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message: "Access denied for this environment",
    code: "FORBIDDEN",
    statusCode: 403,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(prisma.bankSlips.length, 1);
  assert.equal(prisma.bankSlips[0]?.id, "bank-slip-1");
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUE_FAILED);
  assert.equal(prisma.bankSlips[0]?.seuNumero, "A000000002");
  assert.equal(prisma.bankSlips[0]?.nossoNumero, null);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "FORBIDDEN");
  assert.equal(
    prisma.bankSlips[0]?.providerErrorMessage,
    "Access denied for this environment",
  );
}

async function testRetryIssueUncertainBecomesUnknown() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.ISSUE_FAILED,
    nossoNumero: "251000001",
    seuNumero: "A000000001",
  });
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message: "Sicredi request timed out",
    code: "TIMEOUT",
    transient: true,
    uncertain: true,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof ConflictException,
  );

  assert.equal(prisma.bankSlips.length, 1);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.UNKNOWN);
  assert.equal(prisma.bankSlips[0]?.seuNumero, "A000000002");
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "TIMEOUT");
}

async function testBlockingStatusesStillBlockIssue() {
  for (const status of [
    BankSlipStatus.UNKNOWN,
    BankSlipStatus.PENDING_CANCELLATION,
    BankSlipStatus.PAID,
  ]) {
    const prisma = new FakePrisma();
    prisma.seedIssuedBankSlip({ status });
    const sicredi = new FakeSicrediClient();
    const service = new BankSlipsService(prisma as never, sicredi as never, config);

    await assert.rejects(
      () => service.issueForInvoice("invoice-1", "user-1"),
      (error) => error instanceof ConflictException,
      String(status),
    );
    assert.equal(sicredi.issueCalls.length, 0, String(status));
    assert.equal(prisma.bankSlips.length, 1, String(status));
    assert.equal(prisma.bankSlips[0]?.status, status, String(status));
  }
}

async function testIssuedBankSlipIssueReturnsExisting() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({ status: BankSlipStatus.ISSUED });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const first = await service.issueForInvoice("invoice-1", "user-1");
  const second = await service.issueForInvoice("invoice-1", "user-1");

  assert.equal(first.id, "bank-slip-1");
  assert.equal(second.id, "bank-slip-1");
  assert.equal(second.status, BankSlipStatus.ISSUED);
  assert.equal(second.seuNumero, "A000000001");
  assert.equal(second.nossoNumero, "251006142");
  assert.equal(sicredi.issueCalls.length, 0);
  assert.equal(prisma.bankSlips.length, 1);
}

async function testConcurrentRetryDoesNotDuplicateIssue() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.ISSUE_FAILED,
    nossoNumero: null,
    linhaDigitavel: null,
    codigoBarras: null,
    issuedAt: null,
    providerErrorCode: "OLD",
    providerErrorMessage: "Old error",
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const results = await Promise.allSettled([
    service.issueForInvoice("invoice-1", "user-1"),
    service.issueForInvoice("invoice-1", "user-1"),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" && result.reason instanceof ConflictException,
    ).length,
    1,
  );
  assert.equal(sicredi.issueCalls.length, 1);
  assert.equal(prisma.bankSlips.length, 1);
  assert.equal(prisma.bankSlips[0]?.id, "bank-slip-1");
  assert.equal(prisma.bankSlips[0]?.invoiceId, "invoice-1");
  assert.equal(prisma.historyEvents.length, 1);
}

async function testConcurrentFreshIssueDoesNotDuplicateSicrediCall() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const results = await Promise.allSettled([
    service.issueForInvoice("invoice-1", "user-1"),
    service.issueForInvoice("invoice-1", "user-1"),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ConflictException &&
        (result.reason.getResponse() as Record<string, unknown>).code ===
          "BANK_SLIP_ISSUE_IN_PROGRESS",
    ).length,
    1,
  );
  assert.equal(sicredi.issueCalls.length, 1);
  assert.equal(prisma.bankSlips.length, 1);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testStalePendingIssueBecomesUnknown() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.PENDING_ISSUE,
    nossoNumero: null,
    linhaDigitavel: null,
    codigoBarras: null,
    issuedAt: null,
    updatedAt: new Date(Date.now() - 20 * 60 * 1000),
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof ConflictException,
  );
  assert.equal(sicredi.issueCalls.length, 0);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.UNKNOWN);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "PENDING_ISSUE_STALE");
  assert.equal(
    prisma.auditLogs.some(
      (log) => log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
    ),
    true,
  );
}

async function testFreshPendingIssueStaysPending() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.PENDING_ISSUE,
    nossoNumero: null,
    linhaDigitavel: null,
    codigoBarras: null,
    issuedAt: null,
    updatedAt: new Date(),
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) =>
      error instanceof ConflictException &&
      (error.getResponse() as Record<string, unknown>).code ===
        "BANK_SLIP_ISSUE_IN_PROGRESS",
  );
  assert.equal(sicredi.issueCalls.length, 0);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.PENDING_ISSUE);
  assert.equal(prisma.auditLogs.length, 0);
}

async function testConcurrentSeuNumeroGeneration() {
  const prisma = new FakePrisma();
  prisma.addInvoice("invoice-2");
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const [first, second] = await Promise.all([
    service.issueForInvoice("invoice-1", "user-1"),
    service.issueForInvoice("invoice-2", "user-1"),
  ]);

  assert.notEqual(first.seuNumero, second.seuNumero);
  assert.deepEqual(
    prisma.bankSlips.map((bankSlip) => bankSlip.seuNumero),
    ["A000000001", "A000000002"],
  );
}

async function testSyncPaidMarksInvoicePaid() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.PAID);
  assert.equal(result.paidAmountCents, 12050);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
  assert.equal(
    prisma.historyEvents.some(
      (event) =>
        event.eventType === StudentHistoryEventType.BANK_SLIP_PAYMENT_CONFIRMED,
    ),
    true,
  );
}

async function testSyncPaidByDay() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncPaidByDay("2099-08-11", "user-1");

  assert.equal(result.paymentsConfirmed, 1);
  assert.equal(result.bankSlipsFound, 1);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
}

async function testOpenIssuedSyncLockPreventsDuplicateRun() {
  const prisma = new FakePrisma();
  prisma.syncLockAvailable = false;
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.status, BankSlipSyncRunStatus.SKIPPED_ALREADY_RUNNING);
  assert.equal(sicredi.getCalls.length, 0);
  assert.equal(prisma.syncRuns.length, 1);
}

async function testOpenIssuedSyncConfirmsPaymentTransactionally() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.status, BankSlipSyncRunStatus.COMPLETED);
  assert.equal(result.scannedCount, 1);
  assert.equal(result.paidCount, 1);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.PAID);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
  assert.ok(prisma.bankSlips[0]?.lastCheckedAt);
  assert.equal(prisma.syncRunItems[0]?.status, BankSlipSyncRunItemStatus.PAID);
}

async function testOpenIssuedSyncIsIdempotentForAlreadyPaidInvoice() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({ status: BankSlipStatus.PAID });
  (prisma.invoiceRecord as Record<string, unknown>).status = InvoiceStatus.PAID;
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.scannedCount, 0);
  assert.equal(sicredi.getCalls.length, 0);
  assert.equal(
    prisma.historyEvents.filter(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_PAYMENT_CONFIRMED,
    ).length,
    0,
  );
}

async function testOpenIssuedSyncRecordsProviderErrorsWithoutStoppingBatch() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({ id: "bank-slip-1", invoiceId: "invoice-1" });
  prisma.addInvoice("invoice-2");
  prisma.seedIssuedBankSlip({
    id: "bank-slip-2",
    invoiceId: "invoice-2",
    seuNumero: "A000000002",
    nossoNumero: "251006143",
  });
  const sicredi = new FakeSicrediClient();
  sicredi.getErrorsByNossoNumero.set(
    "251006142",
    new SicrediClientError({
      operation: "getBankSlip",
      message: "Forbidden",
      statusCode: 403,
      code: "FORBIDDEN",
    }),
  );
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.status, BankSlipSyncRunStatus.COMPLETED_WITH_ERRORS);
  assert.equal(result.scannedCount, 2);
  assert.equal(result.errorCount, 1);
  assert.equal(result.paidCount, 1);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.bankSlips[1]?.status, BankSlipStatus.PAID);
  assert.equal(prisma.syncRunItems[0]?.status, BankSlipSyncRunItemStatus.ERROR);
  assert.equal(prisma.syncRunItems[1]?.status, BankSlipSyncRunItemStatus.PAID);
}

async function testOpenIssuedSyncHandles4044295xxAndTimeoutSafely() {
  const cases = [
    { statusCode: 401, code: "AUTH", expected: "SICREDI_AUTHENTICATION_FAILED" },
    { statusCode: 404, code: "NOT_FOUND", expected: "SICREDI_NOT_FOUND" },
    { statusCode: 429, code: "RATE_LIMIT", expected: "SICREDI_TEMPORARILY_UNAVAILABLE" },
    { statusCode: 500, code: "SERVER_ERROR", expected: "SICREDI_TEMPORARILY_UNAVAILABLE" },
    { statusCode: undefined, code: "TIMEOUT", expected: "SICREDI_TEMPORARILY_UNAVAILABLE" },
  ];

  for (const item of cases) {
    const prisma = new FakePrisma();
    prisma.seedIssuedBankSlip();
    const sicredi = new FakeSicrediClient();
    sicredi.getError = new SicrediClientError({
      operation: "getBankSlip",
      message: item.code,
      statusCode: item.statusCode,
      code: item.code,
      transient: item.statusCode === 429 || item.statusCode === 500 || item.code === "TIMEOUT",
      uncertain: item.statusCode === 429 || item.statusCode === 500 || item.code === "TIMEOUT",
    });
    const service = new BankSlipsService(prisma as never, sicredi as never, config);

    const result = await service.syncOpenIssued("user-1");

    assert.equal(result.status, BankSlipSyncRunStatus.COMPLETED_WITH_ERRORS);
    assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
    assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
    assert.equal(prisma.syncRunItems[0]?.errorCode, item.expected);
    assert.ok(prisma.bankSlips[0]?.lastCheckedAt);
  }
}

async function testOpenIssuedSyncPartialPaymentDoesNotQuitInvoice() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextPaidAmount = "60.25";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.status, BankSlipSyncRunStatus.COMPLETED_WITH_ERRORS);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "PARTIAL_PAYMENT_REVIEW");
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
  assert.equal(prisma.syncRunItems[0]?.status, BankSlipSyncRunItemStatus.PARTIAL_PAYMENT_REVIEW);
}

async function testOpenIssuedSyncVencidoKeepsInvoiceOpen() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "VENCIDO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.status, BankSlipSyncRunStatus.COMPLETED);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.bankSlips[0]?.providerStatus, "VENCIDO");
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
}

async function testOpenIssuedSyncBaixadoExternallyKeepsInvoiceOpen() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "BAIXADO POR SOLICITACAO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncOpenIssued("user-1");

  assert.equal(result.cancelledCount, 1);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.CANCELLED);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "BAIXA_EXTERNA_REVIEW");
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
  assert.equal(prisma.syncRunItems[0]?.status, BankSlipSyncRunItemStatus.CANCELLED);
  assert.equal(
    prisma.auditLogs.some(
      (log) =>
        log.eventType === AdministrativeAuditEventType.BANK_SLIP_SYNCED &&
        (log.metadata as Record<string, unknown>).reviewCode === "BAIXA_EXTERNA_REVIEW" &&
        (log.metadata as Record<string, unknown>).invoiceKeptOpen === true,
    ),
    true,
  );
}

async function testExternalCancellationByInvoiceKeepsInvoiceOpen() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "BAIXADO POR SOLICITACAO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.CANCELLED);
  assert.equal(result.providerErrorCode, "BAIXA_EXTERNA_REVIEW");
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
  assert.equal(
    prisma.historyEvents.some(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLED,
    ),
    false,
  );
}

async function testSyncUnknownStatusPreservesCurrentState() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "EM CARTORIO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.providerStatus, "EM CARTORIO");
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
}

async function testSyncRejectedStatusPreservesCurrentState() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "REJEITADO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testSyncPaidDoesNotRegress() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({ status: BankSlipStatus.PAID });
  (prisma.invoiceRecord as Record<string, unknown>).status = InvoiceStatus.PAID;
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "EM CARTEIRA";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.PAID);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
}

async function testSync404DoesNotAlterState() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.getError = new SicrediClientError({
    operation: "getBankSlip",
    message: "Nosso Numero nao encontrado",
    statusCode: 404,
    code: "NAO_ENCONTRADO",
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.syncByInvoice("invoice-1", "user-1"),
    (error) => error instanceof NotFoundException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testCancellationRequestStaysPending() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.requestCancellation("invoice-1", "user-1", {
    reason: InvoiceCancellationReason.OTHER,
    note: "Pedido manual",
  });

  assert.equal(result.status, BankSlipStatus.PENDING_CANCELLATION);
  assert.equal(result.providerStatus, "MOVIMENTO_ENVIADO");
  assert.ok(prisma.bankSlips[0]?.cancellationRequestedAt);
  assert.equal(prisma.bankSlips[0]?.cancellationRequestedByUserId, "user-1");
  assert.equal(prisma.bankSlips[0]?.cancellationReason, InvoiceCancellationReason.OTHER);
  assert.equal(prisma.bankSlips[0]?.cancellationNote, "Pedido manual");
  assert.equal(
    prisma.historyEvents.some(
      (event) =>
        event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLATION_REQUESTED,
    ),
    true,
  );
}

async function testCancellationReasonRequired() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(() =>
    service.requestCancellation("invoice-1", "user-1", {} as never),
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testCancellationTimeoutStaysPending() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.cancelError = new SicrediClientError({
    operation: "requestCancellation",
    message: "Gateway timeout",
    statusCode: 504,
    code: "504",
    transient: true,
    uncertain: true,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () =>
      service.requestCancellation("invoice-1", "user-1", {
        reason: InvoiceCancellationReason.OTHER,
      }),
    (error) => error instanceof ServiceUnavailableException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.PENDING_CANCELLATION);
  assert.notEqual(prisma.bankSlips[0]?.status, BankSlipStatus.CANCELLATION_FAILED);
}

async function testCancellationAlreadyCancelledConfirmsBySync() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.cancelError = new SicrediClientError({
    operation: "requestCancellation",
    message: "Boleto ja baixado",
    statusCode: 422,
    code: "BOLETO_BAIXADO",
  });
  sicredi.nextStatus = "BAIXADO POR SOLICITACAO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () =>
      service.requestCancellation("invoice-1", "user-1", {
        reason: InvoiceCancellationReason.OTHER,
      }),
    (error) => error instanceof ConflictException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.CANCELLED);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.CANCELLED);
}

async function testCancellationNotFoundPreservesPreviousStatus() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.cancelError = new SicrediClientError({
    operation: "requestCancellation",
    message: "Nosso Numero nao encontrado",
    statusCode: 404,
    code: "NAO_ENCONTRADO",
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () =>
      service.requestCancellation("invoice-1", "user-1", {
        reason: InvoiceCancellationReason.OTHER,
      }),
    (error) => error instanceof NotFoundException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
}

async function testCancellationConfirmedBySyncCancelsInvoice() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "BAIXADO POR SOLICITACAO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await service.requestCancellation("invoice-1", "user-1", {
    reason: InvoiceCancellationReason.OTHER,
    note: "Pedido manual",
  });
  prisma.auditLogs.unshift({
    eventType: AdministrativeAuditEventType.BANK_SLIP_CANCELLATION_REQUESTED,
    userId: "wrong-user",
    metadata: { reason: InvoiceCancellationReason.DUPLICATE },
  });
  const result = await service.syncByInvoice("invoice-1", "user-2");

  assert.equal(result.status, BankSlipStatus.CANCELLED);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.CANCELLED);
  assert.equal(
    (prisma.invoiceRecord as Record<string, unknown>).cancellationReason,
    InvoiceCancellationReason.OTHER,
  );
  assert.equal((prisma.invoiceRecord as Record<string, unknown>).cancelledByUserId, "user-1");
  assert.equal((prisma.invoiceRecord as Record<string, unknown>).cancellationNote, "Pedido manual");
  assert.equal(prisma.auditFindFirstCalls, 0);
  assert.equal(
    prisma.historyEvents.some(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLED,
    ),
    true,
  );

  const repeated = await service.syncByInvoice("invoice-1", "user-2");
  assert.equal(repeated.status, BankSlipStatus.CANCELLED);
  assert.equal(
    prisma.historyEvents.filter(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLED,
    ).length,
    1,
  );
}

async function testPdfUsesStoredLinhaDigitavel() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const pdf = await service.getPdf("invoice-1");

  assert.equal(pdf.contentType, "application/pdf");
  assert.equal(pdf.bytes.toString(), "%PDF-1.4");
  assert.equal(sicredi.pdfLinhaDigitavel, "74891125110061420512803153351030188640000009990");
}

async function testPdfErrorsAreMappedSafely() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.pdfError = new SicrediClientError({
    operation: "getPdf",
    message: "Forbidden secret-api-key",
    statusCode: 403,
    code: "FORBIDDEN",
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(() => service.getPdf("invoice-1"), /Operacao nao autorizada/);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testPayerManualLimits() {
  const prisma = new FakePrisma();
  prisma.invoiceRecord.student.person.fullName = "A".repeat(41);
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  prisma.invoiceRecord.student.person.fullName = "Aluno Teste";
  prisma.invoiceRecord.student.person.addressCity = "C".repeat(26);
  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  prisma.invoiceRecord.student.person.addressCity = "Curitiba";
  prisma.invoiceRecord.student.person.addressState = "PAR";
  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  prisma.invoiceRecord.student.person.addressState = "PR";
  prisma.invoiceRecord.student.person.addressZipCode = "123";
  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );
}

async function testIssueBatchCreationDeduplicatesAndSkipsIneligible() {
  const prisma = new FakePrisma();
  prisma.addInvoice("invoice-2");
  (prisma.invoices.get("invoice-2") as Record<string, unknown>).status = InvoiceStatus.PAID;
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  const batch = await service.createIssueBatch(
    { invoiceIds: ["invoice-1", "invoice-1", "invoice-2"] },
    "user-1",
  );

  assert.equal(batch.totalItems, 2);
  assert.equal(batch.queuedItems, 1);
  assert.equal(batch.skippedItems, 1);
  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.QUEUED);
  assert.equal(prisma.issueBatchItems[1]?.status, BankSlipIssueBatchItemStatus.SKIPPED);
  assert.equal(prisma.issueBatchItems[1]?.lastErrorCode, "INVOICE_ALREADY_PAID");
}

async function testIssueBatchPreviewByInstitution() {
  const prisma = new FakePrisma();
  prisma.addEnrollment("enrollment-2", "student-2");
  prisma.addEnrollment("enrollment-3", "student-3");
  prisma.addInvoice("invoice-paid", {
    enrollmentId: "enrollment-3",
    studentId: "student-3",
    status: InvoiceStatus.PAID,
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const preview = await service.previewIssueBatch({
    institutionId: "institution-1",
    amountCents: 12050,
    dueDate: "2099-08-10",
    page: 1,
    limit: 20,
  });

  assert.equal(preview.institutionId, "institution-1");
  assert.equal(preview.totalEnrollmentsFound, 3);
  assert.equal(preview.totalInvoicesFound, 2);
  assert.equal(preview.totalEligible, 2);
  assert.equal(preview.totalWillCreateInvoices, 1);
  assert.equal(preview.totalExistingInvoiceEligible, 1);
  assert.equal(preview.totalAlreadyPaid, 1);
  assert.equal(preview.totalMissingInvoice, 1);
  assert.equal(preview.totalBlocked, 1);
  assert.equal(preview.unitAmountCents, 12050);
  assert.equal(preview.eligibleAmountCents, 24100);
  assert.equal(preview.items.length, 3);
  assert.equal(prisma.issueBatches.length, 0);
  assert.equal(sicredi.issueCalls.length, 0);
}

async function testIssueBatchCreationByInstitutionCreatesSkippedItems() {
  const prisma = new FakePrisma();
  prisma.addEnrollment("enrollment-2", "student-2");
  prisma.addInvoice("invoice-paid", {
    enrollmentId: "enrollment-2",
    studentId: "student-2",
    status: InvoiceStatus.PAID,
  });
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  const batch = await service.createIssueBatch(
    {
      source: BankSlipIssueBatchSource.INSTITUTION,
      institutionId: "institution-1",
      amountCents: 12050,
      dueDate: "2099-08-10",
      createMissingInvoices: true,
    },
    "user-1",
  );

  assert.equal(batch.totalItems, 2);
  assert.equal(batch.queuedItems, 1);
  assert.equal(batch.skippedItems, 1);
  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.QUEUED);
  assert.equal(prisma.issueBatchItems[1]?.status, BankSlipIssueBatchItemStatus.SKIPPED);
  assert.equal(prisma.issueBatches[0]?.source, BankSlipIssueBatchSource.INSTITUTION);
  assert.equal(prisma.issueBatches[0]?.institutionId, "institution-1");
  assert.equal(prisma.issueBatches[0]?.competence, "2099-08");
  assert.equal(prisma.issueBatches[0]?.totalStudents, 2);
  assert.equal(prisma.issueBatches[0]?.totalInvoices, 2);
  assert.equal(prisma.issueBatches[0]?.totalEligible, 1);
  assert.equal(prisma.issueBatches[0]?.totalValueCents, 12050);
}

async function testInstitutionIssueBatchCreatesMissingInvoiceAndRejectsInvalidInput() {
  const prisma = new FakePrisma();
  prisma.addEnrollment("enrollment-2", "student-2");
  prisma.addEnrollment("blocked-enrollment", "student-blocked");
  const blockedEnrollment = prisma.enrollments.get("blocked-enrollment");
  assert.ok(blockedEnrollment);
  (blockedEnrollment.student.person as Record<string, unknown>).cpf = "";
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  await assert.rejects(
    () => service.previewIssueBatch({
      institutionId: "institution-1",
      amountCents: 0,
      dueDate: "2099-08-10",
      page: 1,
      limit: 20,
    }),
    /positive integer|Valor/,
  );
  await assert.rejects(
    () => service.previewIssueBatch({
      institutionId: "institution-1",
      amountCents: -1,
      dueDate: "2099-08-10",
      page: 1,
      limit: 20,
    }),
    /positive integer|Valor/,
  );
  await assert.rejects(
    () => service.previewIssueBatch({
      institutionId: "institution-1",
      amountCents: 12050,
      dueDate: "10\\/08\\/2099",
      page: 1,
      limit: 20,
    }),
    /YYYY-MM-DD/,
  );

  const beforeInvoices = prisma.invoices.size;
  const preview = await service.previewIssueBatch({
    institutionId: "institution-1",
    amountCents: 12050,
    dueDate: "2099-08-10",
    page: 1,
    limit: 20,
  });
  assert.equal(prisma.invoices.size, beforeInvoices);
  assert.equal(preview.totalWillCreateInvoices, 1);
  assert.equal(preview.totalBlocked, 1);
  assert.equal(preview.totalInvalidOrMissingCpfCnpj, 1);

  const batch = await service.createIssueBatch(
    {
      source: BankSlipIssueBatchSource.INSTITUTION,
      institutionId: "institution-1",
      amountCents: 12050,
      dueDate: "2099-08-10",
      createMissingInvoices: true,
    },
    "user-1",
  );

  assert.equal(batch.totalItems, 3);
  assert.equal(prisma.invoices.size, beforeInvoices + 1);
  const created = [...prisma.invoices.values()].find((invoice) => invoice.enrollmentId === "enrollment-2");
  assert.ok(created);
  assert.equal(created.amountCents, 12050);
  assert.equal(created.dueDate.toISOString(), "2099-08-10T00:00:00.000Z");
  assert.equal(prisma.issueBatchItems.filter((item) => item.status === BankSlipIssueBatchItemStatus.QUEUED).length, 2);
  const blockedItem = prisma.issueBatchItems.find((item) => item.studentId === "student-blocked");
  assert.ok(blockedItem);
  assert.equal(blockedItem.invoiceId, null);
  assert.equal(blockedItem.status, BankSlipIssueBatchItemStatus.SKIPPED);
  assert.equal(blockedItem.lastErrorCode, "PAYER_DATA_INCOMPLETE");
  assert.equal(prisma.historyEvents.some((event) => event.eventType === StudentHistoryEventType.INVOICE_CREATED), true);
}

async function testInstitutionIssueBatchConcurrentCreationDoesNotDuplicateInvoice() {
  const prisma = new FakePrisma();
  prisma.addEnrollment("enrollment-2", "student-2");
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);
  const beforeInvoices = prisma.invoices.size;

  await Promise.all([
    service.createIssueBatch(
      {
        source: BankSlipIssueBatchSource.INSTITUTION,
        institutionId: "institution-1",
        amountCents: 12050,
        dueDate: "2099-08-10",
        createMissingInvoices: true,
      },
      "user-1",
    ),
    service.createIssueBatch(
      {
        source: BankSlipIssueBatchSource.INSTITUTION,
        institutionId: "institution-1",
        amountCents: 12050,
        dueDate: "2099-08-10",
        createMissingInvoices: true,
      },
      "user-1",
    ),
  ]);

  assert.equal(prisma.invoices.size, beforeInvoices + 1);
  assert.equal(
    [...prisma.invoices.values()].filter((invoice) => invoice.enrollmentId === "enrollment-2").length,
    1,
  );
}

async function testIssueBatchBlocksInvoiceAlreadyQueuedInActiveBatch() {
  const prisma = new FakePrisma();
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");
  const second = await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");

  assert.equal(second.totalItems, 1);
  assert.equal(second.queuedItems, 0);
  assert.equal(second.skippedItems, 1);
  assert.equal(prisma.issueBatchItems[1]?.lastErrorCode, "BANK_SLIP_ISSUE_IN_PROGRESS");
}

async function testInstitutionIssueBatchDoesNotDuplicateActiveBatchItems() {
  const prisma = new FakePrisma();
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  const first = await service.createIssueBatch(
    {
      source: BankSlipIssueBatchSource.INSTITUTION,
      institutionId: "institution-1",
      amountCents: 12050,
      dueDate: "2099-08-10",
      createMissingInvoices: true,
    },
    "user-1",
  );
  const beforeItems = prisma.issueBatchItems.length;

  const duplicatePreview = await service.previewIssueBatch({
    institutionId: "institution-1",
    amountCents: 12050,
    dueDate: "2099-08-10",
    page: 1,
    limit: 20,
  });

  assert.equal(first.queuedItems, 1);
  assert.equal(duplicatePreview.totalEligible, 0);
  assert.equal(duplicatePreview.totalBlocked, 1);
  assert.equal(duplicatePreview.items[0]?.eligibilityCode, "BANK_SLIP_ISSUE_IN_PROGRESS");
  await assert.rejects(
    () => service.createIssueBatch(
      {
        source: BankSlipIssueBatchSource.INSTITUTION,
        institutionId: "institution-1",
        amountCents: 12050,
        dueDate: "2099-08-10",
        createMissingInvoices: true,
      },
      "user-1",
    ),
    /Nenhuma fatura elegivel/,
  );
  assert.equal(prisma.issueBatchItems.length, beforeItems);
}

async function testInstitutionPreviewScopeAndBlockingRules() {
  const prisma = new FakePrisma();
  prisma.addInstitution("institution-2");
  prisma.addEnrollment("foreign-enrollment", "student-foreign", { institutionId: "institution-2" });
  prisma.addInvoice("foreign-invoice", {
    enrollmentId: "foreign-enrollment",
    studentId: "student-foreign",
  });
  prisma.addEnrollment("conflict-enrollment", "student-conflict");
  prisma.addInvoice("conflict-invoice", {
    enrollmentId: "conflict-enrollment",
    studentId: "student-conflict",
    amountCents: 9999,
  });
  prisma.addInvoice("issued-invoice", { enrollmentId: "enrollment-1", studentId: "student-1" });
  prisma.seedIssuedBankSlip({ invoiceId: "issued-invoice" });
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  const preview = await service.previewIssueBatch({
    institutionId: "institution-1",
    amountCents: 12050,
    dueDate: "2099-08-10",
    page: 1,
    limit: 20,
  });

  assert.equal(preview.totalEnrollmentsFound, 2);
  assert.equal(preview.totalInvoicesFound, 3);
  assert.equal(preview.totalWithActiveBankSlip, 1);
  assert.equal(preview.totalInvoiceAmountConflict, 1);
  assert.equal(preview.items.some((item) => item.enrollmentId === "foreign-enrollment"), false);

  const emptyCompetence = await service.previewIssueBatch({
    institutionId: "institution-1",
    amountCents: 12050,
    dueDate: "2099-09-10",
    page: 1,
    limit: 20,
  });
  assert.equal(emptyCompetence.totalInvoicesFound, 0);
  assert.equal(emptyCompetence.totalMissingInvoice, 2);

  await assert.rejects(
    () => service.previewIssueBatch({
      institutionId: "institution-missing",
      amountCents: 12050,
      dueDate: "2099-08-10",
      page: 1,
      limit: 20,
    }),
    /Instituicao ativa nao encontrada/,
  );
}

async function testIssueBatchReportIncludesInstitutionSummary() {
  const prisma = new FakePrisma();
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);
  const batch = await service.createIssueBatch(
    {
      source: BankSlipIssueBatchSource.INSTITUTION,
      institutionId: "institution-1",
      amountCents: 12050,
      dueDate: "2099-08-10",
      createMissingInvoices: true,
    },
    "user-1",
  );
  await service.processIssueBatchQueue();
  const updated = prisma.issueBatches.find((item) => item.id === batch.id);
  assert.ok(updated);
  assert.equal(updated.institutionId, "institution-1");
  assert.equal(updated.competence, "2099-08");
  assert.equal(updated.totalStudents, 1);
  assert.equal(updated.totalInvoices, 1);
  assert.equal(updated.totalEligible, 1);
  assert.equal(updated.totalValueCents, 12050);
  const metadata = updated.metadata as { report?: { issuedAmountCents?: number } };
  assert.equal(metadata.report?.issuedAmountCents, 12050);
}

async function testIssueBatchListUsesNormalizedFiltersAndKeepsOldBatchCompatible() {
  const prisma = new FakePrisma();
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);
  await service.createIssueBatch(
    {
      source: BankSlipIssueBatchSource.INSTITUTION,
      institutionId: "institution-1",
      amountCents: 12050,
      dueDate: "2099-08-10",
      createMissingInvoices: true,
    },
    "user-1",
  );
  prisma.issueBatches.push({
    id: "old-manual-batch",
    status: BankSlipIssueBatchStatus.COMPLETED,
    source: BankSlipIssueBatchSource.MANUAL,
    institutionId: null,
    competence: null,
    dueDate: null,
    shiftId: null,
    totalStudents: 0,
    totalInvoices: 1,
    totalEligible: 1,
    totalValueCents: 0,
    totalItems: 1,
    queuedItems: 0,
    processingItems: 0,
    issuedItems: 1,
    skippedItems: 0,
    failedItems: 0,
    unknownItems: 0,
    cancelledItems: 0,
    requestedByUserId: "user-1",
    metadata: { report: { issuedAmountCents: 12050 } },
    startedAt: null,
    finishedAt: new Date(),
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const institutionBatches = await service.listIssueBatches({
    page: 1,
    limit: 20,
    source: BankSlipIssueBatchSource.INSTITUTION,
    institutionId: "institution-1",
    competence: "2099-08",
  });
  assert.equal(institutionBatches.pagination.total, 1);
  assert.equal(institutionBatches.data[0]?.source, BankSlipIssueBatchSource.INSTITUTION);
  assert.equal(institutionBatches.data[0]?.institution?.name, "Instituicao Teste");

  const allBatches = await service.listIssueBatches({ page: 1, limit: 20 });
  assert.equal(allBatches.pagination.total, 2);
  assert.equal(allBatches.data.some((batch) => batch.id === "old-manual-batch"), true);
}

function testIssueBatchMigrationBackfillsMetadata() {
  const sql = readFileSync(
    "prisma/migrations/20260717183500_normalize_bank_slip_issue_batches/migration.sql",
    "utf8",
  );
  assert.match(sql, /CREATE TYPE "BankSlipIssueBatchSource"/);
  assert.match(sql, /ADD COLUMN "institution_id" UUID/);
  assert.match(sql, /ADD COLUMN "competence" VARCHAR\(7\)/);
  assert.equal(sql.includes("\"metadata\"#>>'{filters,institutionId}'"), true);
  assert.equal(sql.includes("\"metadata\"#>>'{previewSummary,totalEligible}'"), true);
  assert.match(sql, /bank_slip_issue_batches_institution_id_competence_idx/);
  assert.match(sql, /FOREIGN KEY \("institution_id"\) REFERENCES "institutions"\("id"\)/);
}

async function testIssueBatchProcessesSuccess() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const batch = await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");
  const result = await service.processIssueBatchQueue();

  assert.equal(result.processed, 1);
  assert.equal(sicredi.issueCalls.length, 1);
  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.ISSUED);
  assert.equal(prisma.issueBatches.find((item) => item.id === batch.id)?.status, BankSlipIssueBatchStatus.COMPLETED);
}

async function testIssueBatchProcessorLockPreventsDuplicateExecution() {
  const prisma = new FakePrisma();
  prisma.issueBatchLockAvailable = false;
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");
  const result = await service.processIssueBatchQueue();

  assert.equal(result.skipped, true);
  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.QUEUED);
}

async function testIssueBatchUnknownDoesNotRetry() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message: "Timeout",
    code: "TIMEOUT",
    transient: true,
    uncertain: true,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");
  await service.processIssueBatchQueue();
  await assert.rejects(
    () => service.retryFailedIssueBatch("issue-batch-1", "user-1", { reason: "retry" }),
    (error) => error instanceof ConflictException,
  );

  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.UNKNOWN);
  assert.equal(sicredi.issueCalls.length, 1);
}

async function testIssueBatchHandles4295xxAndPersistenceConflictAsUnknown() {
  const cases = [
    new SicrediClientError({
      operation: "issueBankSlip",
      message: "Rate limit",
      code: "RATE_LIMIT",
      statusCode: 429,
      transient: true,
      uncertain: true,
    }),
    new SicrediClientError({
      operation: "issueBankSlip",
      message: "Server error",
      code: "SERVER_ERROR",
      statusCode: 500,
      transient: true,
      uncertain: true,
    }),
  ];
  for (const issueError of cases) {
    const prisma = new FakePrisma();
    const sicredi = new FakeSicrediClient();
    sicredi.issueError = issueError;
    const service = new BankSlipsService(prisma as never, sicredi as never, config);

    await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");
    await service.processIssueBatchQueue();

    assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.UNKNOWN);
  }

  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    environment: BankSlipEnvironment.PRODUCTION,
    nossoNumero: "251006142",
    seuNumero: "A000000001",
  });
  prisma.addInvoice("invoice-2");
  const service = new BankSlipsService(
    prisma as never,
    new FakeSicrediClient() as never,
    { ...config, environment: "production" },
  );
  await service.createIssueBatch({ invoiceIds: ["invoice-2"] }, "user-1");
  await service.processIssueBatchQueue();
  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.UNKNOWN);
  assert.equal(prisma.issueBatchItems[0]?.lastErrorCode, "BANK_SLIP_ISSUE_PERSISTENCE_CONFLICT");
}

async function testIssueBatchCancelAndRetrySafeFailure() {
  const prisma = new FakePrisma();
  prisma.addInvoice("invoice-2");
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message: "Rejected",
    code: "REJECTED",
    statusCode: 400,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const batch = await service.createIssueBatch({ invoiceIds: ["invoice-1", "invoice-2"] }, "user-1");
  await service.cancelIssueBatch(batch.id, "user-1", { reason: "Pausar lote" });
  assert.equal(prisma.issueBatchItems[0]?.status, BankSlipIssueBatchItemStatus.CANCELLED);
  assert.equal(prisma.issueBatchItems[1]?.status, BankSlipIssueBatchItemStatus.CANCELLED);

  const retryBatch = await service.createIssueBatch({ invoiceIds: ["invoice-1"] }, "user-1");
  await service.processIssueBatchQueue();
  assert.equal(prisma.issueBatchItems[2]?.status, BankSlipIssueBatchItemStatus.FAILED);
  sicredi.issueError = undefined;
  await service.retryFailedIssueBatch(retryBatch.id, "user-1", { reason: "Erro corrigido" });
  await service.processIssueBatchQueue();
  assert.equal(prisma.issueBatchItems[2]?.status, BankSlipIssueBatchItemStatus.ISSUED);
}

class FakeSicrediClient {
  issueCalls: Array<Record<string, unknown>> = [];
  getCalls: string[] = [];
  issueError?: SicrediClientError;
  getError?: SicrediClientError;
  getErrorsByNossoNumero = new Map<string, SicrediClientError>();
  cancelError?: SicrediClientError;
  pdfError?: SicrediClientError;
  pdfLinhaDigitavel?: string;
  nextStatus = "LIQUIDADO";
  nextPaidAmount = "120.50";

  async issueBankSlip(input: Record<string, unknown>) {
    this.issueCalls.push(input);
    if (this.issueError) {
      throw this.issueError;
    }
    return {
      nossoNumero: "251006142",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      cooperativa: "6789",
      posto: "03",
      txid: "tx-issue-1",
    };
  }

  async getBankSlip(nossoNumero = "251006142") {
    this.getCalls.push(nossoNumero);
    const mappedError = this.getErrorsByNossoNumero.get(nossoNumero);
    if (mappedError) {
      throw mappedError;
    }
    if (this.getError) {
      throw this.getError;
    }
    const isPaid = this.nextStatus.startsWith("LIQUIDADO");
    return {
      nossoNumero,
      seuNumero: nossoNumero === "251006143" ? "A000000002" : "A000000001",
      situacao: this.nextStatus,
      valorNominal: "120.50",
      dataVencimento: "2099-08-10",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      dadosLiquidacao: isPaid
        ? { data: "2099-08-11", valor: this.nextPaidAmount }
        : undefined,
    };
  }

  async *iteratePaidBankSlipsByDay() {
    yield {
      items: [
        {
          nossoNumero: "251006142",
          seuNumero: "A000000001",
          dataPagamento: "2099-08-11",
          valor: "120.50",
          valorLiquidado: "120.50",
          tipoLiquidacao: "LIQUIDADO",
        },
      ],
      hasNext: false,
    };
  }

  async requestCancellation() {
    if (this.cancelError) {
      throw this.cancelError;
    }
    return {
      transactionId: "tx-1",
      dataMovimento: "2099-08-11",
      codigoBeneficiario: "12345",
      nossoNumero: "251006142",
      cooperativa: "6789",
      posto: "03",
      statusComando: "MOVIMENTO_ENVIADO",
    };
  }

  async getPdf(linhaDigitavel: string) {
    if (this.pdfError) {
      throw this.pdfError;
    }
    this.pdfLinhaDigitavel = linhaDigitavel;
    return {
      bytes: Buffer.from("%PDF-1.4"),
      contentType: "application/pdf",
      sizeBytes: 8,
      filename: "boleto-test.pdf",
    };
  }
}

class FakePrisma {
  invoices = new Map([["invoice-1", createInvoice("invoice-1")]]);
  institutions = new Map([
    ["institution-1", { id: "institution-1", name: "Instituicao Teste", status: RecordStatus.ACTIVE }],
  ]);
  enrollments = new Map([
    ["enrollment-1", createEnrollment("enrollment-1", "student-1")],
  ]);
  bankSlips: Array<Record<string, unknown>> = [];
  issueBatches: Array<Record<string, unknown>> = [];
  issueBatchItems: Array<Record<string, unknown>> = [];
  syncRuns: Array<Record<string, unknown>> = [];
  syncRunItems: Array<Record<string, unknown>> = [];
  historyEvents: Array<Record<string, unknown>> = [];
  auditLogs: Array<Record<string, unknown>> = [];
  auditFindFirstCalls = 0;
  syncLockAvailable = true;
  issueBatchLockAvailable = true;
  private bankSlipIdSequence = 0;
  private issueBatchIdSequence = 0;
  private issueBatchItemIdSequence = 0;
  private syncRunIdSequence = 0;
  private syncRunItemIdSequence = 0;
  private transactionQueue = Promise.resolve();

  get invoiceRecord() {
    const invoice = this.invoices.get("invoice-1");
    assert.ok(invoice);
    return invoice;
  }

  studentHistoryEvent = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.historyEvents.push(data);
      return data;
    },
  };

  administrativeAuditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.auditLogs.push(data);
      return data;
    },
    findFirst: async () => {
      this.auditFindFirstCalls += 1;
      return null;
    },
  };

  invoiceDelegate = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.invoiceWithBankSlip(where.id),
    findMany: async ({ where }: { where?: { id?: { in?: string[] }; enrollmentId?: { in?: string[] }; dueDate?: Date | { gte?: Date; lt?: Date } } } = {}) => {
      const ids = where?.id?.in;
      const enrollmentIds = where?.enrollmentId?.in;
      const invoices = [...this.invoices.values()];
      return (ids ? invoices.filter((invoice) => ids.includes(invoice.id)) : invoices)
        .filter((invoice) => !enrollmentIds || enrollmentIds.includes(invoice.enrollmentId))
        .filter((invoice) => this.matchesDateWhere(invoice.dueDate, where?.dueDate))
        .map((invoice) => this.invoiceWithBankSlip(invoice.id));
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const invoice = this.invoices.get(where.id);
      assert.ok(invoice);
      Object.assign(invoice, data);
      return this.invoiceWithBankSlip(where.id);
    },
    upsert: async ({
      where,
      create,
    }: {
      where: { idempotencyKey: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => {
      const existing = [...this.invoices.values()].find(
        (invoice) => invoice.idempotencyKey === where.idempotencyKey,
      );
      if (existing) {
        return this.invoiceWithBankSlip(existing.id);
      }
      const id = `invoice-${this.invoices.size + 1}`;
      this.invoices.set(id, createInvoice(id, create));
      return this.invoiceWithBankSlip(id);
    },
  };

  bankSlip = {
    findUnique: async ({ where }: { where: { id?: string; invoiceId?: string } }) =>
      where.invoiceId
        ? this.bankSlipWithInvoiceId(where.invoiceId)
        : this.bankSlipWithInvoice(String(where.id)),
    findMany: async (args?: { take?: number }) => {
      const records = this.bankSlips
        .filter((item) => {
          const invoice = this.invoices.get(String(item.invoiceId));
          return item.status === BankSlipStatus.ISSUED && invoice?.status === InvoiceStatus.OPEN;
        })
        .map((item) => this.bankSlipWithInvoice(String(item.id)))
        .filter(Boolean);
      return args?.take ? records.slice(0, args.take) : records;
    },
    findFirst: async (args?: { select?: { seuNumero?: boolean } }) => {
      const record = this.bankSlips.at(-1);
      if (!record) {
        return null;
      }
      return args?.select?.seuNumero ? { seuNumero: record.seuNumero } : this.bankSlipWithInvoice(String(record.id));
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.bankSlipIdSequence += 1;
      const record = {
        id: `bank-slip-${this.bankSlipIdSequence}`,
        provider: BankSlipProvider.SICREDI,
        environment: BankSlipEnvironment.SANDBOX,
        createdAt: new Date(),
        updatedAt: new Date(),
        nossoNumero: null,
        txid: null,
        linhaDigitavel: null,
        codigoBarras: null,
        paidAmountCents: null,
        issuedAt: null,
        paidAt: null,
        cancelledAt: null,
        cancellationRequestedAt: null,
        cancellationRequestedByUserId: null,
        cancellationReason: null,
        cancellationNote: null,
        lastCheckedAt: null,
        providerStatus: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        ...data,
      };
      this.bankSlips.push(record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.bankSlips.find((item) => item.id === where.id);
      assert.ok(record);
      const nextProvider = data.provider ?? record.provider;
      const nextEnvironment = data.environment ?? record.environment;
      const nextNossoNumero = data.nossoNumero ?? record.nossoNumero;
      if (
        nextEnvironment === BankSlipEnvironment.PRODUCTION &&
        nextNossoNumero &&
        this.bankSlips.some(
          (item) =>
            item.id !== where.id &&
            item.provider === nextProvider &&
            item.environment === nextEnvironment &&
            item.nossoNumero === nextNossoNumero,
        )
      ) {
        throw { code: "P2002", meta: { target: "bank_slips_provider_production_nosso_numero_key" } };
      }
      Object.assign(record, data, { updatedAt: new Date() });
      return this.bankSlipWithInvoice(where.id);
    },
  };

  invoice = this.invoiceDelegate;

  institution = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.institutions.get(where.id) ?? null,
  };

  enrollment = {
    findMany: async ({
      where,
    }: {
      where?: { institutionId?: string; status?: EnrollmentStatus; shiftId?: string };
    } = {}) =>
      [...this.enrollments.values()].filter(
        (enrollment) =>
          (!where?.institutionId || enrollment.institutionId === where.institutionId) &&
          (!where?.status || enrollment.status === where.status) &&
          (!where?.shiftId || enrollment.shiftId === where.shiftId),
      ),
  };

  bankSlipSyncRun = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.syncRunIdSequence += 1;
      const record = {
        id: `sync-run-${this.syncRunIdSequence}`,
        status: BankSlipSyncRunStatus.RUNNING,
        scannedCount: 0,
        updatedCount: 0,
        paidCount: 0,
        cancelledCount: 0,
        errorCount: 0,
        startedAt: new Date(),
        finishedAt: null,
        ...data,
      };
      this.syncRuns.push(record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.syncRuns.find((item) => item.id === where.id);
      assert.ok(record);
      Object.assign(record, data);
      return record;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.syncRuns.find((item) => item.id === where.id) ?? null,
    findMany: async () => this.syncRuns,
    count: async () => this.syncRuns.length,
  };

  bankSlipSyncRunItem = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.syncRunItemIdSequence += 1;
      const record = {
        id: `sync-run-item-${this.syncRunItemIdSequence}`,
        attempts: 1,
        checkedAt: new Date(),
        ...data,
      };
      this.syncRunItems.push(record);
      return record;
    },
    findMany: async ({ where }: { where: { runId: string } }) =>
      this.syncRunItems.filter((item) => item.runId === where.runId),
    count: async ({ where }: { where: { runId: string } }) =>
      this.syncRunItems.filter((item) => item.runId === where.runId).length,
  };

  bankSlipIssueBatch = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.issueBatchIdSequence += 1;
      const record = {
        id: `issue-batch-${this.issueBatchIdSequence}`,
        status: BankSlipIssueBatchStatus.DRAFT,
        source: BankSlipIssueBatchSource.MANUAL,
        institutionId: null,
        competence: null,
        dueDate: null,
        shiftId: null,
        totalStudents: 0,
        totalInvoices: 0,
        totalEligible: 0,
        unitAmountCents: 0,
        totalValueCents: 0,
        totalItems: 0,
        queuedItems: 0,
        processingItems: 0,
        issuedItems: 0,
        skippedItems: 0,
        failedItems: 0,
        unknownItems: 0,
        cancelledItems: 0,
        startedAt: null,
        finishedAt: null,
        cancelledAt: null,
        cancelledByUserId: null,
        cancelReason: null,
        requestedByUserId: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.issueBatches.push(record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.issueBatches.find((item) => item.id === where.id);
      assert.ok(record);
      Object.assign(record, data, { updatedAt: new Date() });
      return this.withIssueBatchIncludes(record);
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const record = this.issueBatches.find((item) => item.id === where.id);
      return record ? this.withIssueBatchIncludes(record) : null;
    },
    findMany: async ({
      where,
      skip,
      take,
    }: {
      where?: Record<string, unknown>;
      skip?: number;
      take?: number;
    } = {}) => {
      const records = this.issueBatches
        .filter((item) => this.matchesWhere(item, where ?? {}))
        .map((item) => this.withIssueBatchIncludes(item));
      return records.slice(skip ?? 0, typeof take === "number" ? (skip ?? 0) + take : undefined);
    },
    count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      this.issueBatches.filter((item) => this.matchesWhere(item, where ?? {})).length,
  };

  bankSlipIssueBatchItem = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.issueBatchItemIdSequence += 1;
      const record = {
        id: `issue-batch-item-${this.issueBatchItemIdSequence}`,
        status: BankSlipIssueBatchItemStatus.QUEUED,
        attempts: 0,
        nextAttemptAt: null,
        lockedAt: null,
        startedAt: null,
        finishedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        skipReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.issueBatchItems.push(record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.issueBatchItems.find((item) => item.id === where.id);
      assert.ok(record);
      Object.assign(record, this.applyUpdateData(record, data), { updatedAt: new Date() });
      return record;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const records = this.issueBatchItems.filter((item) => this.matchesWhere(item, where));
      records.forEach((record) => {
        Object.assign(record, this.applyUpdateData(record, data), { updatedAt: new Date() });
      });
      return { count: records.length };
    },
    findUnique: async ({ where, include }: { where: { id: string }; include?: Record<string, unknown> }) => {
      const record = this.issueBatchItems.find((item) => item.id === where.id);
      if (!record) {
        return null;
      }
      return include?.batch ? { ...record, batch: this.issueBatches.find((batch) => batch.id === record.batchId) } : record;
    },
    findMany: async ({ where, include }: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) =>
      this.issueBatchItems
        .filter((item) => this.matchesWhere(item, where ?? {}))
        .map((item) =>
          include?.invoice
            ? { ...item, invoice: this.invoices.get(String(item.invoiceId)) ?? null }
            : item,
        ),
    count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      this.issueBatchItems.filter((item) => this.matchesWhere(item, where ?? {})).length,
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    const previous = this.transactionQueue;
    let release: () => void = () => undefined;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback(this);
    } finally {
      release();
    }
  }

  async $queryRaw(strings?: TemplateStringsArray, ...values: unknown[]) {
    const query = Array.isArray(strings) ? strings.join("") : "";
    if (query.includes("pg_try_advisory_lock")) {
      return [{ locked: values.includes(7_811_005) ? this.issueBatchLockAvailable : this.syncLockAvailable }];
    }
    if (query.includes("pg_advisory_unlock")) {
      return [{ unlocked: true }];
    }
    return [{ id: "locked" }];
  }

  private applyUpdateData(record: Record<string, unknown>, data: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value && typeof value === "object" && "increment" in value
          ? Number(record[key] ?? 0) + Number((value as { increment: number }).increment)
          : value,
      ]),
    );
  }

  private withIssueBatchIncludes(record: Record<string, unknown>) {
    const institutionId = typeof record.institutionId === "string" ? record.institutionId : null;
    const shiftId = typeof record.shiftId === "string" ? record.shiftId : null;
    return {
      ...record,
      institution: institutionId ? this.institutions.get(institutionId) ?? null : null,
      shift: shiftId ? { id: shiftId, name: "Manha" } : null,
    };
  }

  private matchesWhere(record: Record<string, unknown>, where: Record<string, unknown>) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "batch" || key === "OR") {
        return true;
      }
      if (value && typeof value === "object" && "in" in value) {
        return (value as { in: unknown[] }).in.includes(record[key]);
      }
      if (value && typeof value === "object" && "not" in value) {
        return record[key] !== (value as { not: unknown }).not;
      }
      if (value instanceof Date && record[key] instanceof Date) {
        return (record[key] as Date).getTime() === value.getTime();
      }
      return record[key] === value;
    });
  }

  seedIssuedBankSlip(overrides: Record<string, unknown> = {}) {
    this.bankSlipIdSequence = Math.max(this.bankSlipIdSequence, 1);
    this.bankSlips.push({
      id: "bank-slip-1",
      invoiceId: "invoice-1",
      provider: BankSlipProvider.SICREDI,
      environment: BankSlipEnvironment.SANDBOX,
      status: BankSlipStatus.ISSUED,
      documentSpecies: "RECIBO",
      nossoNumero: "251006142",
      txid: null,
      seuNumero: "A000000001",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      originalAmountCents: 12050,
      paidAmountCents: null,
      issuedAt: new Date(),
      paidAt: null,
      cancelledAt: null,
      cancellationRequestedAt: null,
      cancellationRequestedByUserId: null,
      cancellationReason: null,
      cancellationNote: null,
      lastCheckedAt: null,
      providerStatus: "ISSUED",
      providerErrorCode: null,
      providerErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    (this.invoiceRecord as Record<string, unknown>).bankSlip = this.bankSlips[0];
  }

  addInstitution(id: string, overrides: Record<string, unknown> = {}) {
    this.institutions.set(id, {
      id,
      name: `Instituicao ${id}`,
      status: RecordStatus.ACTIVE,
      ...overrides,
    });
  }

  addEnrollment(id: string, studentId: string, overrides: Record<string, unknown> = {}) {
    this.enrollments.set(id, createEnrollment(id, studentId, overrides));
  }

  addInvoice(id: string, overrides: Record<string, unknown> = {}) {
    this.invoices.set(id, createInvoice(id, overrides));
  }

  private invoiceWithBankSlip(id: string) {
    const invoice = this.invoices.get(id);
    assert.ok(invoice);
    const bankSlip = this.bankSlips.find((item) => item.invoiceId === id) ?? null;
    return {
      ...invoice,
      bankSlip,
    };
  }

  private bankSlipWithInvoice(id: string) {
    const record = this.bankSlips.find((item) => item.id === id);
    return record ? { ...record, invoice: this.invoiceWithBankSlip(String(record.invoiceId)) } : null;
  }

  private bankSlipWithInvoiceId(invoiceId: string) {
    const record = this.bankSlips.find((item) => item.invoiceId === invoiceId);
    return record ? { ...record, invoice: this.invoiceWithBankSlip(invoiceId) } : null;
  }

  private matchesDateWhere(date: Date, where: Date | { gte?: Date; lt?: Date } | undefined) {
    if (!where) {
      return true;
    }
    if (where instanceof Date) {
      return date.getTime() === where.getTime();
    }
    return (!where.gte || date.getTime() >= where.gte.getTime()) &&
      (!where.lt || date.getTime() < where.lt.getTime());
  }
}

function createEnrollment(id: string, studentId: string, overrides: Record<string, unknown> = {}) {
  const institutionId = String(overrides.institutionId ?? "institution-1");
  return {
    id,
    studentId,
    academicYearId: "academic-year-1",
    institutionId,
    shiftId: "shift-1",
    course: "Ensino Medio",
    grade: "1",
    status: EnrollmentStatus.ACTIVE,
    institution: { id: institutionId, name: `Instituicao ${institutionId}`, status: RecordStatus.ACTIVE },
    shift: { id: "shift-1", name: "Manha", status: RecordStatus.ACTIVE },
    student: {
      id: studentId,
      person: createPerson(studentId),
      guardian: null,
    },
    ...overrides,
  };
}

function createInvoice(id: string, overrides: Record<string, unknown> = {}) {
  const enrollmentId = String(overrides.enrollmentId ?? "enrollment-1");
  const studentId = String(overrides.studentId ?? "student-1");
  return {
    id,
    studentId,
    enrollmentId,
    amountCents: 12050,
    dueDate: new Date("2099-08-10T00:00:00.000Z"),
    status: InvoiceStatus.OPEN,
    description: null,
    idempotencyKey: `invoice-${id}`,
    createdByUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationNote: null,
    createdAt: new Date("2099-08-01T00:00:00.000Z"),
    updatedAt: new Date("2099-08-01T00:00:00.000Z"),
    enrollment: createEnrollment(enrollmentId, studentId),
    student: {
      id: studentId,
      person: createPerson(studentId),
    },
    bankSlip: null,
    ...overrides,
  };
}

function createPerson(studentId: string) {
  return {
    id: `person-${studentId}`,
    fullName: `Aluno ${studentId}`,
    cpf: "12345678909",
    addressStreet: "Rua Teste",
    addressCity: "Curitiba",
    addressZipCode: "80000-000",
    addressState: "PR",
    phone: null,
    email: null,
  };
}

await testIssueBankSlipSuccess();
await testIssueUncertainMarksUnknown();
await testIssueDiagnosticsTrackServiceStagesSafely();
await testSandboxAllowsDuplicateNossoNumero();
await testProductionRejectsDuplicateNossoNumeroAfter201();
await testManualRecoveryDoesNotIssueAgain();
await testRetryIssueFailedReusesBankSlip();
await testRetryCancelledReusesBankSlip();
await testRetryIssueFailureCanFailAgain();
await testRetryIssueUncertainBecomesUnknown();
await testBlockingStatusesStillBlockIssue();
await testIssuedBankSlipIssueReturnsExisting();
await testConcurrentRetryDoesNotDuplicateIssue();
await testConcurrentFreshIssueDoesNotDuplicateSicrediCall();
await testStalePendingIssueBecomesUnknown();
await testFreshPendingIssueStaysPending();
await testConcurrentSeuNumeroGeneration();
await testSyncPaidMarksInvoicePaid();
await testSyncPaidByDay();
await testOpenIssuedSyncLockPreventsDuplicateRun();
await testOpenIssuedSyncConfirmsPaymentTransactionally();
await testOpenIssuedSyncIsIdempotentForAlreadyPaidInvoice();
await testOpenIssuedSyncRecordsProviderErrorsWithoutStoppingBatch();
await testOpenIssuedSyncHandles4044295xxAndTimeoutSafely();
await testOpenIssuedSyncPartialPaymentDoesNotQuitInvoice();
await testOpenIssuedSyncVencidoKeepsInvoiceOpen();
await testOpenIssuedSyncBaixadoExternallyKeepsInvoiceOpen();
await testExternalCancellationByInvoiceKeepsInvoiceOpen();
await testSyncUnknownStatusPreservesCurrentState();
await testSyncRejectedStatusPreservesCurrentState();
await testSyncPaidDoesNotRegress();
await testSync404DoesNotAlterState();
await testCancellationRequestStaysPending();
await testCancellationReasonRequired();
await testCancellationTimeoutStaysPending();
await testCancellationAlreadyCancelledConfirmsBySync();
await testCancellationNotFoundPreservesPreviousStatus();
await testCancellationConfirmedBySyncCancelsInvoice();
await testPdfUsesStoredLinhaDigitavel();
await testPdfErrorsAreMappedSafely();
await testPayerManualLimits();
await testIssueBatchCreationDeduplicatesAndSkipsIneligible();
await testIssueBatchPreviewByInstitution();
await testIssueBatchCreationByInstitutionCreatesSkippedItems();
await testInstitutionIssueBatchCreatesMissingInvoiceAndRejectsInvalidInput();
await testInstitutionIssueBatchConcurrentCreationDoesNotDuplicateInvoice();
await testIssueBatchBlocksInvoiceAlreadyQueuedInActiveBatch();
await testInstitutionIssueBatchDoesNotDuplicateActiveBatchItems();
await testInstitutionPreviewScopeAndBlockingRules();
await testIssueBatchReportIncludesInstitutionSummary();
await testIssueBatchListUsesNormalizedFiltersAndKeepsOldBatchCompatible();
testIssueBatchMigrationBackfillsMetadata();
await testIssueBatchProcessesSuccess();
await testIssueBatchProcessorLockPreventsDuplicateExecution();
await testIssueBatchUnknownDoesNotRetry();
await testIssueBatchHandles4295xxAndPersistenceConflictAsUnknown();
await testIssueBatchCancelAndRetrySafeFailure();
