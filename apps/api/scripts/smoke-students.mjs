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
let smokeYear = 2099;
while (usedYears.has(smokeYear)) {
  smokeYear -= 1;
}

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
if (!yearList.response.ok || yearList.body.data.length < 1) {
  throw new Error("Secretaria academic year list failed");
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

const list = await request(`/students?search=${cpf}`, {
  headers: json(secretaryCookie),
});
if (
  !list.response.ok ||
  list.body.data.length < 1 ||
  list.body.data[0].person.cpfMasked.includes(cpf)
) {
  throw new Error("Student list or masked CPF failed");
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
