import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const outDir = "/tmp/atretu-sprint11-7-transport-refund-request";
const legacyPdfPath =
  "/root/.openclaw/media/inbound/Reembolso---abfa2e28-1617-4d10-be54-0f791253e725.pdf";
const storageDir =
  process.env.PRIVATE_STORAGE_PATH ??
  process.env.DOCUMENT_STORAGE_DIR ??
  path.join(outDir, "storage");
const runId = `qa-s117-${Date.now()}`;
const password = "SenhaForte123";

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

function normalizeToken(value) {
  return value.replace(/[^A-Za-z0-9@.+]/g, "");
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
      year: 3300 + ids.academicYears.length,
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

async function createStudent(name, refs, guardian = null) {
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
      phone: "(44) 97429-7429",
      email: `${name.replace(/\s+/g, ".").toLowerCase()}@qa.local`,
      addressStreet: "SITIO SAO PEDRO",
      addressNumber: "S/N",
      addressNeighborhood: "Zona Rural",
      addressCity: "Terra Rica",
      addressState: "PR",
      addressZipCode: "87890000",
    },
  });
  await prisma.student.create({
    data: {
      id: studentId,
      joinedAt: new Date("2026-08-07T00:00:00.000Z"),
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
      grade: "5",
      institutionId: refs.institutionId,
      shiftId: refs.shiftId,
      status: "ACTIVE",
      studentId,
    },
  });
  return { personId, studentId };
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
  const refs = await createReferences("UNIFATECIE CENTRO");
  const externalRefs = await createReferences("UNIPAR EXTERNA");
  const superAdmin = await createUser("SUPER_ADMIN", "QA Reembolso Super");
  const secretaria = await createUser("SECRETARIA", "QA Reembolso Secretaria", [
    refs.institutionId,
  ]);
  const secretariaSemVinculo = await createUser(
    "SECRETARIA",
    "QA Reembolso Secretaria Sem Vinculo",
    [],
  );
  const gestor = await createUser("GESTOR", "QA Reembolso Gestor");
  const student = await createStudent(`Associado Reembolso ${runId}`, refs);
  const studentWithGuardian = await createStudent(
    `Associado Reembolso Com Responsavel ${runId}`,
    refs,
    {
      cpf: buildCpf(987654321),
      fullName: `Responsavel Reembolso ${runId}`,
      rg: "RG-RESP-QA",
    },
  );
  const externalStudent = await createStudent(
    `Associado Reembolso Externo ${runId}`,
    externalRefs,
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

  const noSession = await api(`/students/${student.studentId}/official-documents`);
  assert.equal(noSession.response.status, 401, JSON.stringify(noSession.body));
  const gestorList = await api(`/students/${student.studentId}/official-documents`, {
    headers: json(gestorCookie),
  });
  assert.equal(gestorList.response.status, 403, JSON.stringify(gestorList.body));
  const secretariaSemVinculoList = await api(
    `/students/${student.studentId}/official-documents`,
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

  const catalog = await api(`/students/${student.studentId}/official-documents`, {
    headers: json(cookie),
  });
  assert.equal(catalog.response.status, 200, JSON.stringify(catalog.body));
  assert.ok(
    catalog.body.data.some((item) => item.type === "TRANSPORT_REFUND_REQUEST"),
    "catalog must include transport refund request as student document",
  );

  const pixPayload = {
    paymentMethod: "PIX",
    pixKey: `pix-${runId}@qa.local`,
    reason: "deslocamento avulso validado pela secretaria academica",
    refundAmountCents: 20000,
  };
  const issuedPix = await api(
    `/students/${student.studentId}/official-documents/TRANSPORT_REFUND_REQUEST/issue`,
    { body: JSON.stringify(pixPayload), headers: json(cookie), method: "POST" },
  );
  assert.equal(issuedPix.response.status, 201, JSON.stringify(issuedPix.body));
  assert.equal(issuedPix.body.templateKey, "transport-refund-request");
  assert.equal(issuedPix.body.templateVersion, 1);
  assert.equal(issuedPix.body.signerDetails.length, 1);
  assert.equal(issuedPix.body.signerDetails[0]?.signerRole, "ACADEMICO");
  assert.equal(issuedPix.body.refundDetails.refundAmountCents, 20000);
  assert.equal(issuedPix.body.refundDetails.paymentMethod, "PIX");
  const issueDate = formatDateOnlyInSaoPaulo(new Date(issuedPix.body.issuedAt));
  const issuePlaceDateText = `Terra Rica, ${formatLongDateInSaoPaulo(
    new Date(issuedPix.body.issuedAt),
  )}`;
  assert.equal(issuedPix.body.refundDetails.issueDate, issueDate);
  assert.equal(issuedPix.body.refundDetails.issuePlaceDateText, issuePlaceDateText);

  const bankPayload = {
    bankAccount: "12345-6",
    bankAccountType: "Conta corrente",
    bankAgency: "0001",
    bankName: "Banco QA",
    paymentMethod: "BANK_ACCOUNT",
    reason: "solicitacao com centavos e motivo diferente do legado",
    refundAmountCents: 34567,
  };
  const issuedBank = await api(
    `/students/${studentWithGuardian.studentId}/official-documents/TRANSPORT_REFUND_REQUEST/issue`,
    { body: JSON.stringify(bankPayload), headers: json(cookie), method: "POST" },
  );
  assert.equal(issuedBank.response.status, 201, JSON.stringify(issuedBank.body));
  assert.equal(issuedBank.body.refundDetails.refundAmountCents, 34567);
  assert.equal(issuedBank.body.refundDetails.paymentMethod, "BANK_ACCOUNT");
  assert.equal(issuedBank.body.signerDetails.length, 1);

  const secretariaIssue = await api(
    `/students/${student.studentId}/official-documents/TRANSPORT_REFUND_REQUEST/issue`,
    { body: JSON.stringify(pixPayload), headers: json(secretariaCookie), method: "POST" },
  );
  assert.equal(secretariaIssue.response.status, 201, JSON.stringify(secretariaIssue.body));
  const forbiddenIssue = await api(
    `/students/${student.studentId}/official-documents/TRANSPORT_REFUND_REQUEST/issue`,
    { body: JSON.stringify(pixPayload), headers: json(gestorCookie), method: "POST" },
  );
  assert.equal(forbiddenIssue.response.status, 403, JSON.stringify(forbiddenIssue.body));

  const inline = await fetch(
    `${apiUrl}/students/${student.studentId}/official-documents/${issuedPix.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(inline.status, 200);
  const pdfPath = path.join(outDir, "solicitacao-reembolso-pix.pdf");
  await writeFile(pdfPath, Buffer.from(await inline.arrayBuffer()));
  const info = run("pdfinfo", [pdfPath]);
  assert.match(info, /^Page size:\s+595\.28 x 841\.89 pts \(A4\)$/m);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  assert.equal(pages, 1, "transport refund request must fit in one page");
  const legacyInfo = run("pdfinfo", [legacyPdfPath]);
  assert.match(legacyInfo, /^Pages:\s+1$/m);
  const text = run("pdftotext", [pdfPath, "-"]);
  const normalizedText = text.replace(/\s+/g, " ");
  for (const fragment of [
    "Solicitação de Reembolso Transporte Universitário",
    "R$ 200,00",
    "duzentos reais",
    pixPayload.reason,
    "Forma de recebimento: PIX",
    pixPayload.pixKey,
    issuePlaceDateText,
    "Informações de Contato",
    "Associado",
    issuedPix.body.protocol,
    "QR preparado",
  ]) {
    assert.ok(normalizedText.includes(fragment), `PDF text must include ${fragment}`);
  }
  assert.ok(!normalizedText.includes("Aleixo Tur"), "PDF must not keep legacy fixed reason");
  assert.ok(!normalizedText.includes("Terra Ria"), "PDF must not keep legacy typo");
  assert.ok(!normalizedText.includes(student.studentId), "PDF must not expose technical UUIDs");
  assert.ok(!normalizedText.includes("Banco:"), "PIX PDF must not show bank fields");
  assert.ok(!normalizedText.includes("Agência:"), "PIX PDF must not show agency fields");
  assert.ok(!normalizedText.includes("Conta:"), "PIX PDF must not show account fields");
  run("pdftoppm", ["-png", "-f", "1", "-l", "1", pdfPath, path.join(outDir, "solicitacao-reembolso-pagina")]);
  run("pdftoppm", ["-png", "-f", "1", "-l", "1", legacyPdfPath, path.join(outDir, "legado-reembolso-pagina")]);

  const pixKeyVariants = [
    { key: "123.456.789-09", name: "cpf" },
    { key: "+5544999999999", name: "telefone" },
    { key: `reembolso.${runId}@qa.local`, name: "email" },
    {
      key: `00000000-1111-2222-3333-${runId}-chave-aleatoria-longa-para-validar-quebra-segura`,
      name: "aleatoria-longa",
    },
  ];
  for (const variant of pixKeyVariants) {
    const variantIssue = await api(
      `/students/${student.studentId}/official-documents/TRANSPORT_REFUND_REQUEST/issue`,
      {
        body: JSON.stringify({ ...pixPayload, pixKey: variant.key }),
        headers: json(cookie),
        method: "POST",
      },
    );
    assert.equal(variantIssue.response.status, 201, JSON.stringify(variantIssue.body));
    const variantPdfResponse = await fetch(
      `${apiUrl}/students/${student.studentId}/official-documents/${variantIssue.body.id}/file?disposition=inline`,
      { headers: { cookie } },
    );
    assert.equal(variantPdfResponse.status, 200);
    const variantPdfPath = path.join(outDir, `solicitacao-reembolso-pix-${variant.name}.pdf`);
    await writeFile(variantPdfPath, Buffer.from(await variantPdfResponse.arrayBuffer()));
    const variantInfo = run("pdfinfo", [variantPdfPath]);
    assert.match(variantInfo, /^Pages:\s+1$/m);
    const variantText = run("pdftotext", [variantPdfPath, "-"]).replace(/\s+/g, " ");
    assert.ok(variantText.includes("Forma de recebimento: PIX"));
    assert.ok(
      normalizeToken(variantText).includes(normalizeToken(variant.key)),
      `PIX PDF must include ${variant.name} key`,
    );
    assert.ok(!variantText.includes("Banco:"), "PIX variant must not show bank fields");
    assert.ok(!variantText.includes("Agência:"), "PIX variant must not show agency fields");
    assert.ok(!variantText.includes("Conta:"), "PIX variant must not show account fields");
  }

  const bankPdfResponse = await fetch(
    `${apiUrl}/students/${studentWithGuardian.studentId}/official-documents/${issuedBank.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(bankPdfResponse.status, 200);
  const bankPdfPath = path.join(outDir, "solicitacao-reembolso-conta-bancaria.pdf");
  await writeFile(bankPdfPath, Buffer.from(await bankPdfResponse.arrayBuffer()));
  const bankInfo = run("pdfinfo", [bankPdfPath]);
  assert.match(bankInfo, /^Pages:\s+1$/m);
  const bankText = run("pdftotext", [bankPdfPath, "-"]);
  const normalizedBankText = bankText.replace(/\s+/g, " ");
  for (const fragment of [
    "R$ 345,67",
    "trezentos e quarenta e cinco reais e sessenta e sete centavos",
    "Forma de recebimento: Conta bancária",
    "Banco: Banco QA",
    "Agência: 0001",
    "Conta: 12345-6",
  ]) {
    assert.ok(normalizedBankText.includes(fragment), `bank PDF text must include ${fragment}`);
  }
  assert.ok(!normalizedBankText.includes("QUANDO INTERESSADO FOR MENOR DE IDADE"));
  assert.ok(!normalizedBankText.includes("Chave PIX:"), "bank PDF must not show PIX field");

  const originalRow = await prisma.officialDocumentIssue.findUniqueOrThrow({
    where: { id: issuedPix.body.id },
  });
  assert.equal(originalRow.contentSnapshot.transportRefund.refundAmountCents, 20000);
  assert.equal(originalRow.contentSnapshot.transportRefund.pixKey, pixPayload.pixKey);
  assert.equal(originalRow.contentSnapshot.transportRefund.issuePlaceDateText, issuePlaceDateText);
  await prisma.person.update({
    data: {
      fullName: `Associado Reembolso Alterado ${runId}`,
      phone: "(44) 90000-0000",
    },
    where: { id: student.personId },
  });
  const reissued = await api(
    `/students/${student.studentId}/official-documents/${issuedPix.body.id}/reissue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(reissued.response.status, 201, JSON.stringify(reissued.body));
  assert.deepEqual(reissued.body.refundDetails, issuedPix.body.refundDetails);
  assert.deepEqual(reissued.body.signerDetails, issuedPix.body.signerDetails);
  const reissuedRow = await prisma.officialDocumentIssue.findUniqueOrThrow({
    where: { id: reissued.body.id },
  });
  assert.equal(reissuedRow.contentSnapshot.student.name, originalRow.contentSnapshot.student.name);
  assert.equal(
    reissuedRow.contentSnapshot.transportRefund.issuePlaceDateText,
    issuePlaceDateText,
  );

  const externalDownload = await fetch(
    `${apiUrl}/students/${externalStudent.studentId}/official-documents/${issuedPix.body.id}/file?disposition=inline`,
    { headers: { cookie: secretariaCookie } },
  );
  assert.equal(externalDownload.status, 404);
  const externalReissue = await api(
    `/students/${externalStudent.studentId}/official-documents/${issuedPix.body.id}/reissue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(externalReissue.response.status, 404, JSON.stringify(externalReissue.body));

  const auditLogs = await prisma.administrativeAuditLog.findMany({
    where: {
      eventType: { in: ["OFFICIAL_DOCUMENT_ISSUED", "OFFICIAL_DOCUMENT_REISSUED"] },
      recordId: {
        in: [issuedPix.body.id, issuedBank.body.id, secretariaIssue.body.id, reissued.body.id],
      },
    },
    select: { metadata: true },
  });
  assert.ok(auditLogs.length >= 4, "issue/reissue audit logs must be recorded");
  assert.ok(
    auditLogs.every((log) => {
      const textMetadata = JSON.stringify(log.metadata ?? {});
      const metadata = log.metadata ?? {};
      return (
        metadata.documentType === "TRANSPORT_REFUND_REQUEST" &&
        metadata.templateKey === "transport-refund-request" &&
        metadata.templateVersion === 1 &&
        metadata.emittedByUserId &&
        !textMetadata.includes(pixPayload.pixKey) &&
        !textMetadata.includes(bankPayload.bankName) &&
        !textMetadata.includes(bankPayload.bankAgency) &&
        !textMetadata.includes(bankPayload.bankAccount)
      );
    }),
    "audit metadata must include only safe refund fields",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        legacyPages: 1,
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
