import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, "..");
const repoRoot = resolve(apiDir, "../..");
const rootEnv = readEnvFile(resolve(repoRoot, ".env"));
const databaseUrl = process.env.DATABASE_URL ?? rootEnv.DATABASE_URL;
const setupToken =
  process.env.ADMIN_SETUP_TOKEN ?? rootEnv.ADMIN_SETUP_TOKEN ?? "bank-slip-smoke-token";
const jwtSecret =
  process.env.JWT_SECRET ?? rootEnv.JWT_SECRET ?? "bank-slip-smoke-jwt-secret";
const apiPort = Number(process.env.SMOKE_BANK_SLIPS_API_PORT ?? 3371);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const runId = `s11-${Date.now()}`;
const adminEmail = `bank-slip-admin-${runId}@atretu.local`;
const secretaryEmail = `bank-slip-secretaria-${runId}@atretu.local`;
const adminPassword = `SmokeBankSlip123!${runId}`;
const secretaryPassword = `SmokeBankSlip456!${runId}`;
const cpfSeedBase = 700000000 + (Date.now() % 80000000);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Sprint 11 bank slip smoke");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const mock = createSicrediMock();
let apiProcess;

try {
  const mockBaseUrl = await mock.start();
  apiProcess = await startApi(mockBaseUrl);
  await waitForHealth();

  await ensureSmokeUsers();
  const { adminCookie, secretaryCookie, adminUser, secretaryUser } =
    await loginSmokeUsers();

  await assertBlocked(
    () => request("/finance/invoices/not-a-uuid/bank-slip", { headers: json() }),
    401,
    "Anonymous bank slip access allowed",
  );
  await assertBlocked(
    () =>
      request("/finance/bank-slips/sync-paid-day", {
        method: "POST",
        headers: json(secretaryCookie),
        body: JSON.stringify({ date: todayOnly() }),
      }),
    403,
    "Secretaria accessed sync-paid-day",
  );

  const base = await createBaseFixture(adminCookie);

  const success = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "success",
    amountCents: 12050,
    dueDate: futureDate(30),
  });
  const anonymousPdf = await request(
    `/finance/invoices/${success.invoice.id}/bank-slip/pdf`,
    { headers: json() },
  );
  expect(anonymousPdf.response.status === 401, "Anonymous PDF access allowed");

  mock.queueIssue("success");
  const issued = await issueBankSlip(secretaryCookie, success.invoice.id);
  expect(issued.status === "ISSUED", "BankSlip was not issued");
  expect(Boolean(issued.nossoNumero), "Nosso Numero was not returned");
  expect(/^A\d{9}$/.test(issued.seuNumero), "Seu Numero format is invalid");
  expect(Boolean(issued.linhaDigitavel), "Linha digitavel was not returned");
  expect(Boolean(issued.codigoBarras), "Codigo de barras was not returned");
  expect(Boolean(issued.issuedAt), "issuedAt was not stored");

  const issuedRecord = await prisma.bankSlip.findUnique({
    where: { invoiceId: success.invoice.id },
  });
  expect(issuedRecord?.status === "ISSUED", "Database BankSlip is not ISSUED");
  expect(issuedRecord?.seuNumero === issued.seuNumero, "Seu Numero mismatch");

  const duplicateIssue = await request(
    `/finance/invoices/${success.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(duplicateIssue.response.status === 409, "Duplicate issue was not blocked");

  const beforeSyncHistory = await historyCount(success.invoice.id, [
    "BANK_SLIP_ISSUED",
    "BANK_SLIP_PAYMENT_CONFIRMED",
  ]);
  mock.setQueryStatus(issued.nossoNumero, "EM CARTEIRA");
  const synced = await syncBankSlip(secretaryCookie, success.invoice.id);
  expect(synced.status === "ISSUED", "EM CARTEIRA did not keep BankSlip ISSUED");
  expect(Boolean(synced.lastCheckedAt), "lastCheckedAt was not stored");
  const afterSyncHistory = await historyCount(success.invoice.id, [
    "BANK_SLIP_ISSUED",
    "BANK_SLIP_PAYMENT_CONFIRMED",
  ]);
  expect(
    afterSyncHistory === beforeSyncHistory,
    "Sync without functional change duplicated history",
  );

  mock.setQueryStatus(issued.nossoNumero, "LIQUIDADO");
  const paid = await syncBankSlip(secretaryCookie, success.invoice.id);
  expect(paid.status === "PAID", "LIQUIDADO did not mark BankSlip PAID");
  expect(paid.paidAmountCents === 12050, "Paid amount was not stored");
  const paidInvoice = await prisma.invoice.findUnique({
    where: { id: success.invoice.id },
  });
  expect(paidInvoice?.status === "PAID", "Invoice was not marked PAID");
  expect(Boolean(paid.paidAt), "paidAt was not stored");
  const paymentHistoryOnce = await historyCount(success.invoice.id, [
    "BANK_SLIP_PAYMENT_CONFIRMED",
  ]);
  expect(paymentHistoryOnce === 1, "Payment history was not recorded once");
  await syncBankSlip(secretaryCookie, success.invoice.id);
  const paymentHistoryTwice = await historyCount(success.invoice.id, [
    "BANK_SLIP_PAYMENT_CONFIRMED",
  ]);
  expect(paymentHistoryTwice === 1, "Repeated sync duplicated payment history");

  const pastDue = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "past-due",
    amountCents: 5000,
    dueDate: pastDate(15),
  });
  const pastIssue = await request(
    `/finance/invoices/${pastDue.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(pastIssue.response.status === 400, "Past due invoice issued BankSlip");
  const pastSlip = await prisma.bankSlip.findUnique({
    where: { invoiceId: pastDue.invoice.id },
  });
  expect(!pastSlip, "Past due invoice created BankSlip");

  const missingAddress = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "missing-address",
    amountCents: 5100,
    dueDate: futureDate(30),
    missingAddress: true,
  });
  const missingAddressIssue = await request(
    `/finance/invoices/${missingAddress.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(
    missingAddressIssue.response.status === 400 &&
      JSON.stringify(missingAddressIssue.body).includes("Endereco completo"),
    `Incomplete address was not blocked: ${missingAddressIssue.response.status} ${JSON.stringify(missingAddressIssue.body)}`,
  );

  const invalidPayer = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "invalid-payer",
    amountCents: 5200,
    dueDate: futureDate(30),
  });
  await prisma.person.update({
    where: { id: invalidPayer.student.person.id },
    data: { cpf: invalidCpf(cpfSeedBase + 1_500_000) },
  });
  const invalidPayerIssue = await request(
    `/finance/invoices/${invalidPayer.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(
    invalidPayerIssue.response.status === 400 &&
      JSON.stringify(invalidPayerIssue.body).includes("CPF"),
    `Invalid payer CPF was not blocked: ${invalidPayerIssue.response.status} ${JSON.stringify(invalidPayerIssue.body)}`,
  );

  const uncertain = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "uncertain",
    amountCents: 5300,
    dueDate: futureDate(30),
  });
  const issueCallsBeforeTimeout = mock.issueCalls;
  mock.queueIssue("timeout");
  const unknownIssue = await request(
    `/finance/invoices/${uncertain.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(unknownIssue.response.status === 409, "Uncertain issue did not return conflict");
  const unknownSlip = await prisma.bankSlip.findUnique({
    where: { invoiceId: uncertain.invoice.id },
  });
  expect(unknownSlip?.status === "UNKNOWN", "Uncertain issue did not mark UNKNOWN");
  expect(unknownSlip.providerErrorCode === "TIMEOUT", "Uncertain error code was not sanitized");
  expect(mock.issueCalls === issueCallsBeforeTimeout + 1, "Issue timeout was retried");
  const unknownRetry = await request(
    `/finance/invoices/${uncertain.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(unknownRetry.response.status === 409, "UNKNOWN BankSlip allowed reissue");

  const rejected = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "rejected",
    amountCents: 5400,
    dueDate: futureDate(30),
  });
  mock.queueIssue("reject422");
  const rejectedIssue = await request(
    `/finance/invoices/${rejected.invoice.id}/bank-slip/issue`,
    { method: "POST", headers: json(secretaryCookie) },
  );
  expect(rejectedIssue.response.status === 400, "422 issue did not return bad request");
  const rejectedSlip = await prisma.bankSlip.findUnique({
    where: { invoiceId: rejected.invoice.id },
  });
  expect(rejectedSlip?.status === "ISSUE_FAILED", "422 issue did not mark ISSUE_FAILED");
  expect(
    !JSON.stringify(rejectedIssue.body).includes(rejected.student.person.cpf),
    "Rejected issue response leaked CPF",
  );

  const dailyAlreadyPaid = issued;
  const dailyNew = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "daily-new",
    amountCents: 6100,
    dueDate: futureDate(30),
  });
  mock.queueIssue("success");
  const dailyNewSlip = await issueBankSlip(secretaryCookie, dailyNew.invoice.id);
  mock.setPaidPages([
    [
      paidItem(dailyAlreadyPaid, "120.50"),
      paidItem(dailyNewSlip, "61.00"),
    ],
    [
      {
        nossoNumero: "999999999",
        seuNumero: "A999999999",
        dataPagamento: providerDate(todayOnly()),
        valor: "99.99",
        valorLiquidado: "99.99",
        tipoLiquidacao: "LIQUIDADO",
      },
    ],
  ]);
  const paidDay = await request("/finance/bank-slips/sync-paid-day", {
    method: "POST",
    headers: json(adminCookie),
    body: JSON.stringify({ date: todayOnly() }),
  });
  expect(paidDay.response.ok, `Paid-day sync failed: ${paidDay.body.message}`);
  expect(paidDay.body.pagesProcessed === 2, "Paid-day did not process two pages");
  expect(paidDay.body.recordsReceived === 3, "Paid-day record count mismatch");
  expect(paidDay.body.bankSlipsFound === 2, "Paid-day found count mismatch");
  expect(paidDay.body.paymentsConfirmed === 1, "Paid-day confirmed count mismatch");
  expect(paidDay.body.alreadySynced === 1, "Paid-day already synced count mismatch");
  expect(paidDay.body.notFound === 1, "Paid-day not found count mismatch");
  const unknownDailySlip = await prisma.bankSlip.findFirst({
    where: { nossoNumero: "999999999" },
  });
  expect(!unknownDailySlip, "Paid-day created unknown BankSlip");

  const cancellation = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "cancellation",
    amountCents: 6500,
    dueDate: futureDate(30),
  });
  mock.queueIssue("success");
  const cancellationSlip = await issueBankSlip(secretaryCookie, cancellation.invoice.id);
  const missingReason = await request(
    `/finance/invoices/${cancellation.invoice.id}/bank-slip/cancel`,
    { method: "POST", headers: json(secretaryCookie), body: JSON.stringify({}) },
  );
  expect(missingReason.response.status === 400, "Cancellation reason was not required");
  mock.queueCancellation("success202");
  const cancelRequested = await request(
    `/finance/invoices/${cancellation.invoice.id}/bank-slip/cancel`,
    {
      method: "POST",
      headers: json(secretaryCookie),
      body: JSON.stringify({ reason: "OTHER", note: `baixa smoke ${runId}` }),
    },
  );
  expect(cancelRequested.response.ok, `Cancellation request failed: ${cancelRequested.body.message}`);
  expect(
    cancelRequested.body.status === "PENDING_CANCELLATION",
    "Cancellation request did not remain pending",
  );
  const pendingCancellation = await prisma.bankSlip.findUnique({
    where: { invoiceId: cancellation.invoice.id },
  });
  expect(Boolean(pendingCancellation?.cancellationRequestedAt), "Cancellation date not stored");
  expect(
    pendingCancellation?.cancellationRequestedByUserId === secretaryUser.id,
    "Cancellation user not stored",
  );
  expect(
    pendingCancellation?.cancellationReason === "OTHER",
    "Cancellation reason not stored",
  );
  expect(
    pendingCancellation?.cancellationNote === `baixa smoke ${runId}`,
    "Cancellation note not stored",
  );
  expect(pendingCancellation?.status !== "CANCELLED", "Cancellation was confirmed too early");
  mock.setQueryStatus(cancellationSlip.nossoNumero, "BAIXADO POR SOLICITACAO");
  const cancellationConfirmed = await syncBankSlip(adminCookie, cancellation.invoice.id);
  expect(cancellationConfirmed.status === "CANCELLED", "Cancellation sync did not mark CANCELLED");
  const cancelledInvoice = await prisma.invoice.findUnique({
    where: { id: cancellation.invoice.id },
  });
  expect(cancelledInvoice?.status === "CANCELLED", "Invoice was not cancelled after bank cancellation");
  expect(cancelledInvoice?.cancelledByUserId === secretaryUser.id, "Invoice cancelledByUserId mismatch");
  expect(cancelledInvoice?.cancellationReason === "OTHER", "Invoice cancellation reason mismatch");
  const cancelHistoryOnce = await historyCount(cancellation.invoice.id, [
    "BANK_SLIP_CANCELLED",
  ]);
  expect(cancelHistoryOnce === 1, "Cancellation history not recorded once");
  await syncBankSlip(adminCookie, cancellation.invoice.id);
  const cancelHistoryTwice = await historyCount(cancellation.invoice.id, [
    "BANK_SLIP_CANCELLED",
  ]);
  expect(cancelHistoryTwice === 1, "Repeated cancellation sync duplicated history");

  const sameInvoice = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "same-invoice-concurrent",
    amountCents: 7000,
    dueDate: futureDate(30),
  });
  mock.queueIssue("success");
  const sameResults = await Promise.allSettled([
    request(`/finance/invoices/${sameInvoice.invoice.id}/bank-slip/issue`, {
      method: "POST",
      headers: json(secretaryCookie),
    }),
    request(`/finance/invoices/${sameInvoice.invoice.id}/bank-slip/issue`, {
      method: "POST",
      headers: json(secretaryCookie),
    }),
  ]);
  const sameResponses = sameResults
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value.response.status);
  expect(sameResponses.filter((status) => status >= 200 && status < 300).length === 1, "Concurrent same invoice did not issue exactly once");
  expect(sameResponses.includes(409), "Concurrent same invoice did not block duplicate");
  const sameInvoiceSlipCount = await prisma.bankSlip.count({
    where: { invoiceId: sameInvoice.invoice.id },
  });
  expect(sameInvoiceSlipCount === 1, "Concurrent same invoice created multiple BankSlips");

  const concurrentA = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "concurrent-a",
    amountCents: 7100,
    dueDate: futureDate(30),
  });
  const concurrentB = await createStudentAndInvoice(secretaryCookie, base, {
    suffix: "concurrent-b",
    amountCents: 7200,
    dueDate: futureDate(30),
  });
  mock.queueIssue("success");
  mock.queueIssue("success");
  const [concurrentSlipA, concurrentSlipB] = await Promise.all([
    issueBankSlip(secretaryCookie, concurrentA.invoice.id),
    issueBankSlip(secretaryCookie, concurrentB.invoice.id),
  ]);
  expect(
    concurrentSlipA.seuNumero !== concurrentSlipB.seuNumero,
    "Concurrent invoices generated duplicate Seu Numero",
  );

  const pdf = await fetch(`${apiUrl}/finance/invoices/${dailyNew.invoice.id}/bank-slip/pdf`, {
    headers: { cookie: secretaryCookie },
  });
  expect(pdf.ok, `PDF request failed: ${pdf.status}`);
  expect(
    pdf.headers.get("content-type")?.startsWith("application/pdf"),
    "PDF content type is invalid",
  );
  expect(
    pdf.headers.get("content-disposition")?.includes(".pdf"),
    "PDF content disposition missing file name",
  );
  expect(pdf.headers.get("cache-control") === "no-store, private", "PDF cache header invalid");
  expect(pdf.headers.get("x-content-type-options") === "nosniff", "PDF nosniff header missing");
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  expect(pdfBytes.toString("utf8").startsWith("%PDF-1.4"), "PDF body invalid");

  await assertSensitiveDataWasNotLogged([
    success.student.person.cpf,
    issued.linhaDigitavel,
    issued.codigoBarras,
    "access_token",
    "refresh_token",
    "x-api-key",
    "mock-password",
    "payload bruto",
  ]);

  expect(mock.authCalls >= 1, "Mock auth endpoint was not used");
  console.log(`Sprint 11 bank slips smoke OK (${runId})`);
} finally {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    await waitForExit(apiProcess);
  }
  await mock.stop();
  await prisma.$disconnect();
}

async function startApi(mockBaseUrl) {
  const env = {
    ...process.env,
    ...rootEnv,
    NODE_ENV: "development",
    API_PORT: String(apiPort),
    CORS_ORIGINS: process.env.CORS_ORIGINS ?? rootEnv.CORS_ORIGINS ?? apiUrl,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    ADMIN_SETUP_TOKEN: setupToken,
    PASSWORD_HASH_ROUNDS: "4",
    AUTH_RATE_LIMIT_MAX: "1000",
    AUTH_RATE_LIMIT_TTL_MS: "1000",
    SICREDI_ENV: "sandbox",
    SICREDI_AUTH_URL: `${mockBaseUrl}/auth/openapi/token`,
    SICREDI_BASE_URL: mockBaseUrl,
    SICREDI_API_KEY: "mock-api-key",
    SICREDI_USERNAME: "mock-user",
    SICREDI_PASSWORD: "mock-password",
    SICREDI_COOPERATIVA: "6789",
    SICREDI_POSTO: "03",
    SICREDI_CODIGO_BENEFICIARIO: "12345",
    SICREDI_HTTP_TIMEOUT_MS: "250",
    SICREDI_REQUIRE_PAYER_ADDRESS: "true",
  };
  const child = spawn(resolve(repoRoot, "node_modules/.bin/tsx"), ["src/main.ts"], {
    cwd: apiDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    if (/Error|Exception|EADDRINUSE/.test(text)) {
      process.stderr.write(text);
    }
  });
  return child;
}

async function waitForHealth() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // API still starting.
    }
    await sleep(250);
  }
  throw new Error("API did not become healthy for bank slip smoke");
}

async function ensureSmokeUsers() {
  await prisma.role.upsert({
    where: { code: "SUPER_ADMIN" },
    create: { code: "SUPER_ADMIN", description: "Super Admin" },
    update: {},
  });
  await prisma.role.upsert({
    where: { code: "SECRETARIA" },
    create: { code: "SECRETARIA", description: "Secretaria" },
    update: {},
  });
  await ensureUser(adminEmail, adminPassword, "SUPER_ADMIN", "Smoke BankSlip Admin");
  await ensureUser(
    secretaryEmail,
    secretaryPassword,
    "SECRETARIA",
    "Smoke BankSlip Secretaria",
  );
}

async function ensureUser(email, password, roleCode, name) {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roles: { create: { roleId: role.id } },
    },
    update: {
      passwordHash: await bcrypt.hash(password, 4),
      status: "ACTIVE",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  return user;
}

async function loginSmokeUsers() {
  const adminLogin = await request("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  expect(adminLogin.response.ok && adminLogin.cookie, "Admin login failed");
  const secretaryLogin = await request("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({ email: secretaryEmail, password: secretaryPassword }),
  });
  expect(
    secretaryLogin.response.ok && secretaryLogin.cookie,
    "Secretaria login failed",
  );
  return {
    adminCookie: adminLogin.cookie,
    secretaryCookie: secretaryLogin.cookie,
    adminUser: adminLogin.body.user,
    secretaryUser: secretaryLogin.body.user,
  };
}

async function createBaseFixture(cookie) {
  const usedYears = new Set(
    (await prisma.academicYear.findMany({ select: { year: true } })).map(
      (item) => item.year,
    ),
  );
  let year = 2300;
  while (usedYears.has(year)) {
    year += 1;
  }
  const academicYear = await createRecord(cookie, "/academic-years", {
    year,
    isCurrent: true,
  });
  const institution = await createRecord(cookie, "/institutions", {
    name: `Instituicao ${runId}`,
  });
  const shift = await createRecord(cookie, "/shifts", {
    name: `Turno ${runId}`,
  });
  return { academicYear, institution, shift };
}

async function createStudentAndInvoice(cookie, base, input) {
  const student = await createRecord(cookie, "/students", {
    person: {
      fullName: `Academico Boleto ${runId} ${input.suffix}`,
      cpf: generateCpf(cpfSeedBase + Math.floor(Math.random() * 900000)),
      rg: `RG-${input.suffix}`.slice(0, 30),
      birthDate: "2001-05-12",
      phone: "49999999999",
      email: `boleto-${input.suffix}-${runId}@example.com`,
      addressStreet: "Rua Smoke",
      addressNumber: "123",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
      ...(input.missingAddress
        ? {}
        : { addressZipCode: "87890-000", addressState: "PR" }),
    },
    guardian: { fullName: `Responsavel ${input.suffix}` },
    enrollment: {
      academicYearId: base.academicYear.id,
      institutionId: base.institution.id,
      shiftId: base.shift.id,
      course: "Tecnico em Administracao",
      grade: "1o",
    },
  });
  const invoiceResponse = await request(`/students/${student.id}/invoices`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({
      enrollmentId: student.enrollments[0].id,
      amountCents: input.amountCents,
      dueDate: input.dueDate,
      description: `Boleto smoke ${input.suffix}`,
      idempotencyKey: `${runId}-${input.suffix}`,
    }),
  });
  expect(
    invoiceResponse.response.ok,
    `Invoice create failed (${input.suffix}): ${invoiceResponse.body.message}`,
  );
  return { student, invoice: invoiceResponse.body };
}

async function createRecord(cookie, path, body) {
  const response = await request(path, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(body),
  });
  expect(response.response.ok, `${path} failed: ${response.body.message}`);
  return response.body;
}

async function issueBankSlip(cookie, invoiceId) {
  const result = await request(`/finance/invoices/${invoiceId}/bank-slip/issue`, {
    method: "POST",
    headers: json(cookie),
  });
  expect(result.response.ok, `BankSlip issue failed: ${result.body.message}`);
  return result.body;
}

async function syncBankSlip(cookie, invoiceId) {
  const result = await request(`/finance/invoices/${invoiceId}/bank-slip/sync`, {
    method: "POST",
    headers: json(cookie),
  });
  expect(result.response.ok, `BankSlip sync failed: ${result.body.message}`);
  return result.body;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const body =
    contentType.includes("application/json") && text.length > 0
      ? JSON.parse(text)
      : text;
  return {
    response,
    body,
    cookie: response.headers.get("set-cookie"),
  };
}

function json(cookie) {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { cookie } : {}),
  };
}

async function assertBlocked(call, status, message) {
  const result = await call();
  expect(result.response.status === status, message);
}

async function historyCount(invoiceId, eventTypes) {
  return prisma.studentHistoryEvent.count({
    where: { invoiceId, eventType: { in: eventTypes } },
  });
}

async function assertSensitiveDataWasNotLogged(values) {
  const logs = await prisma.administrativeAuditLog.findMany({
    where: {
      domain: "bank_slips",
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 30) },
    },
    take: 200,
  });
  const history = await prisma.studentHistoryEvent.findMany({
    where: {
      eventType: {
        in: [
          "BANK_SLIP_ISSUED",
          "BANK_SLIP_PAYMENT_CONFIRMED",
          "BANK_SLIP_CANCELLATION_REQUESTED",
          "BANK_SLIP_CANCELLED",
        ],
      },
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 30) },
    },
    take: 200,
  });
  const text = JSON.stringify({ logs, history });
  for (const value of values.filter(Boolean)) {
    expect(!text.includes(value), `Sensitive value leaked in audit/history: ${value}`);
  }
}

function createSicrediMock() {
  const state = {
    authCalls: 0,
    issueCalls: 0,
    issueQueue: [],
    cancellationQueue: [],
    records: new Map(),
    queryStatus: new Map(),
    paidPages: [],
    nextNosso: 100000000 + (Date.now() % 700000000),
    server: undefined,
    baseUrl: undefined,
  };

  function respond(response, status, body, headers = {}) {
    const payload = typeof body === "string" || Buffer.isBuffer(body)
      ? body
      : JSON.stringify(body);
    response.writeHead(status, {
      "Content-Type": Buffer.isBuffer(payload) ? "application/pdf" : "application/json",
      "Content-Length": Buffer.byteLength(payload),
      ...headers,
    });
    response.end(payload);
  }

  async function readJson(request) {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return text ? JSON.parse(text) : {};
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://mock.local");
    try {
      if (request.method === "POST" && url.pathname === "/auth/openapi/token") {
        state.authCalls += 1;
        return respond(response, 200, {
          access_token: `access-token-${state.authCalls}`,
          refresh_token: `refresh-token-${state.authCalls}`,
          expires_in: 3600,
          refresh_expires_in: 7200,
        });
      }

      if (
        request.method === "POST" &&
        url.pathname === "/cobranca/boleto/v1/boletos"
      ) {
        state.issueCalls += 1;
        const mode = state.issueQueue.shift() ?? "success";
        const body = await readJson(request);
        if (mode === "timeout" || mode === "lost-response") {
          setTimeout(() => {
            if (!response.writableEnded) {
              response.destroy();
            }
          }, 2_000);
          return undefined;
        }
        if (mode === "reject422") {
          return respond(response, 422, {
            codigo: "VALOR_INVALIDO",
            mensagem: "Requisicao rejeitada pelo mock Sicredi",
          });
        }
        if (mode === "reject400") {
          return respond(response, 400, {
            codigo: "REQUISICAO_INVALIDA",
            mensagem: "Dados invalidos no mock Sicredi",
          });
        }
        if (mode === "rate429") {
          return respond(response, 429, {
            codigo: "RATE_LIMIT",
            mensagem: "Limite temporario no mock Sicredi",
          });
        }
        if (mode === "error504") {
          return respond(response, 504, {
            codigo: "GATEWAY_TIMEOUT",
            mensagem: "Timeout no mock Sicredi",
          });
        }
        const nossoNumero = String((state.nextNosso += 1)).padStart(9, "0");
        const record = {
          nossoNumero,
          seuNumero: body.seuNumero,
          situacao: "EM CARTEIRA",
          valorNominal: body.valor,
          dataVencimento: body.dataVencimento,
          dataEmissao: todayOnly(),
          linhaDigitavel: lineDigits(nossoNumero),
          codigoBarras: barCode(nossoNumero),
        };
        state.records.set(nossoNumero, record);
        return respond(response, 201, {
          nossoNumero,
          linhaDigitavel: record.linhaDigitavel,
          codigoBarras: record.codigoBarras,
          cooperativa: "6789",
          posto: "03",
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/cobranca/boleto/v1/boletos"
      ) {
        const nossoNumero = url.searchParams.get("nossoNumero") ?? "";
        const record = state.records.get(nossoNumero);
        if (!record) {
          return respond(response, 404, {
            codigo: "NAO_ENCONTRADO",
            mensagem: "Boleto nao encontrado",
          });
        }
        const situacao = state.queryStatus.get(nossoNumero) ?? record.situacao;
        const liquidado = situacao === "LIQUIDADO";
        return respond(response, 200, {
          ...record,
          situacao,
          dataMovimento: todayOnly(),
          dadosLiquidacao: liquidado
            ? { data: providerDate(todayOnly()), valor: record.valorNominal }
            : undefined,
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/cobranca/boleto/v1/boletos/liquidados/dia"
      ) {
        const page = Number(url.searchParams.get("pagina") ?? "1");
        const items = state.paidPages[page - 1] ?? [];
        return respond(response, 200, {
          items,
          hasNext: page < state.paidPages.length,
        });
      }

      if (
        request.method === "PATCH" &&
        url.pathname.startsWith("/cobranca/boleto/v1/boletos/") &&
        url.pathname.endsWith("/baixa")
      ) {
        const mode = state.cancellationQueue.shift() ?? "success202";
        const nossoNumero = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
        if (mode === "timeout") {
          setTimeout(() => response.destroy(), 2_000);
          return undefined;
        }
        if (mode === "alreadyPaid") {
          return respond(response, 409, {
            codigo: "BOLETO_LIQUIDADO",
            mensagem: "Boleto ja liquidado",
          });
        }
        if (mode === "alreadyCancelled") {
          return respond(response, 409, {
            codigo: "BOLETO_BAIXADO",
            mensagem: "Boleto ja baixado",
          });
        }
        if (mode === "processing") {
          return respond(response, 202, {
            transactionId: `cancel-${nossoNumero}`,
            dataMovimento: providerDate(todayOnly()),
            codigoBeneficiario: "12345",
            nossoNumero,
            cooperativa: "6789",
            posto: "03",
            statusComando: "EM_PROCESSAMENTO",
          });
        }
        if (mode === "reject") {
          return respond(response, 422, {
            codigo: "BAIXA_REJEITADA",
            mensagem: "Baixa rejeitada pelo mock Sicredi",
          });
        }
        return respond(response, 202, {
          transactionId: `cancel-${nossoNumero}`,
          dataMovimento: providerDate(todayOnly()),
          codigoBeneficiario: "12345",
          nossoNumero,
          cooperativa: "6789",
          posto: "03",
          statusComando: "MOVIMENTO_ENVIADO",
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/cobranca/boleto/v1/boletos/pdf"
      ) {
        const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
        return respond(response, 200, pdf, { "Content-Type": "application/pdf" });
      }

      return respond(response, 404, { codigo: "ROTA_NAO_MOCKADA" });
    } catch (error) {
      return respond(response, 500, {
        codigo: "MOCK_ERROR",
        mensagem: error instanceof Error ? error.message : "Erro no mock",
      });
    }
  });
  state.server = server;

  return {
    get authCalls() {
      return state.authCalls;
    },
    get issueCalls() {
      return state.issueCalls;
    },
    async start() {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      state.baseUrl = `http://127.0.0.1:${address.port}`;
      return state.baseUrl;
    },
    async stop() {
      if (server.listening) {
        server.close();
        await once(server, "close");
      }
    },
    queueIssue(mode) {
      state.issueQueue.push(mode);
    },
    queueCancellation(mode) {
      state.cancellationQueue.push(mode);
    },
    setQueryStatus(nossoNumero, status) {
      state.queryStatus.set(nossoNumero, status);
    },
    setPaidPages(pages) {
      state.paidPages = pages;
    },
  };
}

function paidItem(bankSlip, amount) {
  return {
    nossoNumero: bankSlip.nossoNumero,
    seuNumero: bankSlip.seuNumero,
    dataPagamento: providerDate(todayOnly()),
    valor: amount,
    valorLiquidado: amount,
    tipoLiquidacao: "LIQUIDADO",
  };
}

function lineDigits(nossoNumero) {
  return `748911251100${nossoNumero}0512803153351030188640000009990`.slice(0, 47);
}

function barCode(nossoNumero) {
  return `74891886400000099901125${nossoNumero}05120315335103`.slice(0, 44);
}

function generateCpf(seed) {
  const base = String(seed).padStart(9, "0").slice(0, 9);
  const first = checkDigit(base);
  const second = checkDigit(`${base}${first}`);
  return `${base}${first}${second}`;
}

function invalidCpf(seed) {
  const valid = generateCpf(seed);
  const last = valid.at(-1) === "0" ? "1" : "0";
  return `${valid.slice(0, -1)}${last}`;
}

function checkDigit(value) {
  const numbers = value.split("").map(Number);
  const start = numbers.length + 1;
  const sum = numbers.reduce(
    (total, number, index) => total + number * (start - index),
    0,
  );
  const digit = (sum * 10) % 11;
  return digit === 10 ? 0 : digit;
}

function todayOnly() {
  return dateOnly(new Date());
}

function futureDate(days) {
  return dateOnly(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

function pastDate(days) {
  return dateOnly(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function providerDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  const timeout = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }, 5_000);
  await once(child, "exit").catch(() => undefined);
  clearTimeout(timeout);
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index);
          const value = line.slice(index + 1).replace(/^['"]|['"]$/g, "");
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}
