import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s3-${Date.now()}`;
const runSeed = Number(runId.replace(/\D/g, "").slice(-6));

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 3 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 3 smoke");
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

async function busOccupancy(cookie, busId, academicYearId) {
  const list = await request(
    `/buses?status=active&academicYearId=${academicYearId}&limit=100&search=${encodeURIComponent(runId)}`,
    { headers: json(cookie) },
  );
  if (!list.response.ok) {
    throw new Error("Bus list with occupancy failed");
  }
  return list.body.data.find((item) => item.id === busId);
}

function studentPayload({
  cpf,
  academicYearId,
  institutionId,
  shiftId,
  suffix,
  birthDate = "2001-05-12",
}) {
  return {
    person: {
      fullName: `Academico ${suffix}`,
      cpf,
      rg: `RG-${suffix}`,
      birthDate,
      phone: "49999999999",
      email: `academico-${suffix}@example.com`,
      addressStreet: `Rua ${suffix}`,
      addressNumber: "123",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
    },
    guardian: {
      fullName: `Responsavel ${suffix}`,
      cpf: generateCpf(700 + suffix.length),
      rg: `RGR-${suffix}`,
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

const anonymous = await request("/students");
if (anonymous.response.status !== 401) {
  throw new Error("Anonymous students access was not blocked");
}

const { adminCookie, secretaryCookie } = await ensureUsers();

const usedYears = new Set(
  (await prisma.academicYear.findMany({ select: { year: true } })).map(
    (item) => item.year,
  ),
);
let nextYear = 2099;
function takeYear() {
  while (usedYears.has(nextYear)) {
    nextYear -= 1;
  }
  if (nextYear < 2000) {
    throw new Error("No available academic year for students smoke");
  }
  const year = nextYear;
  usedYears.add(year);
  nextYear -= 1;
  return year;
}
const smokeYear = takeYear();
const rollbackYear = takeYear();

const academicYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: smokeYear }),
});
if (!academicYear.response.ok) {
  throw new Error(`Academic year create failed: ${academicYear.body.message}`);
}

const currentYear = await request(
  `/academic-years/${academicYear.body.id}/set-current`,
  {
    method: "PATCH",
    headers: json(adminCookie),
  },
);
if (!currentYear.response.ok || currentYear.body.isCurrent !== true) {
  throw new Error("Academic year set current failed");
}

const secretaryBlocked = await request("/academic-years", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ year: smokeYear - 1 }),
});
if (secretaryBlocked.response.status !== 403) {
  throw new Error("Secretaria was not blocked from creating academic year");
}

const yearList = await request("/academic-years", {
  headers: json(secretaryCookie),
});
if (
  !yearList.response.ok ||
  yearList.body.data.length < 1 ||
  !yearList.body.data.every((item) => item.status === "ACTIVE")
) {
  throw new Error("Secretaria academic year list failed");
}

const anonymousYears = await request("/academic-years");
if (anonymousYears.response.status !== 401) {
  throw new Error("Anonymous academic year list was not blocked");
}

const editYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (!editYear.response.ok) {
  throw new Error(`Editable academic year create failed: ${editYear.body.message}`);
}
const editedYearValue = takeYear();
const editedYear = await request(`/academic-years/${editYear.body.id}`, {
  method: "PATCH",
  headers: json(adminCookie),
  body: JSON.stringify({ year: editedYearValue }),
});
if (!editedYear.response.ok || editedYear.body.year !== editedYearValue) {
  throw new Error(`Empty academic year edit failed: ${editedYear.body.message}`);
}

const archiveYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (!archiveYear.response.ok) {
  throw new Error(`Archive academic year create failed: ${archiveYear.body.message}`);
}
const archived = await request(`/academic-years/${archiveYear.body.id}/archive`, {
  method: "PATCH",
  headers: json(adminCookie),
});
if (
  !archived.response.ok ||
  archived.body.status !== "ARCHIVED" ||
  !archived.body.archivedAt
) {
  throw new Error(`Academic year archive failed: ${archived.body.message}`);
}
const activeYears = await request("/academic-years", { headers: json(secretaryCookie) });
if (activeYears.body.data.some((item) => item.id === archiveYear.body.id)) {
  throw new Error("Archived academic year appeared in active list");
}
const archivedYears = await request("/academic-years?status=archived", {
  headers: json(secretaryCookie),
});
if (!archivedYears.body.data.some((item) => item.id === archiveYear.body.id)) {
  throw new Error("Archived academic year did not appear in archived list");
}
const allYears = await request("/academic-years?status=all", {
  headers: json(secretaryCookie),
});
if (!allYears.body.data.some((item) => item.id === archiveYear.body.id)) {
  throw new Error("Archived academic year did not appear in all list");
}
const setArchivedCurrent = await request(
  `/academic-years/${archiveYear.body.id}/set-current`,
  {
    method: "PATCH",
    headers: json(adminCookie),
  },
);
if (setArchivedCurrent.response.status !== 400) {
  throw new Error("Archived academic year was allowed as current");
}
const reactivated = await request(
  `/academic-years/${archiveYear.body.id}/reactivate`,
  {
    method: "PATCH",
    headers: json(adminCookie),
  },
);
if (!reactivated.response.ok || reactivated.body.status !== "ACTIVE") {
  throw new Error(`Academic year reactivate failed: ${reactivated.body.message}`);
}
const deleteYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (!deleteYear.response.ok) {
  throw new Error(`Delete academic year create failed: ${deleteYear.body.message}`);
}
const deletedYear = await request(`/academic-years/${deleteYear.body.id}`, {
  method: "DELETE",
  headers: json(adminCookie),
});
if (!deletedYear.response.ok || deletedYear.body.deleted !== true) {
  throw new Error(`Empty academic year delete failed: ${deletedYear.body.message}`);
}
const archiveCurrent = await request(`/academic-years/${academicYear.body.id}/archive`, {
  method: "PATCH",
  headers: json(adminCookie),
});
if (archiveCurrent.response.status !== 400) {
  throw new Error("Current academic year archive was not blocked");
}
const deleteCurrent = await request(`/academic-years/${academicYear.body.id}`, {
  method: "DELETE",
  headers: json(adminCookie),
});
if (deleteCurrent.response.status !== 400) {
  throw new Error("Current academic year delete was not blocked");
}
const secretaryArchive = await request(`/academic-years/${archiveYear.body.id}/archive`, {
  method: "PATCH",
  headers: json(secretaryCookie),
});
if (secretaryArchive.response.status !== 403) {
  throw new Error("Secretaria was not blocked from archiving academic year");
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
const initialBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Inicial`,
  capacity: 2,
});
const fullBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Lotado`,
  capacity: 1,
});
const concurrentBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Concorrente`,
  capacity: 1,
});
const inactiveBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Inativo`,
  capacity: 1,
});
await request(`/institutions/${inactiveInstitution.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});
await request(`/shifts/${inactiveShift.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});
await request(`/buses/${inactiveBus.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});

const blockedArchivedYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (!blockedArchivedYear.response.ok) {
  throw new Error(
    `Blocked archived year create failed: ${blockedArchivedYear.body.message}`,
  );
}
await request(`/academic-years/${blockedArchivedYear.body.id}/archive`, {
  method: "PATCH",
  headers: json(adminCookie),
});
const archivedYearStudent = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: generateCpf(300000000 + ((runSeed + 80) % 600000000)),
      academicYearId: blockedArchivedYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-archived-year`,
    }),
  ),
});
if (archivedYearStudent.response.status !== 400) {
  throw new Error("Archived academic year was allowed in student create");
}

const rollbackAcademicYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: rollbackYear }),
});
if (!rollbackAcademicYear.response.ok) {
  throw new Error(
    `Rollback academic year create failed: ${rollbackAcademicYear.body.message}`,
  );
}
await prisma.cardSequence.create({
  data: {
    academicYearId: rollbackAcademicYear.body.id,
    cardType: "STUDENT",
    lastSequenceNumber: 2147483647,
  },
});
const cardSequenceYearEdit = await request(
  `/academic-years/${rollbackAcademicYear.body.id}`,
  {
    method: "PATCH",
    headers: json(adminCookie),
    body: JSON.stringify({ year: takeYear() }),
  },
);
if (cardSequenceYearEdit.response.status !== 409) {
  throw new Error("Academic year edit with CardSequence dependency was not blocked");
}
const cardSequenceYearDelete = await request(
  `/academic-years/${rollbackAcademicYear.body.id}`,
  {
    method: "DELETE",
    headers: json(adminCookie),
  },
);
if (cardSequenceYearDelete.response.status !== 409) {
  throw new Error("Academic year delete with CardSequence dependency was not blocked");
}
const rollbackCpf = generateCpf(300000000 + ((runSeed + 30) % 600000000));
const rollbackCreate = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: rollbackCpf,
      academicYearId: rollbackAcademicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-rb`,
    }),
  ),
});
if (rollbackCreate.response.ok) {
  throw new Error("Student create succeeded after forced card sequence failure");
}
const rollbackPersonCount = await prisma.person.count({
  where: { cpf: rollbackCpf },
});
if (rollbackPersonCount !== 0) {
  throw new Error("Student create left partial data after card generation failure");
}

const cpf = generateCpf(Date.now() % 900000000);
const createStudent = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: runId,
    }),
  ),
});
if (!createStudent.response.ok) {
  throw new Error(`Student create failed: ${createStudent.body.message}`);
}

const createdCards = await request(`/students/${createStudent.body.id}/cards`, {
  headers: json(secretaryCookie),
});
if (
  !createdCards.response.ok ||
  createdCards.body.data.length !== 1 ||
  createdCards.body.data[0].cardType !== "STUDENT" ||
  createdCards.body.data[0].status !== "ACTIVE" ||
  createdCards.body.data[0].cardNumber !==
    `${createdCards.body.data[0].sequenceNumber}${academicYear.body.year}`
) {
  throw new Error("Automatic student card was not issued on student create");
}
const createdCardNumber = createdCards.body.data[0].cardNumber;

const dependentYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (!dependentYear.response.ok) {
  throw new Error(`Dependent year create failed: ${dependentYear.body.message}`);
}
const dependentStudent = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: generateCpf(300000000 + ((runSeed + 81) % 600000000)),
      academicYearId: dependentYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-dep-year`,
    }),
  ),
});
if (!dependentStudent.response.ok) {
  throw new Error(`Dependent student create failed: ${dependentStudent.body.message}`);
}
const dependentYearEdit = await request(`/academic-years/${dependentYear.body.id}`, {
  method: "PATCH",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (dependentYearEdit.response.status !== 409) {
  throw new Error("Academic year edit with Enrollment/StudentCard was not blocked");
}
const dependentYearDelete = await request(`/academic-years/${dependentYear.body.id}`, {
  method: "DELETE",
  headers: json(adminCookie),
});
if (dependentYearDelete.response.status !== 409) {
  throw new Error("Academic year delete with Enrollment/StudentCard was not blocked");
}

const preRegistrationDepYear = await request("/academic-years", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ year: takeYear() }),
});
if (!preRegistrationDepYear.response.ok) {
  throw new Error(
    `Pre-registration dependency year create failed: ${preRegistrationDepYear.body.message}`,
  );
}
await prisma.publicPreRegistration.create({
  data: {
    publicCode: `DEP${runId}`.replace(/\W/g, "").slice(0, 32),
    fullName: `Pre Cadastro ${runId}`,
    normalizedName: `pre cadastro ${runId}`,
    cpf: generateCpf(300000000 + ((runSeed + 82) % 600000000)),
    birthDate: new Date("2001-05-12T00:00:00.000Z"),
    addressStreet: "Rua Pre",
    addressNumber: "123",
    addressNeighborhood: "Centro",
    addressCity: "Terra Rica",
    academicYearId: preRegistrationDepYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    course: "Tecnico em Administracao",
    grade: "1o",
  },
});
const preRegistrationYearEdit = await request(
  `/academic-years/${preRegistrationDepYear.body.id}`,
  {
    method: "PATCH",
    headers: json(adminCookie),
    body: JSON.stringify({ year: takeYear() }),
  },
);
if (preRegistrationYearEdit.response.status !== 409) {
  throw new Error("Academic year edit with PublicPreRegistration was not blocked");
}

const busCpf = generateCpf(300000000 + ((runSeed + 31) % 600000000));
const createWithBus = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    ...studentPayload({
      cpf: busCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-bus`,
    }),
    busId: initialBus.id,
  }),
});
if (!createWithBus.response.ok) {
  throw new Error(`Student create with bus failed: ${createWithBus.body.message}`);
}
const initialAssignment = await prisma.busAssignment.findFirst({
  where: {
    enrollmentId: createWithBus.body.enrollments[0].id,
    busId: initialBus.id,
    status: "ACTIVE",
  },
});
if (!initialAssignment) {
  throw new Error("Student create with bus did not create active BusAssignment");
}
const initialBusStatus = await busOccupancy(
  secretaryCookie,
  initialBus.id,
  academicYear.body.id,
);
if (
  !initialBusStatus ||
  initialBusStatus.occupiedSeats !== 1 ||
  initialBusStatus.availableSeats !== 1
) {
  throw new Error("Bus occupancy was not updated after student create");
}

const fullBusOccupant = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    ...studentPayload({
      cpf: generateCpf(300000000 + ((runSeed + 32) % 600000000)),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-full-a`,
    }),
    busId: fullBus.id,
  }),
});
if (!fullBusOccupant.response.ok) {
  throw new Error(`Full bus occupant create failed: ${fullBusOccupant.body.message}`);
}
const fullBusRejectedCpf = generateCpf(300000000 + ((runSeed + 33) % 600000000));
const fullBusRejected = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    ...studentPayload({
      cpf: fullBusRejectedCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-full-b`,
    }),
    busId: fullBus.id,
  }),
});
if (fullBusRejected.response.status !== 409) {
  throw new Error("Full bus student create was not blocked");
}
const fullBusRejectedRecords = await prisma.person.count({
  where: { cpf: fullBusRejectedCpf },
});
if (fullBusRejectedRecords !== 0) {
  throw new Error("Full bus failure left partial student data");
}

const inactiveBusCpf = generateCpf(300000000 + ((runSeed + 34) % 600000000));
const inactiveBusStudent = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    ...studentPayload({
      cpf: inactiveBusCpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-inactive-bus`,
    }),
    busId: inactiveBus.id,
  }),
});
if (inactiveBusStudent.response.status !== 400) {
  throw new Error("Inactive bus student create was not blocked");
}
const inactiveBusRecords = await prisma.person.count({
  where: { cpf: inactiveBusCpf },
});
if (inactiveBusRecords !== 0) {
  throw new Error("Inactive bus failure left partial student data");
}

const [busConcurrentA, busConcurrentB] = await Promise.all([
  request("/students", {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({
      ...studentPayload({
        cpf: generateCpf(300000000 + ((runSeed + 35) % 600000000)),
        academicYearId: academicYear.body.id,
        institutionId: institution.id,
        shiftId: shift.id,
        suffix: `${runId}-bca`,
      }),
      busId: concurrentBus.id,
    }),
  }),
  request("/students", {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({
      ...studentPayload({
        cpf: generateCpf(300000000 + ((runSeed + 36) % 600000000)),
        academicYearId: academicYear.body.id,
        institutionId: institution.id,
        shiftId: shift.id,
        suffix: `${runId}-bcb`,
      }),
      busId: concurrentBus.id,
    }),
  }),
]);
const concurrentStatuses = [
  busConcurrentA.response.status,
  busConcurrentB.response.status,
].sort();
if (concurrentStatuses[0] !== 201 || concurrentStatuses[1] !== 409) {
  throw new Error(
    `Concurrent bus last-seat create was not serialized: ${concurrentStatuses.join(",")}`,
  );
}
const concurrentAssignments = await prisma.busAssignment.count({
  where: { busId: concurrentBus.id, status: "ACTIVE" },
});
if (concurrentAssignments !== 1) {
  throw new Error("Concurrent bus assignment created overbooking");
}

const list = await request(`/students?search=${cpf}`, {
  headers: json(secretaryCookie),
});
if (
  !list.response.ok ||
  list.body.data.length < 1 ||
  list.body.data[0].person.cpfMasked.includes(cpf) ||
  list.body.data[0].currentStudentCard?.cardNumber !== createdCardNumber
) {
  throw new Error("Student list, card number, or masked CPF failed");
}

const cardSearch = await request(`/students?search=${createdCardNumber}`, {
  headers: json(secretaryCookie),
});
if (
  !cardSearch.response.ok ||
  !cardSearch.body.data.some((student) => student.id === createStudent.body.id)
) {
  throw new Error("Student search by card number failed");
}

const detail = await request(`/students/${createStudent.body.id}`, {
  headers: json(secretaryCookie),
});
if (!detail.response.ok || detail.body.person.cpf !== cpf) {
  throw new Error("Student detail failed");
}

const updatePerson = await request(`/students/${createStudent.body.id}/person`, {
  method: "PATCH",
  headers: json(secretaryCookie),
  body: JSON.stringify({
    ...studentPayload({
      cpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-edit`,
    }).person,
    fullName: `Academico Editado ${runId}`,
  }),
});
if (!updatePerson.response.ok) {
  throw new Error(`Student person update failed: ${updatePerson.body.message}`);
}

const updateGuardian = await request(
  `/students/${createStudent.body.id}/guardian`,
  {
    method: "PATCH",
    headers: json(secretaryCookie),
    body: JSON.stringify({
      guardian: { fullName: `Responsavel Editado ${runId}` },
    }),
  },
);
if (!updateGuardian.response.ok) {
  throw new Error("Student guardian update failed");
}

const enrollmentId = createStudent.body.enrollments[0].id;
const updateEnrollment = await request(
  `/students/${createStudent.body.id}/enrollments/${enrollmentId}`,
  {
    method: "PATCH",
    headers: json(secretaryCookie),
    body: JSON.stringify({ course: "Enfermagem", grade: "2o" }),
  },
);
if (!updateEnrollment.response.ok) {
  throw new Error("Enrollment update failed");
}

const invalidCpf = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: "11111111111",
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-invalid-cpf`,
    }),
  ),
});
if (invalidCpf.response.status !== 400) {
  throw new Error("Invalid CPF validation failed");
}

const duplicateCpf = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf,
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-duplicate`,
    }),
  ),
});
if (duplicateCpf.response.status !== 409) {
  throw new Error("Duplicate CPF validation failed");
}

const [concurrentA, concurrentB] = await Promise.all([
  request("/students", {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify(
      studentPayload({
        cpf: generateCpf(300000000 + ((runSeed + 20) % 600000000)),
        academicYearId: academicYear.body.id,
        institutionId: institution.id,
        shiftId: shift.id,
        suffix: `${runId}-ca`,
      }),
    ),
  }),
  request("/students", {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify(
      studentPayload({
        cpf: generateCpf(300000000 + ((runSeed + 21) % 600000000)),
        academicYearId: academicYear.body.id,
        institutionId: institution.id,
        shiftId: shift.id,
        suffix: `${runId}-cb`,
      }),
    ),
  }),
]);
if (!concurrentA.response.ok || !concurrentB.response.ok) {
  throw new Error(
    `Concurrent student create failed: ${concurrentA.response.status} ${JSON.stringify(concurrentA.body)} / ${concurrentB.response.status} ${JSON.stringify(concurrentB.body)}`,
  );
}
const concurrentCards = await prisma.studentCard.findMany({
  where: {
    studentId: { in: [concurrentA.body.id, concurrentB.body.id] },
    status: "ACTIVE",
  },
  orderBy: { sequenceNumber: "asc" },
});
if (
  concurrentCards.length !== 2 ||
  new Set(concurrentCards.map((card) => card.cardNumber)).size !== 2 ||
  new Set(concurrentCards.map((card) => card.sequenceNumber)).size !== 2
) {
  throw new Error("Concurrent automatic card generation created duplicates");
}

const legacyPerson = await prisma.person.create({
  data: {
    fullName: `Academico Legado ${runId}`,
    normalizedName: `academico legado ${runId}`.toLowerCase(),
    cpf: generateCpf(300000000 + ((runSeed + 22) % 600000000)),
    birthDate: new Date("2001-05-12T00:00:00.000Z"),
    addressStreet: "Rua Legado",
    addressNumber: "123",
    addressNeighborhood: "Centro",
    addressCity: "Terra Rica",
  },
});
const legacyStudent = await prisma.student.create({
  data: {
    personId: legacyPerson.id,
    enrollments: {
      create: {
        academicYearId: academicYear.body.id,
        institutionId: institution.id,
        shiftId: shift.id,
        course: "Tecnico em Administracao",
        grade: "1o",
      },
    },
  },
});
const orderedList = await request(
  `/students?academicYearId=${academicYear.body.id}&status=all&limit=100`,
  { headers: json(secretaryCookie) },
);
if (
  !orderedList.response.ok ||
  !orderedList.body.data.some((student) => student.id === legacyStudent.id)
) {
  throw new Error("Legacy student without card was not listed");
}
const cardedRows = orderedList.body.data.filter((student) => student.currentStudentCard);
const cardSequences = cardedRows.map(
  (student) => student.currentStudentCard.sequenceNumber,
);
if (
  cardSequences.some((sequence, index) => index > 0 && sequence < cardSequences[index - 1])
) {
  throw new Error("Student list was not ordered by card sequence before pagination");
}

const futureBirth = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: generateCpf((Date.now() + 1) % 900000000),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: `${runId}-future`,
      birthDate: "2999-01-01",
    }),
  ),
});
if (futureBirth.response.status !== 400) {
  throw new Error("Future birth date validation failed");
}

const missingAddress = studentPayload({
  cpf: generateCpf((Date.now() + 2) % 900000000),
  academicYearId: academicYear.body.id,
  institutionId: institution.id,
  shiftId: shift.id,
  suffix: `${runId}-missing-address`,
});
delete missingAddress.person.addressStreet;
const missingAddressResponse = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(missingAddress),
});
if (missingAddressResponse.response.status !== 400) {
  throw new Error("Address validation failed");
}

const duplicateEnrollment = await request(
  `/students/${createStudent.body.id}/enrollments`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      course: "Outro Curso",
      grade: "3o",
    }),
  },
);
if (duplicateEnrollment.response.status !== 409) {
  throw new Error("Duplicate enrollment validation failed");
}

const inactiveInstitutionStudent = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: generateCpf((Date.now() + 3) % 900000000),
      academicYearId: academicYear.body.id,
      institutionId: inactiveInstitution.id,
      shiftId: shift.id,
      suffix: `${runId}-inactive-inst`,
    }),
  ),
});
if (inactiveInstitutionStudent.response.status !== 400) {
  throw new Error("Inactive institution validation failed");
}

const inactiveShiftStudent = await request("/students", {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify(
    studentPayload({
      cpf: generateCpf((Date.now() + 4) % 900000000),
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: inactiveShift.id,
      suffix: `${runId}-inactive-shift`,
    }),
  ),
});
if (inactiveShiftStudent.response.status !== 400) {
  throw new Error("Inactive shift validation failed");
}

await request(`/institutions/${institution.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});
await request(`/shifts/${shift.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});
const historicalDetail = await request(`/students/${createStudent.body.id}`, {
  headers: json(secretaryCookie),
});
if (
  !historicalDetail.response.ok ||
  historicalDetail.body.enrollments[0].institution.name !== institution.name ||
  historicalDetail.body.enrollments[0].shift.name !== shift.name
) {
  throw new Error("Historical institution/shift visibility failed");
}

const audits = await prisma.administrativeAuditLog.count({
  where: {
    userId: { not: null },
    eventType: { in: ["STUDENT_CREATED", "ENROLLMENT_CREATED"] },
  },
});
if (audits < 2) {
  throw new Error("Administrative audit validation failed");
}

await prisma.$disconnect();
console.log("Sprint 3 students smoke OK");
