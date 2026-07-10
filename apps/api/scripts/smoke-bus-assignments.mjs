import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s4-${Date.now()}`;

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 4 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 4 smoke");
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

async function busOccupancy(cookie, busId, academicYearId) {
  const list = await request(
    `/buses?status=all&academicYearId=${academicYearId}&search=${encodeURIComponent(runId)}`,
    { headers: json(cookie) },
  );
  if (!list.response.ok) {
    throw new Error("Bus list with occupancy failed");
  }
  const bus = list.body.data.find((item) => item.id === busId);
  if (!bus) {
    throw new Error("Bus not found in occupancy list");
  }
  return bus;
}

const anonymous = await request("/enrollments/00000000-0000-0000-0000-000000000000/bus-assignment");
if (anonymous.response.status !== 401) {
  throw new Error("Anonymous bus assignment access was not blocked");
}

const { adminCookie, secretaryCookie } = await ensureUsers();

const usedYears = new Set(
  (await prisma.academicYear.findMany({ select: { year: true } })).map(
    (item) => item.year,
  ),
);
let smokeYear = 2098;
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
const busA = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} A`,
  capacity: 2,
});
const busB = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} B`,
  capacity: 1,
});
const inactiveBus = await createBaseRecord(adminCookie, "/buses", {
  name: `Onibus ${runId} Inativo`,
  capacity: 1,
});
await request(`/buses/${inactiveBus.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});

const baseSeed = Date.now() % 800000000;
const studentOne = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-1`,
  }),
);
const studentTwo = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 1),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-2`,
  }),
);
const studentThree = await createStudent(
  secretaryCookie,
  studentPayload({
    cpf: generateCpf(baseSeed + 2),
    academicYearId: academicYear.body.id,
    institutionId: institution.id,
    shiftId: shift.id,
    suffix: `${runId}-3`,
  }),
);

const enrollmentOne = studentOne.enrollments[0].id;
const enrollmentTwo = studentTwo.enrollments[0].id;
const enrollmentThree = studentThree.enrollments[0].id;

const firstLink = await request(`/enrollments/${enrollmentOne}/bus-assignment`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: busA.id, note: "entrada smoke" }),
});
if (!firstLink.response.ok) {
  throw new Error(`First bus assignment failed: ${firstLink.body.message}`);
}

let busAStatus = await busOccupancy(secretaryCookie, busA.id, academicYear.body.id);
if (busAStatus.occupiedSeats !== 1 || busAStatus.availableSeats !== 1) {
  throw new Error("Initial bus occupancy failed");
}

const duplicateActive = await request(`/enrollments/${enrollmentOne}/bus-assignment`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: busB.id }),
});
if (duplicateActive.response.status !== 409) {
  throw new Error("Duplicate ACTIVE assignment validation failed");
}

const secondLink = await request(`/enrollments/${enrollmentTwo}/bus-assignment`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: busA.id }),
});
if (!secondLink.response.ok) {
  throw new Error(`Second bus assignment failed: ${secondLink.body.message}`);
}

busAStatus = await busOccupancy(secretaryCookie, busA.id, academicYear.body.id);
if (busAStatus.occupiedSeats !== 2 || busAStatus.availableSeats !== 0) {
  throw new Error("Full bus occupancy failed");
}

const overbook = await request(`/enrollments/${enrollmentThree}/bus-assignment`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: busA.id }),
});
if (overbook.response.status !== 409) {
  throw new Error("Full bus validation failed");
}

const invalidCapacity = await request(`/buses/${busA.id}`, {
  method: "PATCH",
  headers: json(adminCookie),
  body: JSON.stringify({ name: busA.name, capacity: 1 }),
});
if (invalidCapacity.response.status !== 409) {
  throw new Error("Capacity below occupancy validation failed");
}

const sameBusSwitch = await request(
  `/enrollments/${enrollmentOne}/bus-assignment/switch`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({ newBusId: busA.id }),
  },
);
if (sameBusSwitch.response.status !== 400) {
  throw new Error("Same bus switch validation failed");
}

const switchBus = await request(
  `/enrollments/${enrollmentOne}/bus-assignment/switch`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({ newBusId: busB.id, note: "troca smoke" }),
  },
);
if (!switchBus.response.ok || switchBus.body.bus.id !== busB.id) {
  throw new Error(`Bus switch failed: ${switchBus.body.message}`);
}

busAStatus = await busOccupancy(secretaryCookie, busA.id, academicYear.body.id);
const busBStatus = await busOccupancy(secretaryCookie, busB.id, academicYear.body.id);
if (
  busAStatus.occupiedSeats !== 1 ||
  busAStatus.availableSeats !== 1 ||
  busBStatus.occupiedSeats !== 1 ||
  busBStatus.availableSeats !== 0
) {
  throw new Error("Switch occupancy failed");
}

const failedSwitch = await request(
  `/enrollments/${enrollmentTwo}/bus-assignment/switch`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({ newBusId: busB.id }),
  },
);
if (failedSwitch.response.status !== 409) {
  throw new Error("Switch to full bus validation failed");
}

const stillActive = await request(`/enrollments/${enrollmentTwo}/bus-assignment`, {
  headers: json(secretaryCookie),
});
if (!stillActive.response.ok || stillActive.body.bus.id !== busA.id) {
  throw new Error("Previous assignment was not preserved after failed switch");
}

const inactiveLink = await request(`/enrollments/${enrollmentThree}/bus-assignment`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ busId: inactiveBus.id }),
});
if (inactiveLink.response.status !== 400) {
  throw new Error("Inactive bus validation failed");
}

const release = await request(`/enrollments/${enrollmentOne}/bus-assignment/release`, {
  method: "POST",
  headers: json(secretaryCookie),
  body: JSON.stringify({ note: "liberacao smoke" }),
});
if (!release.response.ok || release.body.endReason !== "RELEASED") {
  throw new Error("Bus release failed");
}

const releaseAgain = await request(
  `/enrollments/${enrollmentOne}/bus-assignment/release`,
  {
    method: "POST",
    headers: json(secretaryCookie),
    body: JSON.stringify({}),
  },
);
if (releaseAgain.response.status !== 400) {
  throw new Error("Release without active assignment validation failed");
}

const busBAfterRelease = await busOccupancy(
  secretaryCookie,
  busB.id,
  academicYear.body.id,
);
if (busBAfterRelease.occupiedSeats !== 0 || busBAfterRelease.availableSeats !== 1) {
  throw new Error("Release availability failed");
}

await request(`/buses/${busB.id}/inactivate`, {
  method: "PATCH",
  headers: json(adminCookie),
});
const events = await request(`/enrollments/${enrollmentOne}/bus-assignment-events`, {
  headers: json(secretaryCookie),
});
if (
  !events.response.ok ||
  !events.body.data.some((item) => item.eventType === "SWITCHED") ||
  !events.body.data.some((item) => item.eventType === "RELEASED")
) {
  throw new Error("Bus assignment history failed");
}

const linked = await request(
  `/buses/${busA.id}/assignments?academicYearId=${academicYear.body.id}`,
  { headers: json(secretaryCookie) },
);
if (
  !linked.response.ok ||
  linked.body.data.length !== 1 ||
  linked.body.data[0].student.cpfMasked.includes(studentTwo.person.cpf)
) {
  throw new Error("Bus linked students list or CPF masking failed");
}

const capacityAllowed = await request(`/buses/${busA.id}`, {
  method: "PATCH",
  headers: json(adminCookie),
  body: JSON.stringify({ name: busA.name, capacity: 1 }),
});
if (!capacityAllowed.response.ok || capacityAllowed.body.capacity !== 1) {
  throw new Error("Capacity equal to occupancy should be allowed");
}

const audits = await prisma.administrativeAuditLog.count({
  where: {
    eventType: {
      in: [
        "BUS_ASSIGNMENT_LINKED",
        "BUS_ASSIGNMENT_RELEASED",
        "BUS_ASSIGNMENT_SWITCHED",
        "BUS_CAPACITY_UPDATED",
      ],
    },
  },
});
if (audits < 3) {
  throw new Error("Administrative audit validation failed");
}

await prisma.$disconnect();
console.log("Sprint 4 bus assignments smoke OK");
