import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s7-${Date.now()}`;

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 7 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 7 smoke");
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

async function occupancy(cookie, busId, academicYearId) {
  const list = await request(
    `/buses?status=all&academicYearId=${academicYearId}&search=${encodeURIComponent(runId)}`,
    { headers: json(cookie) },
  );
  if (!list.response.ok) {
    throw new Error("Bus occupancy list failed");
  }
  const bus = list.body.data.find((item) => item.id === busId);
  if (!bus) {
    throw new Error("Bus not found for occupancy");
  }
  return bus;
}

async function getStudent(cookie, id) {
  const result = await request(`/students/${id}`, { headers: json(cookie) });
  if (!result.response.ok) {
    throw new Error(`Student detail failed: ${result.body.message}`);
  }
  return result.body;
}

const anonymous = await request(
  "/students/00000000-0000-0000-0000-000000000000/suspend",
  {
    method: "POST",
    headers: json(),
    body: JSON.stringify({
      reason: "NON_PAYMENT",
      justification: "anonimo",
      releaseBusSeat: false,
    }),
  },
);
if (anonymous.response.status !== 401) {
  throw new Error("Anonymous lifecycle access was not blocked");
}

const { adminCookie, secretaryCookie } = await ensureUsers();

const usedYears = new Set(
  (await prisma.academicYear.findMany({ select: { year: true } })).map(
    (item) => item.year,
  ),
);
let smokeYear = 2097;
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
const keepBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Mantem`,
  capacity: 1,
});
const releaseBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Libera`,
  capacity: 1,
});
const fullBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Lotado`,
  capacity: 1,
});
const boardBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Diretoria`,
  capacity: 1,
});

const baseSeed = Date.now() % 700000000;
const keepStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-mantem`,
  }),
);
const releaseStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 1),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-libera`,
  }),
);
const fillerStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 2),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-lotador`,
  }),
);
const boardStudent = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 3),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-diretoria`,
  }),
);

await assign(secretaryCookie, keepStudent.enrollments[0].id, keepBus.id);
await assign(secretaryCookie, releaseStudent.enrollments[0].id, releaseBus.id);
await assign(secretaryCookie, fillerStudent.enrollments[0].id, fullBus.id);
await assign(secretaryCookie, boardStudent.enrollments[0].id, boardBus.id);

const suspendWithoutJustification = await request(
  `/students/${keepStudent.id}/suspend`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({ reason: "NON_PAYMENT", releaseBusSeat: false }),
  },
);
if (suspendWithoutJustification.response.status !== 400) {
  throw new Error("Suspension without justification was not blocked");
}

const suspendKeep = await request(`/students/${keepStudent.id}/suspend`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    reason: "INFRACTION",
    justification: "Teste mantendo vaga",
    releaseBusSeat: false,
  }),
});
if (!suspendKeep.response.ok || suspendKeep.body.status !== "SUSPENDED") {
  throw new Error(`Suspension keeping seat failed: ${suspendKeep.body.message}`);
}

let keepOccupancy = await occupancy(
  secretaryCookie,
  keepBus.id,
  academicYear.body.id,
);
if (keepOccupancy.occupiedSeats !== 1 || keepOccupancy.availableSeats !== 0) {
  throw new Error("Suspension keeping seat changed occupancy");
}

const repeatedSuspend = await request(`/students/${keepStudent.id}/suspend`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    reason: "INFRACTION",
    justification: "Repetida",
    releaseBusSeat: false,
  }),
});
if (repeatedSuspend.response.status !== 400) {
  throw new Error("Repeated suspension was not blocked");
}

const reactivateKeep = await request(`/students/${keepStudent.id}/reactivate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ note: "Reativando com vaga mantida" }),
});
if (!reactivateKeep.response.ok || reactivateKeep.body.status !== "ACTIVE") {
  throw new Error(`Reactivation keeping seat failed: ${reactivateKeep.body.message}`);
}

keepOccupancy = await occupancy(secretaryCookie, keepBus.id, academicYear.body.id);
if (keepOccupancy.occupiedSeats !== 1 || keepOccupancy.availableSeats !== 0) {
  throw new Error("Reactivation keeping seat changed occupancy");
}

const suspendRelease = await request(`/students/${releaseStudent.id}/suspend`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    reason: "NON_PAYMENT",
    justification: "Teste liberando vaga",
    releaseBusSeat: true,
  }),
});
if (!suspendRelease.response.ok || suspendRelease.body.status !== "SUSPENDED") {
  throw new Error(`Suspension releasing seat failed: ${suspendRelease.body.message}`);
}

let releaseOccupancy = await occupancy(
  secretaryCookie,
  releaseBus.id,
  academicYear.body.id,
);
if (releaseOccupancy.occupiedSeats !== 0 || releaseOccupancy.availableSeats !== 1) {
  throw new Error("Suspension releasing seat did not free availability");
}

const reactivateFull = await request(`/students/${releaseStudent.id}/reactivate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: fullBus.id }),
});
if (reactivateFull.response.status !== 409) {
  throw new Error("Reactivation to full bus was not blocked");
}
let releaseDetail = await getStudent(secretaryCookie, releaseStudent.id);
if (releaseDetail.status !== "SUSPENDED") {
  throw new Error("Failed reactivation changed student status");
}

const reactivateRelease = await request(`/students/${releaseStudent.id}/reactivate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: releaseBus.id, note: "Reativando com nova vaga" }),
});
if (!reactivateRelease.response.ok || reactivateRelease.body.status !== "ACTIVE") {
  throw new Error(`Reactivation with new bus failed: ${reactivateRelease.body.message}`);
}
releaseOccupancy = await occupancy(secretaryCookie, releaseBus.id, academicYear.body.id);
if (releaseOccupancy.occupiedSeats !== 1 || releaseOccupancy.availableSeats !== 0) {
  throw new Error("Reactivation with new bus occupancy failed");
}

const boardStart = await request(`/students/${releaseStudent.id}/board-memberships`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ note: "Entrada smoke" }),
});
if (!boardStart.response.ok || boardStart.body.status !== "ACTIVE") {
  throw new Error(`Board start failed: ${boardStart.body.message}`);
}
releaseDetail = await getStudent(secretaryCookie, releaseStudent.id);
if (releaseDetail.canReceiveFutureInvoices !== false) {
  throw new Error("Board membership did not disable future billing eligibility");
}

const duplicateBoard = await request(
  `/students/${releaseStudent.id}/board-memberships`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({}),
  },
);
if (duplicateBoard.response.status !== 409) {
  throw new Error("Duplicate board membership was not blocked");
}

const boardEnd = await request(
  `/students/${releaseStudent.id}/board-memberships/${boardStart.body.id}/end`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({ note: "Saida smoke" }),
  },
);
if (!boardEnd.response.ok || boardEnd.body.status !== "ENDED") {
  throw new Error(`Board end failed: ${boardEnd.body.message}`);
}
releaseDetail = await getStudent(secretaryCookie, releaseStudent.id);
if (releaseDetail.canReceiveFutureInvoices !== true) {
  throw new Error("Board end did not restore future billing eligibility");
}

const boardAgain = await request(`/students/${releaseStudent.id}/board-memberships`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ note: "Retorno smoke" }),
});
if (!boardAgain.response.ok || boardAgain.body.status !== "ACTIVE") {
  throw new Error("Board re-entry failed");
}

const terminateWithBoard = await request(`/students/${releaseStudent.id}/terminate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    terminationReason: "WITHDRAWAL",
    justification: "Desligamento com diretoria ativa",
  }),
});
if (!terminateWithBoard.response.ok || terminateWithBoard.body.status !== "TERMINATED") {
  throw new Error(`Termination with board failed: ${terminateWithBoard.body.message}`);
}

releaseDetail = await getStudent(secretaryCookie, releaseStudent.id);
if (
  releaseDetail.activeBoardMembership !== null ||
  releaseDetail.canReceiveFutureInvoices !== false
) {
  throw new Error("Termination did not close active board membership");
}
releaseOccupancy = await occupancy(secretaryCookie, releaseBus.id, academicYear.body.id);
if (releaseOccupancy.occupiedSeats !== 0 || releaseOccupancy.availableSeats !== 1) {
  throw new Error("Termination did not release bus seat");
}

const reactivateTerminated = await request(`/students/${releaseStudent.id}/reactivate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({}),
});
if (reactivateTerminated.response.status !== 400) {
  throw new Error("Terminated reactivation was not blocked");
}

const suspendedBoard = await request(`/students/${releaseStudent.id}/board-memberships`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({}),
});
if (suspendedBoard.response.status !== 400) {
  throw new Error("Terminated board membership was not blocked");
}

const terminateActive = await request(`/students/${keepStudent.id}/terminate`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    terminationReason: "NON_PAYMENT",
    justification: "Desligamento por inadimplencia",
  }),
});
if (!terminateActive.response.ok || terminateActive.body.status !== "TERMINATED") {
  throw new Error(`Termination by non-payment failed: ${terminateActive.body.message}`);
}

const history = await request(`/students/${releaseStudent.id}/history`, {
  headers: json(secretaryCookie),
});
const historyTypes = new Set(history.body.data.map((item) => item.eventType));
for (const expected of [
  "STUDENT_SUSPENDED",
  "STUDENT_REACTIVATED",
  "STUDENT_TERMINATED",
  "BOARD_MEMBERSHIP_STARTED",
  "BOARD_MEMBERSHIP_ENDED",
]) {
  if (!historyTypes.has(expected)) {
    throw new Error(`Missing history event ${expected}`);
  }
}

const boardMemberships = await request(
  `/students/${releaseStudent.id}/board-memberships`,
  { headers: json(secretaryCookie) },
);
if (
  !boardMemberships.response.ok ||
  boardMemberships.body.data.filter((item) => item.status === "ACTIVE").length !== 0 ||
  boardMemberships.body.data.length < 2
) {
  throw new Error("Board membership history was not preserved");
}

const dbState = await prisma.student.findUnique({
  where: { id: releaseStudent.id },
  include: {
    historyEvents: true,
    boardMemberships: true,
    enrollments: { include: { busAssignments: true } },
  },
});
if (!dbState || dbState.status !== "TERMINATED") {
  throw new Error("Database student status invalid after lifecycle smoke");
}
if (dbState.historyEvents.length < 6) {
  throw new Error("Database history event count too low");
}
if (dbState.boardMemberships.some((item) => item.status === "ACTIVE")) {
  throw new Error("Terminated student has active board membership in database");
}
if (
  dbState.enrollments.some((enrollment) =>
    enrollment.busAssignments.some((assignment) => assignment.status === "ACTIVE"),
  )
) {
  throw new Error("Terminated student has active bus assignment");
}

const forbiddenTables = await prisma.$queryRaw`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (
      table_name ILIKE '%invoice%'
      OR table_name ILIKE '%boleto%'
      OR table_name ILIKE '%bank%'
      OR table_name ILIKE '%card%'
      OR table_name ILIKE '%carteirinha%'
    )
`;
if (forbiddenTables.length > 0) {
  throw new Error("Financial/card tables should not exist in Sprint 7");
}

const audits = await prisma.administrativeAuditLog.findMany({
  where: {
    eventType: {
      in: [
        "STUDENT_SUSPENDED",
        "STUDENT_REACTIVATED",
        "STUDENT_TERMINATED",
        "BOARD_MEMBERSHIP_STARTED",
        "BOARD_MEMBERSHIP_ENDED",
      ],
    },
  },
  orderBy: { createdAt: "desc" },
  take: 20,
});
if (audits.length < 5) {
  throw new Error("Lifecycle audit validation failed");
}
const auditText = JSON.stringify(audits.map((item) => item.metadata));
for (const sensitive of [keepStudent.person.cpf, releaseStudent.person.cpf, "RG-"]) {
  if (auditText.includes(sensitive)) {
    throw new Error("Sensitive data found in lifecycle audit metadata");
  }
}

await prisma.$disconnect();
console.log("Sprint 7 lifecycle smoke OK");
