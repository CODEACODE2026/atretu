import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const outDir = "/tmp/atretu-sprint11-6-transport-regulation";
const legacyPdfPath =
  "/root/.openclaw/media/inbound/Regime_transporte---5a8c92db-68ef-4676-bb4f-8d6344214ccd.pdf";
const storageDir =
  process.env.PRIVATE_STORAGE_PATH ??
  process.env.DOCUMENT_STORAGE_DIR ??
  path.join(outDir, "storage");
const runId = `qa-s116-${Date.now()}`;
const password = "SenhaForte9!";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

await rm(outDir, { force: true, recursive: true });
await mkdir(outDir, { recursive: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const ids = {
  academicYears: [],
  boardMemberships: [],
  enrollments: [],
  guardians: [],
  institutions: [],
  people: [],
  shifts: [],
  students: [],
  users: [],
};
const emails = [];

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return result.stdout;
}

function formatDateOnlyInSaoPaulo(value) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  })
    .formatToParts(value)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatLongDateInSaoPaulo(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(value);
}

function buildCpf(seed) {
  const base = String(seed).padStart(9, "0").slice(0, 9);
  const digit = (value) => {
    const numbers = value.split("").map(Number);
    const start = numbers.length + 1;
    const sum = numbers.reduce(
      (total, number, index) => total + number * (start - index),
      0,
    );
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  const first = digit(base);
  return `${base}${first}${digit(`${base}${first}`)}`;
}

async function ensureRole(code) {
  return prisma.role.upsert({
    where: { code },
    create: { code, description: code },
    update: {},
  });
}

async function createUser(roleCode, name, institutionIds = []) {
  const role = await ensureRole(roleCode);
  const id = randomUUID();
  const email = `${runId}.${roleCode.toLowerCase()}.${ids.users.length}@qa.local`;
  ids.users.push(id);
  emails.push(email);
  await prisma.user.create({
    data: {
      id,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 8),
      mustChangePassword: false,
      institutions: {
        create: institutionIds.map((institutionId) => ({ institutionId })),
      },
      roles: { create: { roleId: role.id } },
    },
  });
  return { email, id, name };
}

async function createReferences(label) {
  const academicYearId = randomUUID();
  const institutionId = randomUUID();
  const shiftId = randomUUID();
  ids.academicYears.push(academicYearId);
  ids.institutions.push(institutionId);
  ids.shifts.push(shiftId);
  await prisma.academicYear.create({
    data: {
      id: academicYearId,
      isCurrent: false,
      status: "ACTIVE",
      year: 3200 + ids.academicYears.length,
    },
  });
  await prisma.institution.create({
    data: {
      id: institutionId,
      name: `${label} ${runId}`,
      normalizedName: `${label.toLowerCase()}-${runId}`,
      status: "ACTIVE",
    },
  });
  await prisma.shift.create({
    data: {
      id: shiftId,
      name: `NOTURNO ${runId} ${ids.shifts.length}`,
      normalizedName: `noturno-${runId}-${ids.shifts.length}`,
      status: "ACTIVE",
    },
  });
  return { academicYearId, institutionId, shiftId };
}

async function createStudent(name, refs, guardian) {
  const personId = randomUUID();
  const studentId = randomUUID();
  const enrollmentId = randomUUID();
  ids.people.push(personId);
  ids.students.push(studentId);
  ids.enrollments.push(enrollmentId);
  await prisma.person.create({
    data: {
      id: personId,
      fullName: name,
      normalizedName: name.toLowerCase(),
      cpf: buildCpf(Math.floor(Math.random() * 800_000_000) + 100_000_000),
      rg: `RG-${runId}`,
      birthDate: new Date("2007-04-11T00:00:00.000Z"),
      phone: "(44) 98815-8815",
      email: `${name.replace(/\s+/g, ".").toLowerCase()}@qa.local`,
      addressStreet: "RUA NILZA DE OLIVEIRA PEPINO",
      addressNumber: "1556",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
      addressState: "PR",
      addressZipCode: "87890000",
    },
  });
  await prisma.student.create({
    data: {
      id: studentId,
      joinedAt: new Date("2026-08-06T00:00:00.000Z"),
      personId,
      status: "ACTIVE",
      guardian: guardian
        ? {
            create: {
              cpf: guardian.cpf,
              fullName: guardian.fullName,
              rg: guardian.rg,
            },
          }
        : undefined,
    },
  });
  if (guardian) {
    const createdGuardian = await prisma.studentGuardian.findUnique({
      where: { studentId },
      select: { id: true },
    });
    if (createdGuardian) ids.guardians.push(createdGuardian.id);
  }
  await prisma.enrollment.create({
    data: {
      id: enrollmentId,
      academicYearId: refs.academicYearId,
      course: "DIREITO",
      grade: "1",
      institutionId: refs.institutionId,
      shiftId: refs.shiftId,
      status: "ACTIVE",
      studentId,
    },
  });
  return { personId, studentId };
}

async function createPresident(refs, label = "Presidente Transporte") {
  const president = await createStudent(`${label} ${runId}`, refs, null);
  const membershipId = randomUUID();
  ids.boardMemberships.push(membershipId);
  await prisma.boardMembership.create({
    data: {
      id: membershipId,
      role: "PRESIDENT",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      studentId: president.studentId,
    },
  });
  return { ...president, membershipId };
}

async function replacePresident(refs, previousMembershipId, endedByUserId) {
  await prisma.boardMembership.update({
    data: { endedAt: new Date(), endedByUserId, status: "ENDED" },
    where: { id: previousMembershipId },
  });
  return createPresident(refs, "Presidente Novo Transporte");
}

async function api(pathname, options = {}) {
  const response = await fetch(`${apiUrl}${pathname}`, options);
  const text = await response.text();
  return {
    body: text ? JSON.parse(text) : {},
    cookie: response.headers.get("set-cookie"),
    response,
  };
}

function json(cookie) {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { cookie } : {}),
  };
}

async function cleanup() {
  const issues = await prisma.officialDocumentIssue.findMany({
    where: { studentId: { in: ids.students } },
    select: { id: true, storageKey: true },
  });
  const issueIds = issues.map((issue) => issue.id);
  await prisma.administrativeAuditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: ids.users } },
        { recordId: { in: [...issueIds, ...ids.students, ...ids.enrollments] } },
      ],
    },
  });
  await prisma.securityAuditLog.deleteMany({
    where: { OR: [{ userId: { in: ids.users } }, { email: { in: emails } }] },
  });
  await prisma.officialDocumentIssue.deleteMany({ where: { id: { in: issueIds } } });
  await prisma.boardMembership.deleteMany({ where: { id: { in: ids.boardMemberships } } });
  await prisma.studentGuardian.deleteMany({ where: { id: { in: ids.guardians } } });
  await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollments } } });
  await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
  await prisma.person.deleteMany({ where: { id: { in: ids.people } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.shift.deleteMany({ where: { id: { in: ids.shifts } } });
  await prisma.institution.deleteMany({ where: { id: { in: ids.institutions } } });
  await prisma.academicYear.deleteMany({ where: { id: { in: ids.academicYears } } });
  for (const issue of issues) {
    await rm(path.join(storageDir, issue.storageKey), { force: true });
  }
}

try {
  await cleanup();
  const refs = await createReferences("UNIFATECIE BR");
  const externalRefs = await createReferences("UNIPAR EXTERNA");
  const superAdmin = await createUser("SUPER_ADMIN", "QA Transporte Super");
  const secretaria = await createUser("SECRETARIA", "QA Transporte Secretaria", [
    refs.institutionId,
  ]);
  const secretariaSemVinculo = await createUser(
    "SECRETARIA",
    "QA Transporte Secretaria Sem Vinculo",
    [],
  );
  const gestor = await createUser("GESTOR", "QA Transporte Gestor");
  const firstPresident = await createPresident(refs);
  const noGuardian = await createStudent(`Associado Transporte Sem Responsavel ${runId}`, refs, null);
  const withGuardian = await createStudent(
    `Associado Transporte Com Responsavel ${runId}`,
    refs,
    {
      cpf: buildCpf(987654321),
      fullName: `Responsavel Transporte ${runId}`,
      rg: "RG-RESP-QA",
    },
  );
  const externalStudent = await createStudent(
    `Associado Transporte Externo ${runId}`,
    externalRefs,
    null,
  );

  const login = await api("/auth/login", {
    body: JSON.stringify({ email: superAdmin.email, password }),
    headers: json(),
    method: "POST",
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  const cookie = login.cookie;
  const secretariaLogin = await api("/auth/login", {
    body: JSON.stringify({ email: secretaria.email, password }),
    headers: json(),
    method: "POST",
  });
  assert.equal(secretariaLogin.response.status, 200, JSON.stringify(secretariaLogin.body));
  const secretariaCookie = secretariaLogin.cookie;
  const secretariaSemVinculoLogin = await api("/auth/login", {
    body: JSON.stringify({ email: secretariaSemVinculo.email, password }),
    headers: json(),
    method: "POST",
  });
  assert.equal(
    secretariaSemVinculoLogin.response.status,
    200,
    JSON.stringify(secretariaSemVinculoLogin.body),
  );
  const secretariaSemVinculoCookie = secretariaSemVinculoLogin.cookie;
  const gestorLogin = await api("/auth/login", {
    body: JSON.stringify({ email: gestor.email, password }),
    headers: json(),
    method: "POST",
  });
  assert.equal(gestorLogin.response.status, 200, JSON.stringify(gestorLogin.body));
  const gestorCookie = gestorLogin.cookie;

  const noSession = await api(`/students/${noGuardian.studentId}/official-documents`);
  assert.equal(noSession.response.status, 401, JSON.stringify(noSession.body));
  const gestorList = await api(`/students/${noGuardian.studentId}/official-documents`, {
    headers: json(gestorCookie),
  });
  assert.equal(gestorList.response.status, 403, JSON.stringify(gestorList.body));
  const secretariaSemVinculoList = await api(
    `/students/${noGuardian.studentId}/official-documents`,
    { headers: json(secretariaSemVinculoCookie) },
  );
  assert.equal(
    secretariaSemVinculoList.response.status,
    404,
    JSON.stringify(secretariaSemVinculoList.body),
  );
  const externalStudentList = await api(
    `/students/${externalStudent.studentId}/official-documents`,
    { headers: json(secretariaCookie) },
  );
  assert.equal(externalStudentList.response.status, 404, JSON.stringify(externalStudentList.body));

  const catalog = await api(`/students/${noGuardian.studentId}/official-documents`, {
    headers: json(cookie),
  });
  assert.equal(catalog.response.status, 200, JSON.stringify(catalog.body));
  assert.ok(
    catalog.body.data.some((item) => item.type === "TRANSPORT_REGULATION"),
    "catalog must include transport regulation as student document",
  );
  assert.ok(
    !catalog.body.data.some(
      (item) => item.type === "TRANSPORT_REGULATION" && item.scope === "INSTITUTIONAL",
    ),
    "transport regulation must not be exposed as institutional document",
  );

  const issuedNoGuardian = await api(
    `/students/${noGuardian.studentId}/official-documents/TRANSPORT_REGULATION/issue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(issuedNoGuardian.response.status, 201, JSON.stringify(issuedNoGuardian.body));
  assert.equal(issuedNoGuardian.body.templateKey, "transport-regulation");
  assert.equal(issuedNoGuardian.body.templateVersion, 1);
  assert.equal(issuedNoGuardian.body.approvalDate, null);
  assert.equal(issuedNoGuardian.body.signerDetails.length, 2);
  assert.equal(issuedNoGuardian.body.signerDetails[0]?.signerRole, "PRESIDENT");
  assert.equal(issuedNoGuardian.body.signerDetails[1]?.signerRole, "ACADEMICO");

  const issuedWithGuardian = await api(
    `/students/${withGuardian.studentId}/official-documents/TRANSPORT_REGULATION/issue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(issuedWithGuardian.response.status, 201, JSON.stringify(issuedWithGuardian.body));
  assert.equal(issuedWithGuardian.body.signerDetails.length, 3);
  assert.equal(issuedWithGuardian.body.signerDetails[2]?.signerRole, "RESPONSAVEL");
  const originalIssueDate = formatDateOnlyInSaoPaulo(
    new Date(issuedWithGuardian.body.issuedAt),
  );
  const originalIssuePlaceDateText = `Terra Rica, ${formatLongDateInSaoPaulo(
    new Date(issuedWithGuardian.body.issuedAt),
  )}`;
  const originalIssueRow = await prisma.officialDocumentIssue.findUniqueOrThrow({
    where: { id: issuedWithGuardian.body.id },
  });
  const originalSnapshot = originalIssueRow.contentSnapshot;
  assert.equal(originalSnapshot.transportRegulation.issueDate, originalIssueDate);
  assert.equal(
    originalSnapshot.transportRegulation.issuePlaceDateText,
    originalIssuePlaceDateText,
  );

  const secretariaIssue = await api(
    `/students/${noGuardian.studentId}/official-documents/TRANSPORT_REGULATION/issue`,
    { headers: json(secretariaCookie), method: "POST" },
  );
  assert.equal(secretariaIssue.response.status, 201, JSON.stringify(secretariaIssue.body));

  const forbiddenIssue = await api(
    `/students/${noGuardian.studentId}/official-documents/TRANSPORT_REGULATION/issue`,
    { headers: json(gestorCookie), method: "POST" },
  );
  assert.equal(forbiddenIssue.response.status, 403, JSON.stringify(forbiddenIssue.body));

  const inline = await fetch(
    `${apiUrl}/students/${withGuardian.studentId}/official-documents/${issuedWithGuardian.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(inline.status, 200);
  const pdfPath = path.join(outDir, "regimento-transporte-com-responsavel.pdf");
  await writeFile(pdfPath, Buffer.from(await inline.arrayBuffer()));

  const info = run("pdfinfo", [pdfPath]);
  assert.match(info, /^Page size:\s+595\.28 x 841\.89 pts \(A4\)$/m);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  assert.equal(pages, 3, "transport regulation should match legacy page count");

  const legacyInfo = run("pdfinfo", [legacyPdfPath]);
  assert.match(legacyInfo, /^Pages:\s+3$/m);

  const text = run("pdftotext", [pdfPath, "-"]);
  for (const fragment of [
    "DIRETRIZES PARA TRANSPORTE DE ALUNOS",
    "Artigos 42º",
    "R$ 150,00",
    "AEUA",
    "Unifatecie, Unespar",
    "Unipar, Unopar, IFPR",
    "artigos 9º e 10º",
    originalIssuePlaceDateText,
    "TERMO DE CIENCIA DO REGIMENTO DO TRANSPORTE",
    "Nome do Associado:",
    "QUANDO INTERESSADO FOR MENOR DE IDADE",
    "Nome do Representante legal do associado",
    "QR preparado",
    issuedWithGuardian.body.protocol,
  ]) {
    assert.ok(text.includes(fragment), `PDF text must include ${fragment}`);
  }
  assert.ok(
    !text.includes("Terra Rica, 16 de dezembro de 2023"),
    "PDF must not use the legacy fixed approval date as issue date",
  );
  assert.ok(!text.includes(withGuardian.studentId), "PDF must not expose technical UUIDs");

  const noGuardianPdfResponse = await fetch(
    `${apiUrl}/students/${noGuardian.studentId}/official-documents/${issuedNoGuardian.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(noGuardianPdfResponse.status, 200);
  const noGuardianPdfPath = path.join(outDir, "regimento-transporte-sem-responsavel.pdf");
  await writeFile(
    noGuardianPdfPath,
    Buffer.from(await noGuardianPdfResponse.arrayBuffer()),
  );
  const noGuardianText = run("pdftotext", [noGuardianPdfPath, "-"]);
  assert.ok(
    !noGuardianText.includes("QUANDO INTERESSADO FOR MENOR DE IDADE"),
    "PDF without guardian must not render an empty guardian block",
  );

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const pageText = run("pdftotext", [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      "-",
    ]).trim();
    assert.ok(pageText.length > 80, `page ${pageNumber} must not be empty`);
    run("pdftoppm", [
      "-png",
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      path.join(outDir, `regimento-transporte-pagina-${String(pageNumber).padStart(2, "0")}`),
    ]);
  }
  run("pdftoppm", [
    "-png",
    "-f",
    "1",
    "-l",
    "3",
    legacyPdfPath,
    path.join(outDir, "legado-regimento-transporte-pagina"),
  ]);

  await prisma.person.update({
    data: { fullName: `Associado Transporte Alterado ${runId}` },
    where: { id: withGuardian.personId },
  });
  const newPresident = await replacePresident(refs, firstPresident.membershipId, superAdmin.id);
  const reissued = await api(
    `/students/${withGuardian.studentId}/official-documents/${issuedWithGuardian.body.id}/reissue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(reissued.response.status, 201, JSON.stringify(reissued.body));
  assert.equal(reissued.body.sourceIssueId, issuedWithGuardian.body.id);
  assert.equal(reissued.body.approvalDate, null);
  assert.deepEqual(reissued.body.signerDetails, issuedWithGuardian.body.signerDetails);
  assert.notEqual(reissued.body.signerDetails[0]?.signerStudentId, newPresident.studentId);
  const reissuedRow = await prisma.officialDocumentIssue.findUniqueOrThrow({
    where: { id: reissued.body.id },
  });
  assert.equal(
    reissuedRow.contentSnapshot.transportRegulation.issuePlaceDateText,
    originalIssuePlaceDateText,
  );
  const freshIssue = await api(
    `/students/${noGuardian.studentId}/official-documents/TRANSPORT_REGULATION/issue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(freshIssue.response.status, 201, JSON.stringify(freshIssue.body));
  assert.equal(freshIssue.body.signerDetails[0]?.signerStudentId, newPresident.studentId);
  assert.notEqual(freshIssue.body.signerDetails[0]?.signerStudentId, firstPresident.studentId);

  const externalDownload = await fetch(
    `${apiUrl}/students/${externalStudent.studentId}/official-documents/${issuedWithGuardian.body.id}/file?disposition=inline`,
    { headers: { cookie: secretariaCookie } },
  );
  assert.equal(externalDownload.status, 404);
  const externalReissue = await api(
    `/students/${externalStudent.studentId}/official-documents/${issuedWithGuardian.body.id}/reissue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(externalReissue.response.status, 404, JSON.stringify(externalReissue.body));

  const auditLogs = await prisma.administrativeAuditLog.findMany({
    where: {
      eventType: { in: ["OFFICIAL_DOCUMENT_ISSUED", "OFFICIAL_DOCUMENT_REISSUED"] },
      recordId: {
        in: [
          issuedNoGuardian.body.id,
          issuedWithGuardian.body.id,
          secretariaIssue.body.id,
          reissued.body.id,
        ],
      },
    },
    select: { metadata: true },
  });
  assert.ok(auditLogs.length >= 4, "issue/reissue audit logs must be recorded");
  assert.ok(
    auditLogs.every((log) => {
      const metadata = log.metadata ?? {};
      return (
        metadata.documentType === "TRANSPORT_REGULATION" &&
        metadata.templateKey === "transport-regulation" &&
        metadata.templateVersion === 1 &&
        metadata.emittedByUserId
      );
    }),
    "audit metadata must include safe transport regulation fields",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        legacyPages: 3,
        newPages: pages,
        outDir,
        pdfPath,
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
