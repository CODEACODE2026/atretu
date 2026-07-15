import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s9-${Date.now()}`;
const cpfSeedBase = 700000000 + (Date.now() % 90000000);

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 9 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 9 smoke");
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

async function requestBinary(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
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
  if (!adminLogin.response.ok || !adminLogin.cookie) {
    throw new Error("Admin login failed");
  }

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
  if (!secretaryLogin.response.ok || !secretaryLogin.cookie) {
    throw new Error("Secretaria login failed");
  }

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

async function getCardSequenceValue(academicYearId, cardType) {
  const sequence = await prisma.cardSequence.findUnique({
    where: {
      academicYearId_cardType: {
        academicYearId,
        cardType,
      },
    },
  });
  return sequence?.lastSequenceNumber ?? 0;
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

async function issueCard(cookie, studentId, body) {
  return request(`/students/${studentId}/cards`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(body),
  });
}

async function uploadPhoto(cookie, studentId, file) {
  const form = new FormData();
  form.set("file", new Blob([file.buffer], { type: file.mimeType }), file.name);
  return request(`/students/${studentId}/photo`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
}

async function previewCard(cookie, studentId, params) {
  const search = new URLSearchParams(params).toString();
  return request(`/students/${studentId}/card-preview?${search}`, {
    headers: json(cookie),
  });
}

async function invalidateCard(cookie, studentId, cardId, reason) {
  const result = await request(`/students/${studentId}/cards/${cardId}/invalidate`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({ reason, note: `smoke ${runId}` }),
  });
  if (!result.response.ok) {
    throw new Error(`Card invalidation failed: ${result.body.message}`);
  }
  return result.body;
}

async function assignBus(cookie, enrollmentId, busId) {
  const linked = await request(`/enrollments/${enrollmentId}/bus-assignment`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({ busId, note: `smoke ${runId}` }),
  });
  if (!linked.response.ok) {
    throw new Error(`Bus assignment failed: ${linked.body.message}`);
  }
  return linked.body;
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

async function endBoard(cookie, studentId, membershipId) {
  const ended = await request(
    `/students/${studentId}/board-memberships/${membershipId}/end`,
    {
      method: "POST",
      headers: json(cookie),
      body: JSON.stringify({ note: `smoke ${runId}` }),
    },
  );
  if (!ended.response.ok) {
    throw new Error(`Board membership end failed: ${ended.body.message}`);
  }
  return ended.body;
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

async function reactivateStudent(cookie, studentId) {
  const reactivated = await request(`/students/${studentId}/reactivate`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify({ note: `reativacao smoke ${runId}` }),
  });
  if (!reactivated.response.ok) {
    throw new Error(`Student reactivation failed: ${reactivated.body.message}`);
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

async function reenroll(cookie, studentId, payload) {
  const result = await request(`/students/${studentId}/reenroll`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(payload),
  });
  if (!result.response.ok) {
    throw new Error(`Reenrollment failed: ${result.body.message}`);
  }
  return result.body;
}

function studentPayload({ cpf, academicYearId, institutionId, shiftId, suffix }) {
  return {
    person: {
      fullName: `Academico Carteirinha ${suffix}`,
      cpf,
      rg: `RG-${suffix}`,
      birthDate: "2001-05-12",
      phone: "49999999999",
      email: `card-${suffix}@example.com`,
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

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const photoFiles = {
  jpg: {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: {
        width: 4,
        height: 6,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .jpeg()
      .toBuffer(),
  },
  png: {
    name: "foto.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: {
        width: 4,
        height: 6,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .png()
      .toBuffer(),
  },
};

const anonymous = await request("/student-cards", { headers: json() });
expect(anonymous.response.status === 401, "Anonymous student card access allowed");
const anonymousPdf = await requestBinary(
  "/student-cards/00000000-0000-0000-0000-000000000000/pdf",
);
expect(anonymousPdf.response.status === 401, "Anonymous PDF access allowed");

const { adminCookie, secretaryCookie } = await ensureUsers();

const allExistingYears = await prisma.academicYear.findMany({
  where: { year: { gte: 2000, lte: 2100 } },
  select: { id: true, year: true },
  orderBy: { year: "desc" },
});
const existingYears = await prisma.academicYear.findMany({
  where: { year: { gte: 2000, lte: 2100 }, status: "ACTIVE" },
  select: { id: true, year: true },
  orderBy: { year: "desc" },
});
const usedYears = new Set(allExistingYears.map((item) => item.year));
let yearValue = 0;
let academicYear = null;
let nextAcademicYear = null;
for (let candidate = 2099; candidate >= 2000; candidate -= 1) {
  if (!usedYears.has(candidate) && !usedYears.has(candidate + 1)) {
    yearValue = candidate;
    academicYear = await createYear(adminCookie, yearValue, false);
    nextAcademicYear = await createYear(adminCookie, yearValue + 1, true);
    break;
  }
}
if (!academicYear || !nextAcademicYear) {
  for (const candidate of existingYears) {
    const next = existingYears.find((item) => item.year === candidate.year + 1);
    if (next) {
      yearValue = candidate.year;
      academicYear = candidate;
      nextAcademicYear = next;
      break;
    }
  }
}
if (!academicYear || !nextAcademicYear) {
  throw new Error("No available academic year pair for student card smoke");
}
const studentSequenceStart = await getCardSequenceValue(academicYear.id, "STUDENT");
const boardSequenceStart = await getCardSequenceValue(
  academicYear.id,
  "BOARD_MEMBER",
);
const nextYearStudentSequenceStart = await getCardSequenceValue(
  nextAcademicYear.id,
  "STUDENT",
);

const institution = await createBaseRecord(adminCookie, "/institutions", {
  name: `Instituicao ${runId}`,
});
const shift = await createBaseRecord(adminCookie, "/shifts", {
  name: `Turno ${runId}`,
});
const bus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId}`,
  capacity: 10,
});

const student1 = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(cpfSeedBase + 1),
    academicYearId: academicYear.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-1`,
  }),
);
const student2 = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(cpfSeedBase + 2),
    academicYearId: academicYear.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-2`,
  }),
);

const studentCard1 = await prisma.studentCard.findFirst({
  where: {
    studentId: student1.id,
    enrollmentId: student1.enrollments[0].id,
    cardType: "STUDENT",
    status: "ACTIVE",
  },
});
expect(Boolean(studentCard1), "First automatic STUDENT card was not created");
expect(
  studentCard1?.cardNumber === `${studentSequenceStart + 1}${yearValue}`,
  "First automatic STUDENT number invalid",
);

const beforePdfCard = await prisma.studentCard.findUnique({
  where: { id: studentCard1.id },
});
const beforePdfCardCount = await prisma.studentCard.count();
const noPhotoPdf = await requestBinary(`/student-cards/${studentCard1.id}/pdf`, {
  headers: json(secretaryCookie),
});
expect(
  noPhotoPdf.response.ok,
  `Student card PDF without official photo failed: ${noPhotoPdf.body.message}`,
);
expect(
  Buffer.isBuffer(noPhotoPdf.body) &&
    noPhotoPdf.body.subarray(0, 5).toString("ascii") === "%PDF-",
  "Student card PDF without official photo signature invalid",
);

const invalidDisposition = await requestBinary(
  `/student-cards/${studentCard1.id}/pdf?disposition=download`,
  { headers: json(secretaryCookie) },
);
expect(
  invalidDisposition.response.status === 400,
  "Invalid PDF disposition was not rejected",
);

const photoUpload = await uploadPhoto(secretaryCookie, student1.id, photoFiles.png);
expect(photoUpload.response.ok, `Official photo upload failed: ${photoUpload.body.message}`);

const pdfInline = await requestBinary(
  `/student-cards/${studentCard1.id}/pdf?disposition=inline`,
  { headers: json(secretaryCookie) },
);
expect(pdfInline.response.ok, `Inline PDF failed: ${pdfInline.body.message}`);
expect(
  Buffer.isBuffer(pdfInline.body) &&
    pdfInline.body.subarray(0, 5).toString("ascii") === "%PDF-",
  "Inline PDF signature invalid",
);
expect(
  pdfInline.response.headers.get("content-type") === "application/pdf",
  "PDF content-type invalid",
);
expect(
  pdfInline.response.headers.get("cache-control") === "no-store, private",
  "PDF cache header missing",
);
expect(
  pdfInline.response.headers.get("x-content-type-options") === "nosniff",
  "PDF nosniff header missing",
);
expect(
  pdfInline.response.headers.get("referrer-policy") === "no-referrer",
  "PDF referrer policy header missing",
);
expect(
  (pdfInline.response.headers.get("content-disposition") ?? "").includes("inline"),
  "Inline PDF disposition header invalid",
);

const pdfAttachment = await requestBinary(
  `/student-cards/${studentCard1.id}/pdf?disposition=attachment`,
  { headers: json(adminCookie) },
);
expect(pdfAttachment.response.ok, `Attachment PDF failed: ${pdfAttachment.body.message}`);
expect(
  (pdfAttachment.response.headers.get("content-disposition") ?? "").includes(
    "attachment",
  ),
  "Attachment PDF disposition header invalid",
);

const missingCardPdf = await requestBinary(
  "/student-cards/00000000-0000-0000-0000-000000000000/pdf",
  { headers: json(secretaryCookie) },
);
expect(missingCardPdf.response.status === 404, "Missing student card PDF was not 404");

const afterPdfCard = await prisma.studentCard.findUnique({
  where: { id: studentCard1.id },
});
expect(afterPdfCard?.id === beforePdfCard?.id, "PDF changed StudentCard id");
expect(
  afterPdfCard?.cardNumber === beforePdfCard?.cardNumber,
  "PDF changed cardNumber",
);
expect(
  afterPdfCard?.sequenceNumber === beforePdfCard?.sequenceNumber,
  "PDF changed sequenceNumber",
);
expect(
  afterPdfCard?.enrollmentId === beforePdfCard?.enrollmentId,
  "PDF changed Enrollment",
);

const secondPhoto = await uploadPhoto(adminCookie, student2.id, photoFiles.jpg);
expect(secondPhoto.response.ok, `JPG official photo upload failed: ${secondPhoto.body.message}`);

const studentCard2 = await prisma.studentCard.findFirst({
  where: {
    studentId: student2.id,
    enrollmentId: student2.enrollments[0].id,
    cardType: "STUDENT",
    status: "ACTIVE",
  },
});
expect(Boolean(studentCard2), "Second automatic STUDENT card was not created");
expect(
  studentCard2?.cardNumber === `${studentSequenceStart + 2}${yearValue}`,
  "Second automatic STUDENT number invalid",
);

const jpgPdf = await requestBinary(
  `/student-cards/${studentCard2.id}/pdf?disposition=inline`,
  { headers: json(adminCookie) },
);
expect(jpgPdf.response.ok, `JPG photo PDF failed: ${jpgPdf.body.message}`);
expect(
  Buffer.isBuffer(jpgPdf.body) &&
    jpgPdf.body.subarray(0, 5).toString("ascii") === "%PDF-",
  "JPG photo PDF signature invalid",
);
const afterPdfCardCount = await prisma.studentCard.count();
expect(
  afterPdfCardCount === beforePdfCardCount,
  "PDF generation created unexpected StudentCard records",
);

const duplicateStudentCard = await issueCard(secretaryCookie, student2.id, {
  enrollmentId: student2.enrollments[0].id,
  cardType: "STUDENT",
});
expect(
  duplicateStudentCard.response.status === 400 ||
    duplicateStudentCard.response.status === 409,
  "Duplicate STUDENT card was not blocked",
);

const boardWithoutMembership = await issueCard(secretaryCookie, student2.id, {
  enrollmentId: student2.enrollments[0].id,
  cardType: "BOARD_MEMBER",
});
expect(
  boardWithoutMembership.response.status === 400,
  "BOARD_MEMBER without active membership was not blocked",
);

const boardMembership = await startBoard(secretaryCookie, student1.id);
const blockedStudentCard = await issueCard(secretaryCookie, student1.id, {
  enrollmentId: student1.enrollments[0].id,
  cardType: "STUDENT",
});
expect(
  blockedStudentCard.response.status === 400 ||
    blockedStudentCard.response.status === 409,
  "STUDENT card with active board membership was not blocked",
);

const boardCard = await issueCard(secretaryCookie, student1.id, {
  enrollmentId: student1.enrollments[0].id,
  cardType: "BOARD_MEMBER",
});
expect(boardCard.response.ok, `BOARD_MEMBER failed: ${boardCard.body.message}`);
expect(
  boardCard.body.cardNumber === `${boardSequenceStart + 1}${yearValue}`,
  "First BOARD_MEMBER number invalid",
);

const invalidatedStudentCard = await prisma.studentCard.findUnique({
  where: { id: studentCard1.id },
});
expect(
  invalidatedStudentCard?.status === "INVALIDATED",
  "BOARD_MEMBER did not invalidate previous STUDENT",
);

await endBoard(secretaryCookie, student1.id, boardMembership.id);
const invalidatedBoardCard = await prisma.studentCard.findUnique({
  where: { id: boardCard.body.id },
});
expect(
  invalidatedBoardCard?.status === "INVALIDATED",
  "Ending board membership did not invalidate BOARD_MEMBER",
);

const manualStudentCard = await issueCard(secretaryCookie, student1.id, {
  enrollmentId: student1.enrollments[0].id,
  cardType: "STUDENT",
});
expect(manualStudentCard.response.ok, "Manual STUDENT after board end failed");
expect(
  manualStudentCard.body.cardNumber === `${studentSequenceStart + 3}${yearValue}`,
  "Manual STUDENT did not use next STUDENT sequence",
);

await assignBus(secretaryCookie, student2.enrollments[0].id, bus.id);
await suspendStudent(secretaryCookie, student2.id);
const suspendedList = await request(
  `/student-cards?search=${encodeURIComponent(student2.person.cpf)}&validity=notUsable`,
  { headers: json(secretaryCookie) },
);
expect(suspendedList.response.ok, "Suspended validity list failed");
expect(
  suspendedList.body.data.some((card) => card.id === studentCard2.id),
  "Suspended student card did not become derived not usable",
);
const blockedSuspendedIssue = await issueCard(secretaryCookie, student2.id, {
  enrollmentId: student2.enrollments[0].id,
  cardType: "STUDENT",
});
expect(
  blockedSuspendedIssue.response.status === 400 ||
    blockedSuspendedIssue.response.status === 409,
  "Suspended student card issue was not blocked",
);
await reactivateStudent(secretaryCookie, student2.id);
const reactivatedCard = await prisma.studentCard.findUnique({
  where: { id: studentCard2.id },
});
expect(
  reactivatedCard?.status === "ACTIVE",
  "Reactivation should not invalidate existing card",
);

await terminateStudent(secretaryCookie, student2.id);
const terminatedCard = await prisma.studentCard.findUnique({
  where: { id: studentCard2.id },
});
expect(
  terminatedCard?.status === "INVALIDATED" &&
    terminatedCard.invalidationReason === "STUDENT_TERMINATED",
  "Termination did not invalidate active card",
);

const reenrolled = await reenroll(secretaryCookie, student1.id, {
  academicYearId: nextAcademicYear.id,
  institutionId: institution.id,
  shiftId: shift.id,
  course: "Tecnico em Contabilidade",
  grade: "2o",
  note: `smoke ${runId}`,
});
const nextYearCard = await issueCard(secretaryCookie, student1.id, {
  enrollmentId: reenrolled.id,
  cardType: "STUDENT",
});
expect(nextYearCard.response.ok, "Next year STUDENT failed");
expect(
  nextYearCard.body.cardNumber === `${nextYearStudentSequenceStart + 1}${yearValue + 1}`,
  "New academic year did not restart STUDENT sequence",
);

const manualInvalidated = await invalidateCard(
  secretaryCookie,
  student1.id,
  manualStudentCard.body.id,
  "MANUAL_CORRECTION",
);
expect(manualInvalidated.status === "INVALIDATED", "Manual invalidation failed");

const notUsablePage1 = await request(
  `/student-cards?academicYearId=${academicYear.id}&validity=notUsable&limit=1&page=1&sort=cardNumber&order=asc`,
  { headers: json(secretaryCookie) },
);
const notUsablePage2 = await request(
  `/student-cards?academicYearId=${academicYear.id}&validity=notUsable&limit=1&page=2&sort=cardNumber&order=asc`,
  { headers: json(secretaryCookie) },
);
expect(
  notUsablePage1.response.ok && notUsablePage2.response.ok,
  "Not-usable student card pagination failed",
);
expect(
  notUsablePage1.body.pagination.total >= 2 &&
    notUsablePage1.body.pagination.total === notUsablePage2.body.pagination.total,
  "Not-usable student card total is inconsistent",
);
expect(
  notUsablePage1.body.data.length === 1 && notUsablePage2.body.data.length === 1,
  "Not-usable student card pages have holes",
);
expect(
  notUsablePage1.body.data.every((card) => card.validity.usable === false) &&
    notUsablePage2.body.data.every((card) => card.validity.usable === false),
  "Not-usable filter returned usable card",
);
expect(
  notUsablePage1.body.data[0].id !== notUsablePage2.body.data[0].id,
  "Not-usable pagination repeated the same card",
);

const usableNextYear = await request(
  `/student-cards?academicYearId=${nextAcademicYear.id}&cardType=STUDENT&status=ACTIVE&validity=usable&search=${encodeURIComponent(student1.person.cpf)}&limit=1&page=1`,
  { headers: json(secretaryCookie) },
);
expect(usableNextYear.response.ok, "Usable student card combined filter failed");
expect(usableNextYear.body.pagination.total === 1, "Usable combined total is wrong");
expect(
  usableNextYear.body.data.length === 1 &&
    usableNextYear.body.data[0].id === nextYearCard.body.id &&
    usableNextYear.body.data[0].validity.usable === true,
  "Usable combined filter returned wrong card",
);

const historyCount = await prisma.studentHistoryEvent.count({
  where: {
    studentId: student1.id,
    eventType: { in: ["STUDENT_CARD_ISSUED", "STUDENT_CARD_INVALIDATED"] },
  },
});
expect(historyCount >= 4, "Student card history events were not recorded");

const auditLogs = await prisma.administrativeAuditLog.findMany({
  where: {
    eventType: { in: ["STUDENT_CARD_ISSUED", "STUDENT_CARD_INVALIDATED"] },
    createdAt: { gte: new Date(Date.now() - 1000 * 60 * 20) },
  },
  take: 20,
});
expect(auditLogs.length > 0, "Student card audit logs were not recorded");
const auditText = JSON.stringify(auditLogs.map((log) => log.metadata));
expect(!auditText.includes(student1.person.cpf), "Audit metadata leaked CPF");
expect(!auditText.includes(student2.person.cpf), "Audit metadata leaked CPF");

const finalList = await request(`/student-cards?academicYearId=${academicYear.id}`, {
  headers: json(secretaryCookie),
});
expect(finalList.response.ok, "Student card listing failed");
expect(
  finalList.body.data.every((card) => !card.pdfUrl && !card.qrCode),
  "Student cards exposed PDF or QR data in Sprint 9",
);

await prisma.$disconnect();
console.log(`Sprint 9 student cards smoke OK (${runId})`);
