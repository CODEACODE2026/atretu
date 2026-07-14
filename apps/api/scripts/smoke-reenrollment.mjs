import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s8-${Date.now()}`;

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 8 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 8 smoke");
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

async function assign(cookie, enrollmentId, busId) {
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

async function reenroll(cookie, studentId, payload) {
  return request(`/students/${studentId}/reenroll`, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(payload),
  });
}

function studentPayload({ cpf, academicYearId, institutionId, shiftId, suffix }) {
  return {
    person: {
      fullName: `Academico ${suffix}`,
      cpf,
      rg: `RG-${suffix}`,
      birthDate: "2001-05-12",
      phone: "49999999999",
      email: `academico-${suffix}@example.com`,
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

function reenrollmentPayload({ academicYearId, institutionId, shiftId, busId }) {
  return {
    academicYearId,
    institutionId,
    shiftId,
    course: "Tecnico em Contabilidade",
    grade: "2o",
    ...(busId ? { busId } : {}),
    note: `Rematricula smoke ${runId}`,
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

async function studentDbState(studentId) {
  return prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: {
          academicYear: true,
          busAssignments: true,
        },
        orderBy: { academicYear: { year: "asc" } },
      },
      historyEvents: true,
    },
  });
}

const anonymous = await reenroll(
  undefined,
  "00000000-0000-0000-0000-000000000000",
  {
    institutionId: "00000000-0000-0000-0000-000000000000",
    shiftId: "00000000-0000-0000-0000-000000000000",
    course: "Teste",
    grade: "1o",
  },
);
if (anonymous.response.status !== 401) {
  throw new Error("Anonymous reenrollment access was not blocked");
}

const { adminCookie, secretaryCookie } = await ensureUsers();

const usedYears = new Set(
  (await prisma.academicYear.findMany({ select: { year: true } })).map(
    (item) => item.year,
  ),
);
let oldYearValue = 2000;
while (
  oldYearValue < 2100 &&
  (usedYears.has(oldYearValue) || usedYears.has(oldYearValue + 1))
) {
  oldYearValue += 2;
}
if (oldYearValue >= 2100) {
  throw new Error("No available academic year pair for reenrollment smoke");
}

const oldYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: oldYearValue, isCurrent: false }),
});
if (!oldYear.response.ok) {
  throw new Error(`Old academic year create failed: ${oldYear.body.message}`);
}

const targetYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: oldYearValue + 1, isCurrent: true }),
});
if (!targetYear.response.ok) {
  throw new Error(`Target academic year create failed: ${targetYear.body.message}`);
}
let archivedYearValue = oldYearValue + 2;
while (archivedYearValue <= 2100 && usedYears.has(archivedYearValue)) {
  archivedYearValue += 1;
}
if (archivedYearValue > 2100) {
  archivedYearValue = oldYearValue - 1;
  while (archivedYearValue >= 2000 && usedYears.has(archivedYearValue)) {
    archivedYearValue -= 1;
  }
}
if (archivedYearValue < 2000 || archivedYearValue > 2100) {
  throw new Error("No available archived academic year for reenrollment smoke");
}
const archivedYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: archivedYearValue, isCurrent: false }),
});
if (!archivedYear.response.ok) {
  throw new Error(`Archived academic year create failed: ${archivedYear.body.message}`);
}
await request(`/academic-years/${archivedYear.body.id}/archive`, {
  method: "PATCH",
  headers: json(adminCookie),
});

const institution = await createBaseRecord(adminCookie, "/institutions", {
  name: `Instituicao ${runId}`,
});
const inactiveInstitution = await createBaseRecord(adminCookie, "/institutions", {
  name: `Instituicao Inativa ${runId}`,
});
await request(`/institutions/${inactiveInstitution.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});

const shift = await createBaseRecord(adminCookie, "/shifts", {
  name: `Turno ${runId}`,
});
const inactiveShift = await createBaseRecord(adminCookie, "/shifts", {
  name: `Turno Inativo ${runId}`,
});
await request(`/shifts/${inactiveShift.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});

const previousBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus anterior ${runId}`,
  capacity: 10,
});
const newBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus novo ${runId}`,
  capacity: 1,
});
const fullBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus lotado ${runId}`,
  capacity: 1,
});
const inactiveBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus inativo ${runId}`,
  capacity: 1,
});
await request(`/buses/${inactiveBus.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});

const baseSeed = Date.now() % 600000000;
const noBusStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed),
    academicYearId: oldYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-sem-onibus`,
  }),
);
await assign(secretaryCookie, noBusStudent.enrollments[0].id, previousBus.id);

const preview = await request(
  `/students/${noBusStudent.id}/reenrollment-preview?academicYearId=${targetYear.body.id}`,
  { headers: json(secretaryCookie) },
);
if (
  !preview.response.ok ||
  preview.body.eligible !== true ||
  preview.body.previousBusAssignment?.bus.id !== previousBus.id
) {
  throw new Error("Reenrollment preview did not expose eligibility/reference bus");
}

const candidates = await request(
  `/students/reenrollment-candidates?academicYearId=${targetYear.body.id}&search=${encodeURIComponent(runId)}`,
  { headers: json(secretaryCookie) },
);
if (
  !candidates.response.ok ||
  !candidates.body.data.some((item) => item.id === noBusStudent.id)
) {
  throw new Error("Reenrollment candidates did not include eligible student");
}
const archivedCandidates = await request(
  `/students/reenrollment-candidates?academicYearId=${archivedYear.body.id}`,
  { headers: json(secretaryCookie) },
);
if (archivedCandidates.response.status !== 400) {
  throw new Error("Archived academic year was allowed in reenrollment candidates");
}
const archivedReenrollment = await reenroll(
  secretaryCookie,
  noBusStudent.id,
  reenrollmentPayload({
    academicYearId: archivedYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (archivedReenrollment.response.status !== 400) {
  throw new Error("Archived academic year was allowed in reenrollment");
}

const noBusReenrollment = await reenroll(
  secretaryCookie,
  noBusStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (!noBusReenrollment.response.ok) {
  throw new Error(`No-bus reenrollment failed: ${noBusReenrollment.body.message}`);
}

let noBusDb = await studentDbState(noBusStudent.id);
if (!noBusDb || noBusDb.enrollments.length !== 2) {
  throw new Error("Previous enrollment was not preserved");
}
const newNoBusEnrollment = noBusDb.enrollments.find(
  (item) => item.academicYearId === targetYear.body.id,
);
if (!newNoBusEnrollment || newNoBusEnrollment.busAssignments.length !== 0) {
  throw new Error("No-bus reenrollment created unexpected bus assignment");
}

const duplicate = await reenroll(
  secretaryCookie,
  noBusStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (duplicate.response.status !== 409) {
  throw new Error("Duplicate reenrollment was not blocked");
}

const busStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 1),
    academicYearId: oldYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-com-onibus`,
  }),
);
const busReenrollment = await reenroll(
  secretaryCookie,
  busStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    busId: newBus.id,
  }),
);
if (!busReenrollment.response.ok) {
  throw new Error(`Bus reenrollment failed: ${busReenrollment.body.message}`);
}
const busDb = await studentDbState(busStudent.id);
const newBusEnrollment = busDb?.enrollments.find(
  (item) => item.academicYearId === targetYear.body.id,
);
if (
  !newBusEnrollment ||
  newBusEnrollment.busAssignments.filter((item) => item.status === "ACTIVE")
    .length !== 1
) {
  throw new Error("Bus reenrollment did not create active bus assignment");
}

const fillerStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 2),
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-lotador`,
  }),
);
await assign(secretaryCookie, fillerStudent.enrollments[0].id, fullBus.id);

const fullBusStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 3),
    academicYearId: oldYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-lotado`,
  }),
);
const fullBlocked = await reenroll(
  secretaryCookie,
  fullBusStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    busId: fullBus.id,
  }),
);
if (fullBlocked.response.status !== 409) {
  throw new Error("Full bus reenrollment was not blocked");
}
const fullBlockedDb = await studentDbState(fullBusStudent.id);
if (!fullBlockedDb || fullBlockedDb.enrollments.length !== 1) {
  throw new Error("Full bus failure left partial enrollment");
}

const inactiveBusBlocked = await reenroll(
  secretaryCookie,
  fullBusStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    busId: inactiveBus.id,
  }),
);
if (inactiveBusBlocked.response.status !== 400) {
  throw new Error("Inactive bus reenrollment was not blocked");
}

const inactiveInstitutionBlocked = await reenroll(
  secretaryCookie,
  fullBusStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: inactiveInstitution.id,
    shiftId: shift.id,
  }),
);
if (inactiveInstitutionBlocked.response.status !== 400) {
  throw new Error("Inactive institution reenrollment was not blocked");
}

const inactiveShiftBlocked = await reenroll(
  secretaryCookie,
  fullBusStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: inactiveShift.id,
  }),
);
if (inactiveShiftBlocked.response.status !== 400) {
  throw new Error("Inactive shift reenrollment was not blocked");
}

const missingYearBlocked = await reenroll(
  secretaryCookie,
  fullBusStudent.id,
  reenrollmentPayload({
    academicYearId: "00000000-0000-0000-0000-000000000000",
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (missingYearBlocked.response.status !== 400) {
  throw new Error("Missing academic year reenrollment was not blocked");
}

const suspendedStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 4),
    academicYearId: oldYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-suspenso`,
  }),
);
await request(`/students/${suspendedStudent.id}/suspend`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    reason: "OTHER",
    justification: "Smoke Sprint 8",
    releaseBusSeat: false,
  }),
});
const suspendedBlocked = await reenroll(
  secretaryCookie,
  suspendedStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (suspendedBlocked.response.status !== 400) {
  throw new Error("Suspended student reenrollment was not blocked");
}

const terminatedStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 5),
    academicYearId: oldYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-desligado`,
  }),
);
await request(`/students/${terminatedStudent.id}/terminate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    terminationReason: "WITHDRAWAL",
    justification: "Smoke Sprint 8",
  }),
});
const terminatedBlocked = await reenroll(
  secretaryCookie,
  terminatedStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (terminatedBlocked.response.status !== 400) {
  throw new Error("Terminated student reenrollment was not blocked");
}

const boardStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 6),
    academicYearId: oldYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-diretoria`,
  }),
);
await request(`/students/${boardStudent.id}/board-memberships`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ note: "Diretoria smoke Sprint 8" }),
});
const boardReenrollment = await reenroll(
  secretaryCookie,
  boardStudent.id,
  reenrollmentPayload({
    academicYearId: targetYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
  }),
);
if (!boardReenrollment.response.ok) {
  throw new Error("Active board membership should not block reenrollment");
}

const history = await request(`/students/${busStudent.id}/history`, {
  headers: json(secretaryCookie),
});
if (
  !history.response.ok ||
  !history.body.data.some((item) => item.eventType === "STUDENT_REENROLLED")
) {
  throw new Error("Reenrollment history event was not created");
}

const audits = await prisma.administrativeAuditLog.findMany({
  where: {
    eventType: {
      in: ["STUDENT_REENROLLED", "ENROLLMENT_CREATED", "BUS_ASSIGNMENT_LINKED"],
    },
    createdAt: { gte: new Date(Date.now() - 1000 * 60 * 10) },
  },
  orderBy: { createdAt: "desc" },
  take: 50,
});
if (!audits.some((item) => item.eventType === "STUDENT_REENROLLED")) {
  throw new Error("Reenrollment audit event was not created");
}
const auditText = JSON.stringify(audits.map((item) => item.metadata));
for (const sensitive of [noBusStudent.person.cpf, busStudent.person.cpf, "RG-"]) {
  if (auditText.includes(sensitive)) {
    throw new Error("Sensitive data found in reenrollment audit metadata");
  }
}

await prisma.$disconnect();
console.log("Sprint 8 reenrollment smoke OK");
