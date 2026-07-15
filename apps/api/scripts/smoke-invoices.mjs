import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s10-${Date.now()}`;
const cpfSeedBase = 800000000 + (Date.now() % 90000000);

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 10 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 10 smoke");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
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

async function ensureUsers() {
  await request("/auth/bootstrap/super-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-setup-token": setupToken,
    },
    body: JSON.stringify({
      name: "Smoke Admin",
      email: adminEmail,
      password: adminPassword,
    }),
  });

  const adminLogin = await request("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  expect(adminLogin.response.ok && adminLogin.cookie, "Admin login failed");

  await request("/auth/users", {
    method: "POST",
    headers: json(adminLogin.cookie),
    body: JSON.stringify({
      name: "Smoke Secretaria",
      email: secretaryEmail,
      password: secretaryPassword,
      role: "SECRETARIA",
    }),
  });

  const secretaryLogin = await request("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({
      email: secretaryEmail,
      password: secretaryPassword,
    }),
  });
  expect(
    secretaryLogin.response.ok && secretaryLogin.cookie,
    "Secretaria login failed",
  );

  return {
    adminCookie: adminLogin.cookie,
    secretaryCookie: secretaryLogin.cookie,
  };
}

async function createBaseRecord(cookie, path, body) {
  const created = await request(path, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(body),
  });
  if (!created.response.ok) {
    throw new Error(`${path} create failed: ${created.body.message}`);
  }
  return created.body;
}

async function createYear(cookie, year, isCurrent = false) {
  const created = await request("/academic-years", {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({ year, isCurrent }),
  });
  if (!created.response.ok) {
    throw new Error(`Academic year create failed: ${created.body.message}`);
  }
  return created.body;
}

async function createStudent(cookie, payload) {
  const created = await request("/students", {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(payload),
  });
  if (!created.response.ok) {
    throw new Error(`Student create failed: ${created.body.message}`);
  }
  return created.body;
}

async function createInvoice(cookie, studentId, body) {
  return request(`/students/${studentId}/invoices`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(body),
  });
}

async function cancelInvoice(cookie, invoiceId, body = {}) {
  return request(`/finance/invoices/${invoiceId}/cancel`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({
      reason: "MANUAL_CORRECTION",
      note: `smoke ${runId}`,
      ...body,
    }),
  });
}

async function suspendStudent(cookie, studentId) {
  const suspended = await request(`/students/${studentId}/suspend`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({
      reason: "OTHER",
      justification: `suspensao smoke ${runId}`,
      releaseBusSeat: false,
    }),
  });
  if (!suspended.response.ok) {
    throw new Error(`Student suspension failed: ${suspended.body.message}`);
  }
}

async function terminateStudent(cookie, studentId) {
  const terminated = await request(`/students/${studentId}/terminate`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({
      terminationReason: "WITHDRAWAL",
      justification: `desligamento smoke ${runId}`,
    }),
  });
  if (!terminated.response.ok) {
    throw new Error(`Student termination failed: ${terminated.body.message}`);
  }
}

async function startBoard(cookie, studentId) {
  const created = await request(`/students/${studentId}/board-memberships`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({ note: `smoke ${runId}` }),
  });
  if (!created.response.ok) {
    throw new Error(`Board membership start failed: ${created.body.message}`);
  }
  return created.body;
}

function studentPayload({ cpf, academicYearId, institutionId, shiftId, suffix }) {
  const shortSuffix = suffix.slice(-18);
  return {
    person: {
      fullName: `Academico Fatura ${suffix}`,
      cpf,
      rg: `RG-${shortSuffix}`,
      birthDate: "2001-05-12",
      phone: "49999999999",
      email: `invoice-${suffix}@example.com`,
      addressStreet: `Rua ${suffix}`,
      addressNumber: "123",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
    },
    guardian: {
      fullName: `Responsavel ${suffix}`,
    },
    enrollment: {
      academicYearId,
      institutionId,
      shiftId,
      course: "Tecnico em Administracao",
      grade: "1o",
    },
  };
}

function generateCpf(seed) {
  const base = String(seed).padStart(9, "0").slice(0, 9);
  const first = checkDigit(base);
  const second = checkDigit(`${base}${first}`);
  return `${base}${first}${second}`;
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

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const today = new Date();
const todayOnly = dateOnly(today);
const pastDueDate = dateOnly(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30));
const futureDueDate = dateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30));

const anonymous = await request("/finance/invoices", { headers: json() });
expect(anonymous.response.status === 401, "Anonymous invoice access allowed");

const { adminCookie, secretaryCookie } = await ensureUsers();

const usedYears = new Set(
  (await prisma.academicYear.findMany({ select: { year: true } })).map(
    (item) => item.year,
  ),
);
let yearValue = 2100;
while (usedYears.has(yearValue)) {
  yearValue -= 1;
}
let academicYear;
if (yearValue >= 2000) {
  academicYear = await createYear(adminCookie, yearValue, true);
} else {
  academicYear = await prisma.academicYear.findFirst({
    where: { status: "ACTIVE" },
    orderBy: [{ isCurrent: "desc" }, { year: "desc" }],
  });
  if (!academicYear) {
    throw new Error("No available active academic year for invoice smoke");
  }
  yearValue = academicYear.year;
}
const institution = await createBaseRecord(adminCookie, "/institutions", {
  name: `Instituicao ${runId}`,
});
const shift = await createBaseRecord(adminCookie, "/shifts", {
  name: `Turno ${runId}`,
});

const activeStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(cpfSeedBase + 1),
    academicYearId: academicYear.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-active`,
  }),
);
const activeEnrollmentId = activeStudent.enrollments[0].id;

const preview = await request(
  `/students/${activeStudent.id}/invoice-preview?enrollmentId=${activeEnrollmentId}`,
  { headers: json(secretaryCookie) },
);
expect(preview.response.ok, `Invoice preview failed: ${preview.body.message}`);
expect(preview.body.eligible === true, "ACTIVE student was not eligible");

const invoicePayload = {
  enrollmentId: activeEnrollmentId,
  amountCents: 12345,
  dueDate: pastDueDate,
  description: `Fatura retroativa ${runId}`,
  idempotencyKey: `${runId}-invoice-active`,
};
const createdInvoice = await createInvoice(
  secretaryCookie,
  activeStudent.id,
  invoicePayload,
);
expect(
  createdInvoice.response.ok,
  `Invoice create failed: ${createdInvoice.body.message}`,
);
expect(createdInvoice.body.amountCents === 12345, "Invoice amount was not saved");
expect(createdInvoice.body.dueDate === pastDueDate, "Invoice due date was not saved");
expect(createdInvoice.body.status === "OPEN", "Past due invoice should remain OPEN");
expect(createdInvoice.body.overdue === true, "Past due invoice was not derived overdue");
expect(
  createdInvoice.body.enrollment.academicYear.id === academicYear.id,
  "Invoice did not preserve enrollment academic year context",
);
expect(
  createdInvoice.body.enrollment.institution.id === institution.id,
  "Invoice did not preserve enrollment institution context",
);

const sameIdempotency = await createInvoice(
  secretaryCookie,
  activeStudent.id,
  invoicePayload,
);
expect(sameIdempotency.response.ok, "Same idempotency payload failed");
expect(
  sameIdempotency.body.id === createdInvoice.body.id,
  "Same idempotency payload did not return existing invoice",
);

const differentIdempotencyPayload = await createInvoice(
  secretaryCookie,
  activeStudent.id,
  {
    ...invoicePayload,
    amountCents: 54321,
  },
);
expect(
  differentIdempotencyPayload.response.status === 409,
  "Different payload with same idempotencyKey was not rejected",
);

const detail = await request(`/finance/invoices/${createdInvoice.body.id}`, {
  headers: json(secretaryCookie),
});
expect(detail.response.ok, "Invoice detail failed");
expect(detail.body.id === createdInvoice.body.id, "Invoice detail returned wrong record");

const searchList = await request(
  `/finance/invoices?search=${encodeURIComponent(activeStudent.person.cpf)}&status=OPEN&overdue=overdue`,
  { headers: json(secretaryCookie) },
);
expect(searchList.response.ok, "Invoice search/filter failed");
expect(
  searchList.body.data.some((invoice) => invoice.id === createdInvoice.body.id),
  "Invoice search/filter did not return created invoice",
);

const studentInvoices = await request(`/students/${activeStudent.id}/invoices`, {
  headers: json(secretaryCookie),
});
expect(studentInvoices.response.ok, "Student invoice history failed");
expect(
  studentInvoices.body.data.some((invoice) => invoice.id === createdInvoice.body.id),
  "Student invoice list did not include created invoice",
);

await suspendStudent(secretaryCookie, activeStudent.id);
const preservedAfterSuspension = await prisma.invoice.findUnique({
  where: { id: createdInvoice.body.id },
});
expect(
  preservedAfterSuspension?.status === "OPEN",
  "Suspension altered previous invoice status",
);

const suspendedInvoice = await createInvoice(secretaryCookie, activeStudent.id, {
  enrollmentId: activeEnrollmentId,
  amountCents: 1000,
  dueDate: futureDueDate,
  idempotencyKey: `${runId}-blocked-suspended`,
});
expect(
  suspendedInvoice.response.status === 400,
  "SUSPENDED student was not blocked from new invoice",
);

const terminatedStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(cpfSeedBase + 2),
    academicYearId: academicYear.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-terminated`,
  }),
);
await terminateStudent(secretaryCookie, terminatedStudent.id);
const terminatedInvoice = await createInvoice(secretaryCookie, terminatedStudent.id, {
  enrollmentId: terminatedStudent.enrollments[0].id,
  amountCents: 1000,
  dueDate: futureDueDate,
  idempotencyKey: `${runId}-blocked-terminated`,
});
expect(
  terminatedInvoice.response.status === 400,
  "TERMINATED student was not blocked from new invoice",
);

const boardStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(cpfSeedBase + 3),
    academicYearId: academicYear.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-board`,
  }),
);
await startBoard(secretaryCookie, boardStudent.id);
const boardInvoice = await createInvoice(secretaryCookie, boardStudent.id, {
  enrollmentId: boardStudent.enrollments[0].id,
  amountCents: 1000,
  dueDate: futureDueDate,
  idempotencyKey: `${runId}-blocked-board`,
});
expect(
  boardInvoice.response.status === 400,
  "Board member was not blocked from new invoice",
);

const todayStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(cpfSeedBase + 4),
    academicYearId: academicYear.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-today`,
  }),
);
const todayInvoice = await createInvoice(secretaryCookie, todayStudent.id, {
  enrollmentId: todayStudent.enrollments[0].id,
  amountCents: 2500,
  dueDate: todayOnly,
  description: "",
  idempotencyKey: `${runId}-today`,
});
expect(todayInvoice.response.ok, "Today invoice failed");
expect(todayInvoice.body.overdue === false, "Today invoice should not be overdue");
expect(!todayInvoice.body.description, "Empty description should not be stored");

const futureInvoice = await createInvoice(secretaryCookie, todayStudent.id, {
  enrollmentId: todayStudent.enrollments[0].id,
  amountCents: 2600,
  dueDate: futureDueDate,
  description: `Fatura futura ${runId}`,
  idempotencyKey: `${runId}-future-page`,
});
expect(futureInvoice.response.ok, "Future invoice failed");
expect(futureInvoice.body.overdue === false, "Future invoice should not be overdue");

const overduePage = await request(
  `/finance/invoices?academicYearId=${academicYear.id}&institutionId=${institution.id}&overdue=overdue&limit=1&page=1&sort=dueDate&order=asc`,
  { headers: json(secretaryCookie) },
);
expect(overduePage.response.ok, "Overdue filtered invoice page failed");
expect(overduePage.body.pagination.total === 1, "Overdue filtered total is wrong");
expect(overduePage.body.pagination.totalPages === 1, "Overdue totalPages is wrong");
expect(overduePage.body.data.length === 1, "Overdue page returned wrong size");
expect(
  overduePage.body.data[0].id === createdInvoice.body.id &&
    overduePage.body.data[0].overdue === true,
  "Overdue page returned wrong invoice",
);

const notOverduePage1 = await request(
  `/finance/invoices?academicYearId=${academicYear.id}&institutionId=${institution.id}&overdue=notOverdue&limit=1&page=1&sort=dueDate&order=asc`,
  { headers: json(secretaryCookie) },
);
const notOverduePage2 = await request(
  `/finance/invoices?academicYearId=${academicYear.id}&institutionId=${institution.id}&overdue=notOverdue&limit=1&page=2&sort=dueDate&order=asc`,
  { headers: json(secretaryCookie) },
);
expect(
  notOverduePage1.response.ok && notOverduePage2.response.ok,
  "Not-overdue filtered invoice pages failed",
);
expect(
  notOverduePage1.body.pagination.total >= 2 &&
    notOverduePage1.body.pagination.total === notOverduePage2.body.pagination.total,
  "Not-overdue filtered total is inconsistent",
);
expect(
  notOverduePage1.body.data.length === 1 && notOverduePage2.body.data.length === 1,
  "Not-overdue filtered pages have holes",
);
expect(
  notOverduePage1.body.data.every((invoice) => invoice.overdue === false) &&
    notOverduePage2.body.data.every((invoice) => invoice.overdue === false),
  "Not-overdue filtered page returned overdue invoice",
);
expect(
  notOverduePage1.body.data[0].id !== notOverduePage2.body.data[0].id,
  "Not-overdue pagination repeated the same invoice",
);

const invalidAmount = await createInvoice(secretaryCookie, todayStudent.id, {
  enrollmentId: todayStudent.enrollments[0].id,
  amountCents: 0,
  dueDate: futureDueDate,
  idempotencyKey: `${runId}-invalid-amount`,
});
expect(invalidAmount.response.status === 400, "Invalid amount was not blocked");

const wrongEnrollment = await createInvoice(secretaryCookie, todayStudent.id, {
  enrollmentId: activeEnrollmentId,
  amountCents: 1500,
  dueDate: futureDueDate,
  idempotencyKey: `${runId}-wrong-enrollment`,
});
expect(
  wrongEnrollment.response.status === 400,
  "Enrollment from another student was not blocked",
);

const cancelled = await cancelInvoice(secretaryCookie, createdInvoice.body.id, {
  reason: "DUPLICATE",
});
expect(cancelled.response.ok, `Invoice cancellation failed: ${cancelled.body.message}`);
expect(cancelled.body.status === "CANCELLED", "Invoice did not become CANCELLED");
expect(Boolean(cancelled.body.cancelledAt), "Invoice cancelledAt was not recorded");
expect(
  cancelled.body.cancellationReason === "DUPLICATE",
  "Invoice cancellation reason was not recorded",
);

const cancelAgain = await cancelInvoice(secretaryCookie, createdInvoice.body.id);
expect(cancelAgain.response.status === 400, "Second cancellation was not blocked");

const cancelledNotOverdue = await request(
  `/finance/invoices?academicYearId=${academicYear.id}&institutionId=${institution.id}&status=CANCELLED&overdue=notOverdue&search=${encodeURIComponent(activeStudent.person.cpf)}`,
  { headers: json(secretaryCookie) },
);
expect(cancelledNotOverdue.response.ok, "Cancelled not-overdue filter failed");
expect(
  cancelledNotOverdue.body.data.some((invoice) => invoice.id === createdInvoice.body.id),
  "Cancelled past-due invoice should be filtered as not overdue",
);

const historyCount = await prisma.studentHistoryEvent.count({
  where: {
    studentId: activeStudent.id,
    invoiceId: createdInvoice.body.id,
    eventType: { in: ["INVOICE_CREATED", "INVOICE_CANCELLED"] },
  },
});
expect(historyCount >= 2, "Invoice history events were not recorded");

const auditLogs = await prisma.administrativeAuditLog.findMany({
  where: {
    eventType: { in: ["INVOICE_CREATED", "INVOICE_CANCELLED"] },
    createdAt: { gte: new Date(Date.now() - 1000 * 60 * 20) },
  },
  take: 20,
});
expect(auditLogs.length > 0, "Invoice audit logs were not recorded");
const auditText = JSON.stringify(auditLogs.map((log) => log.metadata));
expect(!auditText.includes(activeStudent.person.cpf), "Audit metadata leaked CPF");
expect(!auditText.includes(terminatedStudent.person.cpf), "Audit metadata leaked CPF");
expect(!auditText.includes(boardStudent.person.cpf), "Audit metadata leaked CPF");

const finalList = await request(`/finance/invoices?academicYearId=${academicYear.id}`, {
  headers: json(secretaryCookie),
});
expect(finalList.response.ok, "Final invoice list failed");
const finalText = JSON.stringify(finalList.body.data);
expect(!finalText.includes("bankSlip"), "Invoice response exposed BankSlip data");
expect(!finalText.includes("sicredi"), "Invoice response exposed Sicredi data");
expect(!finalText.includes("pdfUrl"), "Invoice response exposed PDF data");

await prisma.$disconnect();
console.log(`Sprint 10 invoices smoke OK (${runId})`);
