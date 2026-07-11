import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rm } from "node:fs/promises";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s6-${Date.now()}`;

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 6 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 6 smoke");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.arrayBuffer();
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

async function publicSubmit(payload, files = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== "") {
      form.set(key, String(value));
    }
  }
  for (const [key, file] of Object.entries(files)) {
    form.set(key, new Blob([file.buffer], { type: file.mimeType }), file.name);
  }
  return request("/public/pre-registrations", {
    method: "POST",
    body: form,
  });
}

function preRegistrationPayload({
  cpf,
  academicYearId,
  institutionId,
  shiftId,
  suffix,
  birthDate = "2001-05-12",
}) {
  return {
    fullName: `Pre Cadastro ${suffix}`,
    cpf,
    rg: `RG-${suffix}`,
    birthDate,
    phone: "49999999999",
    email: `pre-${suffix}@example.com`,
    addressStreet: `Rua ${suffix}`,
    addressNumber: "123",
    addressNeighborhood: "Centro",
    addressCity: "Terra Rica",
    guardianFullName: `Responsavel ${suffix}`,
    guardianCpf: generateCpf(650000000 + suffix.length),
    guardianRg: `RGR-${suffix}`,
    academicYearId,
    institutionId,
    shiftId,
    course: "Tecnico em Administracao",
    grade: "1o",
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

async function cleanupStorage() {
  const storageDir = process.env.DOCUMENT_STORAGE_DIR ?? "";
  if (storageDir.includes("atretu-pre-registration-smoke")) {
    await rm(storageDir, { recursive: true, force: true });
  }
}

async function countAcademicRecordsByCpf(cpf) {
  const person = await prisma.person.findUnique({
    where: { cpf },
    include: { student: { include: { enrollments: true } } },
  });
  return {
    personCount: person ? 1 : 0,
    studentCount: person?.student ? 1 : 0,
    enrollmentCount: person?.student?.enrollments.length ?? 0,
    studentId: person?.student?.id,
    enrollmentIds: person?.student?.enrollments.map((item) => item.id) ?? [],
  };
}

async function forbiddenOperationalTables() {
  return prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        table_name ILIKE '%boleto%'
        OR table_name ILIKE '%financial%'
        OR table_name ILIKE '%finance%'
        OR table_name ILIKE '%invoice%'
        OR table_name ILIKE '%payment%'
        OR table_name ILIKE '%carteir%'
        OR table_name ILIKE '%card%'
      )
  `;
}

const files = {
  pdf: {
    name: "documento.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"),
  },
  jpeg: {
    name: "documento.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]),
  },
  png: {
    name: "documento.png",
    mimeType: "image/png",
    buffer: Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]),
  },
  svg: {
    name: "documento.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
  },
  oversized: {
    name: "grande.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2048, 0x31)]),
  },
  traversal: {
    name: "..evil.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
  },
};

try {
  const { adminCookie, secretaryCookie } = await ensureUsers();

  const usedYears = new Set(
    (await prisma.academicYear.findMany({ select: { year: true } })).map(
      (item) => item.year,
    ),
  );
  let smokeYear = 2088;
  while (usedYears.has(smokeYear)) {
    smokeYear -= 1;
  }

  const academicYear = await request("/academic-years", {
    method: "POST",
    headers: json(adminCookie),
    body: JSON.stringify({ year: smokeYear, isCurrent: true }),
  });
  if (!academicYear.response.ok) {
    throw new Error(`Academic year create failed: ${academicYear.body.message}`);
  }

  const institution = await createBaseRecord(adminCookie, "/institutions", {
    name: `Instituicao ${runId}`,
  });
  const shift = await createBaseRecord(adminCookie, "/shifts", {
    name: `Turno ${runId}`,
  });
  const inactiveInstitution = await createBaseRecord(adminCookie, "/institutions", {
    name: `Instituicao Inativa ${runId}`,
  });
  const inactiveShift = await createBaseRecord(adminCookie, "/shifts", {
    name: `Turno Inativo ${runId}`,
  });
  await request(`/institutions/${inactiveInstitution.id}/inactivate`, {
    method: "PATCH",
    headers: json(adminCookie),
  });
  await request(`/shifts/${inactiveShift.id}/inactivate`, {
    method: "PATCH",
    headers: json(adminCookie),
  });

  const options = await request("/public/pre-registration/options");
  if (
    !options.response.ok ||
    !options.body.academicYears.some((item) => item.id === academicYear.body.id) ||
    !options.body.institutions.some((item) => item.id === institution.id) ||
    !options.body.shifts.some((item) => item.id === shift.id)
  ) {
    throw new Error("Public options did not return expected active references");
  }
  if (
    options.body.institutions.some((item) => item.id === inactiveInstitution.id) ||
    options.body.shifts.some((item) => item.id === inactiveShift.id)
  ) {
    throw new Error("Public options exposed inactive references");
  }

  const anonymousAdmin = await request("/pre-registrations");
  if (anonymousAdmin.response.status !== 401) {
    throw new Error("Anonymous admin pre-registration list was not blocked");
  }

  const invalidCpf = await publicSubmit(
    preRegistrationPayload({
      cpf: "00000000000",
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-invalid-cpf`,
    }),
  );
  if (invalidCpf.response.status !== 400) {
    throw new Error("Invalid CPF was not blocked");
  }

  const futureBirth = await publicSubmit(
    preRegistrationPayload({
      cpf: generateCpf(100000001),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-future`,
      birthDate: "2999-01-01",
    }),
  );
  if (futureBirth.response.status !== 400) {
    throw new Error("Future birth date was not blocked");
  }

  const incompleteAddressPayload = preRegistrationPayload({
    cpf: generateCpf(100000002),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-address`,
  });
  delete incompleteAddressPayload.addressCity;
  const incompleteAddress = await publicSubmit(incompleteAddressPayload);
  if (incompleteAddress.response.status !== 400) {
    throw new Error("Incomplete address was not blocked");
  }

  const inactiveReference = await publicSubmit(
    preRegistrationPayload({
      cpf: generateCpf(100000003),
      academicYearId: academicYear.body.id,
      institutionId: inactiveInstitution.id,
      shiftId: inactiveShift.id,
      suffix: `${runId}-inactive`,
    }),
  );
  if (inactiveReference.response.status !== 400) {
    throw new Error("Inactive institution/shift were not blocked");
  }

  const honeypotCpf = generateCpf(100000004);
  const honeypot = await publicSubmit({
    ...preRegistrationPayload({
      cpf: honeypotCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-honeypot`,
    }),
    website: "filled",
  });
  if (!honeypot.response.ok || honeypot.body.publicCode) {
    throw new Error("Honeypot did not return generic success");
  }
  const honeypotCount = await prisma.publicPreRegistration.count({
    where: { cpf: honeypotCpf },
  });
  if (honeypotCount !== 0) {
    throw new Error("Honeypot created a pre-registration");
  }

  let rateLimited = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const limited = await publicSubmit(
      preRegistrationPayload({
        cpf: "11111111111",
        academicYearId: academicYear.body.id,
        institutionId: institution.id,
        shiftId: shift.id,
        suffix: `${runId}-rate-${attempt}`,
      }),
    );
    if (limited.response.status === 429) {
      rateLimited = true;
      break;
    }
  }
  if (!rateLimited) {
    throw new Error("Pre-registration rate limit was not enforced");
  }

  const duplicateCpf = generateCpf(100000005);
  const pending = await publicSubmit(
    preRegistrationPayload({
      cpf: duplicateCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-pending`,
    }),
  );
  if (!pending.response.ok || !pending.body.publicCode) {
    throw new Error(`Pending pre-registration failed: ${pending.body.message}`);
  }
  const duplicatePending = await publicSubmit(
    preRegistrationPayload({
      cpf: duplicateCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-duplicate`,
    }),
  );
  if (
    duplicatePending.response.status !== 409 ||
    duplicatePending.body.message !== "Solicitacao nao pode ser recebida"
  ) {
    throw new Error("Duplicate pending CPF was not blocked generically");
  }

  const rejectedCpf = generateCpf(100000006);
  const rejectedInitial = await publicSubmit(
    preRegistrationPayload({
      cpf: rejectedCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-reject`,
    }),
  );
  if (!rejectedInitial.response.ok) {
    throw new Error(`Rejected candidate create failed: ${rejectedInitial.body.message}`);
  }
  const rejectedRecord = await prisma.publicPreRegistration.findUnique({
    where: { publicCode: rejectedInitial.body.publicCode },
  });
  const missingReason = await request(
    `/pre-registrations/${rejectedRecord.id}/reject`,
    {
      method: "POST",
      headers: json(secretaryCookie),
      body: JSON.stringify({ reason: "" }),
    },
  );
  if (missingReason.response.status !== 400) {
    throw new Error("Rejection without reason was not blocked");
  }
  const rejected = await request(`/pre-registrations/${rejectedRecord.id}/reject`, {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({ reason: "Dados inconsistentes no envio de teste" }),
  });
  if (!rejected.response.ok || rejected.body.status !== "REJECTED") {
    throw new Error(`Rejection failed: ${rejected.body.message}`);
  }

  const approvalCpf = rejectedCpf;
  const approvedCandidate = await publicSubmit(
    preRegistrationPayload({
      cpf: approvalCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-approve`,
    }),
    {
      cpfDocument: files.pdf,
      rgDocument: files.jpeg,
      proofOfAddressDocument: files.png,
    },
  );
  if (!approvedCandidate.response.ok || !approvedCandidate.body.publicCode) {
    throw new Error(`Resubmission after rejection failed: ${approvedCandidate.body.message}`);
  }

  const beforeApproval = await countAcademicRecordsByCpf(approvalCpf);
  if (
    beforeApproval.personCount !== 0 ||
    beforeApproval.studentCount !== 0 ||
    beforeApproval.enrollmentCount !== 0
  ) {
    throw new Error("Definitive records existed before approval");
  }

  const list = await request("/pre-registrations?status=PENDING", {
    headers: json(secretaryCookie),
  });
  if (!list.response.ok || !JSON.stringify(list.body).includes(approvedCandidate.body.publicCode)) {
    throw new Error("Admin list did not include pending pre-registration");
  }
  if (JSON.stringify(list.body).includes(approvalCpf)) {
    throw new Error("Admin list exposed full CPF");
  }

  const approvalRecord = await prisma.publicPreRegistration.findUnique({
    where: { publicCode: approvedCandidate.body.publicCode },
    include: { documents: true },
  });
  const detail = await request(`/pre-registrations/${approvalRecord.id}`, {
    headers: json(secretaryCookie),
  });
  if (!detail.response.ok || detail.body.documents.length !== 3) {
    throw new Error("Admin detail failed");
  }
  if (
    JSON.stringify(detail.body).includes("storageKey") ||
    JSON.stringify(detail.body).includes("storedFileName")
  ) {
    throw new Error("Admin detail exposed storage internals");
  }

  const download = await request(
    `/pre-registrations/${approvalRecord.id}/documents/${approvalRecord.documents[0].id}/file?disposition=attachment`,
    { headers: json(secretaryCookie) },
  );
  if (!download.response.ok) {
    throw new Error("Protected temporary document download failed");
  }
  if (download.response.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("Pre-registration document nosniff header missing");
  }
  if (download.response.headers.get("cache-control") !== "no-store, private") {
    throw new Error("Pre-registration document cache header missing");
  }

  const invalidSvg = await publicSubmit(
    preRegistrationPayload({
      cpf: generateCpf(100000007),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-svg`,
    }),
    { cpfDocument: files.svg },
  );
  if (invalidSvg.response.status !== 400) {
    throw new Error("Invalid public SVG upload was not blocked");
  }
  const oversized = await publicSubmit(
    preRegistrationPayload({
      cpf: generateCpf(100000008),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-oversized`,
    }),
    { cpfDocument: files.oversized },
  );
  if (oversized.response.status !== 400) {
    throw new Error("Oversized public upload was not blocked");
  }
  const traversal = await publicSubmit(
    preRegistrationPayload({
      cpf: generateCpf(100000009),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-traversal`,
    }),
    { cpfDocument: files.traversal },
  );
  if (traversal.response.status !== 400) {
    throw new Error("Malicious public filename was not blocked");
  }

  const approved = await request(`/pre-registrations/${approvalRecord.id}/approve`, {
    method: "POST",
    headers: json(secretaryCookie),
  });
  if (!approved.response.ok || approved.body.status !== "APPROVED") {
    throw new Error(`Approval failed: ${approved.body.message}`);
  }
  const duplicateApproval = await request(
    `/pre-registrations/${approvalRecord.id}/approve`,
    {
      method: "POST",
      headers: json(adminCookie),
    },
  );
  if (duplicateApproval.response.status !== 400) {
    throw new Error("Second approval was not blocked");
  }

  const afterApproval = await countAcademicRecordsByCpf(approvalCpf);
  if (
    afterApproval.personCount !== 1 ||
    afterApproval.studentCount !== 1 ||
    afterApproval.enrollmentCount !== 1
  ) {
    throw new Error("Approval did not create exactly one Person/Student/Enrollment");
  }

  const busAssignments = await prisma.busAssignment.count({
    where: { enrollmentId: { in: afterApproval.enrollmentIds } },
  });
  if (busAssignments !== 0) {
    throw new Error("Approval created BusAssignment unexpectedly");
  }

  const promotedDocs = await prisma.preRegistrationDocument.findMany({
    where: { preRegistrationId: approvalRecord.id },
  });
  const studentDocs = await prisma.studentDocument.findMany({
    where: { studentId: afterApproval.studentId },
  });
  if (
    promotedDocs.length !== 3 ||
    studentDocs.length !== 3 ||
    promotedDocs.some((item) => item.status !== "PROMOTED") ||
    studentDocs.some((item) => item.status !== "ACTIVE")
  ) {
    throw new Error("Documents were not promoted correctly");
  }
  for (const promoted of promotedDocs) {
    const studentDoc = studentDocs.find(
      (item) => item.id === promoted.promotedToStudentDocumentId,
    );
    if (!studentDoc || studentDoc.storageKey !== promoted.storageKey) {
      throw new Error("Document promotion changed storage unexpectedly");
    }
  }

  const approvedRecord = await prisma.publicPreRegistration.findUnique({
    where: { id: approvalRecord.id },
  });
  if (approvedRecord.status !== "APPROVED") {
    throw new Error("Pre-registration was not marked APPROVED");
  }

  const forbiddenTables = await forbiddenOperationalTables();
  if (forbiddenTables.length > 0) {
    throw new Error(
      `Unexpected financial/card tables found: ${forbiddenTables
        .map((item) => item.table_name)
        .join(", ")}`,
    );
  }

  const auditLogs = await prisma.administrativeAuditLog.findMany({
    where: {
      OR: [
        { domain: "pre_registrations", recordId: approvalRecord.id },
        {
          domain: "pre_registration_documents",
          recordId: { in: approvalRecord.documents.map((item) => item.id) },
        },
      ],
    },
  });
  if (auditLogs.length < 5) {
    throw new Error("Pre-registration audit events were not recorded");
  }
  const auditText = JSON.stringify(auditLogs.map((item) => item.metadata));
  if (
    auditText.includes(approvalCpf) ||
    auditText.includes("RG-") ||
    auditText.includes("Rua ") ||
    auditText.includes("storageKey") ||
    auditText.includes("pre-registrations/")
  ) {
    throw new Error("Audit metadata exposed sensitive data");
  }

  console.log("Sprint 6 pre-registration smoke passed");
} finally {
  await prisma.$disconnect();
  await cleanupStorage();
}
