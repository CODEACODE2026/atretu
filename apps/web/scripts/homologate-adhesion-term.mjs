import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const outDir = "/tmp/atretu-sprint11-5-adhesion-term";
const legacyPdfPath =
  "/root/.openclaw/media/inbound/termo_de_adesao---2554b55c-4b24-4ae2-bd98-fd46e666a2d2.pdf";
const storageDir =
  process.env.PRIVATE_STORAGE_PATH ??
  process.env.DOCUMENT_STORAGE_DIR ??
  path.join(outDir, "storage");
const runId = `qa-s115-${Date.now()}`;
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
let browser;

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
  const email = `${runId}.${roleCode.toLowerCase()}@qa.local`;
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

async function createReferences() {
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
      year: 3000 + Number(runId.slice(-4)),
    },
  });
  await prisma.institution.create({
    data: {
      id: institutionId,
      name: `UNIFATECIE BR ${runId}`,
      normalizedName: `unifatecie-br-${runId}`,
      status: "ACTIVE",
    },
  });
  await prisma.shift.create({
    data: {
      id: shiftId,
      name: `NOTURNO ${runId}`,
      normalizedName: `noturno-${runId}`,
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

async function createPresident(refs) {
  const president = await createStudent(`Presidente Adesao ${runId}`, refs, null);
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
  const president = await createStudent(`Presidente Novo Adesao ${runId}`, refs, null);
  const membershipId = randomUUID();
  ids.boardMemberships.push(membershipId);
  await prisma.boardMembership.create({
    data: {
      id: membershipId,
      role: "PRESIDENT",
      startedAt: new Date(Date.now() - 1000),
      status: "ACTIVE",
      studentId: president.studentId,
    },
  });
  return president;
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

function parseCookie(setCookie) {
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return result.stdout;
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

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth <= document.body.clientWidth + 1,
    document:
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  }));
  assert.deepEqual(overflow, { body: true, document: true }, label);
}

try {
  await cleanup();
  const refs = await createReferences();
  const user = await createUser("SUPER_ADMIN", "QA Adesao Super");
  const secretaria = await createUser("SECRETARIA", "QA Adesao Secretaria", [
    refs.institutionId,
  ]);
  const gestor = await createUser("GESTOR", "QA Adesao Gestor");
  const firstPresident = await createPresident(refs);
  const noGuardian = await createStudent(`Associado Sem Responsavel ${runId}`, refs, null);
  const withGuardian = await createStudent(`Associado Com Responsavel ${runId}`, refs, {
    cpf: buildCpf(987654321),
    fullName: `Responsavel Adesao ${runId}`,
    rg: "RG-RESP-QA",
  });
  const tenInstallmentsStudent = await createStudent(
    `Associado Dez Parcelas ${runId}`,
    refs,
    null,
  );
  const january31Student = await createStudent(
    `Associado Trinta Um ${runId}`,
    refs,
    null,
  );

  const login = await api("/auth/login", {
    body: JSON.stringify({ email: user.email, password }),
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

  const catalog = await api(`/students/${noGuardian.studentId}/official-documents`, {
    headers: json(cookie),
  });
  assert.equal(catalog.response.status, 200, JSON.stringify(catalog.body));
  assert.ok(
    catalog.body.data.some((item) => item.type === "ADHESION_TERM"),
    "catalog must include adhesion term",
  );

  const issueBody = {
    firstInstallmentDate: "2026-08-06",
    installmentAmountCents: 33000,
    installmentCount: 4,
    notes: "QA Sprint 11.5 Termo de Adesao",
  };
  const issuedNoGuardian = await api(
    `/students/${noGuardian.studentId}/official-documents/ADHESION_TERM/issue`,
    { body: JSON.stringify(issueBody), headers: json(cookie), method: "POST" },
  );
  assert.equal(issuedNoGuardian.response.status, 201, JSON.stringify(issuedNoGuardian.body));
  assert.equal(issuedNoGuardian.body.adhesionDetails.installmentAmountCents, 33000);
  assert.equal(issuedNoGuardian.body.adhesionDetails.installmentCount, 4);
  assert.equal(issuedNoGuardian.body.adhesionDetails.installmentDueDay, 6);
  assert.equal(issuedNoGuardian.body.adhesionDetails.totalContractAmountCents, 132000);
  assert.equal(issuedNoGuardian.body.adhesionDetails.installments.length, 4);
  assert.equal(issuedNoGuardian.body.signerDetails.length, 2);
  assert.equal(issuedNoGuardian.body.signerDetails[0]?.signerRole, "PRESIDENT");
  assert.equal(issuedNoGuardian.body.signerDetails[1]?.signerRole, "ACADEMICO");

  const issuedWithGuardian = await api(
    `/students/${withGuardian.studentId}/official-documents/ADHESION_TERM/issue`,
    { body: JSON.stringify(issueBody), headers: json(cookie), method: "POST" },
  );
  assert.equal(issuedWithGuardian.response.status, 201, JSON.stringify(issuedWithGuardian.body));
  assert.equal(issuedWithGuardian.body.signerDetails.length, 3);
  assert.equal(issuedWithGuardian.body.signerDetails[2]?.signerRole, "RESPONSAVEL");

  const tenInstallmentsBody = {
    firstInstallmentDate: "2026-09-15",
    installmentAmountCents: 27550,
    installmentCount: 10,
    notes: "QA Sprint 11.5 dez parcelas com centavos",
  };
  const issuedTenInstallments = await api(
    `/students/${tenInstallmentsStudent.studentId}/official-documents/ADHESION_TERM/issue`,
    {
      body: JSON.stringify(tenInstallmentsBody),
      headers: json(cookie),
      method: "POST",
    },
  );
  assert.equal(
    issuedTenInstallments.response.status,
    201,
    JSON.stringify(issuedTenInstallments.body),
  );
  assert.equal(issuedTenInstallments.body.adhesionDetails.installmentCount, 10);
  assert.equal(
    issuedTenInstallments.body.adhesionDetails.installmentAmountCents,
    27550,
  );
  assert.equal(
    issuedTenInstallments.body.adhesionDetails.totalContractAmountCents,
    275500,
  );
  assert.equal(issuedTenInstallments.body.adhesionDetails.installments.length, 10);

  const january31Body = {
    firstInstallmentDate: "2026-01-31",
    installmentAmountCents: 19999,
    installmentCount: 4,
    notes: "QA Sprint 11.5 vencimento 31 com centavos",
  };
  const issuedJanuary31 = await api(
    `/students/${january31Student.studentId}/official-documents/ADHESION_TERM/issue`,
    {
      body: JSON.stringify(january31Body),
      headers: json(cookie),
      method: "POST",
    },
  );
  assert.equal(issuedJanuary31.response.status, 201, JSON.stringify(issuedJanuary31.body));
  assert.deepEqual(
    issuedJanuary31.body.adhesionDetails.installments.map((installment) =>
      installment.dueDate.slice(0, 10),
    ),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
  );
  assert.equal(issuedJanuary31.body.adhesionDetails.installmentAmountCents, 19999);
  assert.equal(issuedJanuary31.body.adhesionDetails.totalContractAmountCents, 79996);

  const secretariaIssue = await api(
    `/students/${noGuardian.studentId}/official-documents/ADHESION_TERM/issue`,
    { body: JSON.stringify(issueBody), headers: json(secretariaCookie), method: "POST" },
  );
  assert.equal(secretariaIssue.response.status, 201, JSON.stringify(secretariaIssue.body));

  const inline = await fetch(
    `${apiUrl}/students/${withGuardian.studentId}/official-documents/${issuedWithGuardian.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(inline.status, 200);
  const pdf = Buffer.from(await inline.arrayBuffer());
  const pdfPath = path.join(outDir, "termo-adesao-com-responsavel.pdf");
  await writeFile(pdfPath, pdf);

  const info = run("pdfinfo", [pdfPath]);
  assert.match(info, /^Page size:\s+595\.28 x 841\.89 pts \(A4\)$/m);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  assert.ok(pages >= 1 && pages <= 3, "adhesion term should stay compact");
  const text = run("pdftotext", [pdfPath, "-"]);
  for (const fragment of [
    "Termo de Adesão e Filiação",
    "Instrumento Particular de Associação",
    "Cláusula 1ª",
    "Cláusula 6ª",
    "R$ 330,00",
    "R$ 1.320,00",
    "1ª Mensalidade",
    "06/08/2026",
    "Responsavel Adesao",
    issuedWithGuardian.body.protocol,
  ]) {
    assert.ok(text.includes(fragment), `PDF text must include ${fragment}`);
  }
  assert.match(text, /4\s+\(quatro\)\s+parcelas/);

  const tenInstallmentsPdfResponse = await fetch(
    `${apiUrl}/students/${tenInstallmentsStudent.studentId}/official-documents/${issuedTenInstallments.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(tenInstallmentsPdfResponse.status, 200);
  const tenInstallmentsPdfPath = path.join(outDir, "termo-adesao-dez-parcelas.pdf");
  await writeFile(
    tenInstallmentsPdfPath,
    Buffer.from(await tenInstallmentsPdfResponse.arrayBuffer()),
  );
  const tenInstallmentsText = run("pdftotext", [tenInstallmentsPdfPath, "-"]);
  for (const fragment of ["R$ 275,50", "R$ 2.755,00"]) {
    assert.ok(
      tenInstallmentsText.includes(fragment),
      `10 installments PDF text must include ${fragment}`,
    );
  }
  assert.match(tenInstallmentsText, /10\s+\(dez\)\s+parcelas/);

  const january31PdfResponse = await fetch(
    `${apiUrl}/students/${january31Student.studentId}/official-documents/${issuedJanuary31.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(january31PdfResponse.status, 200);
  const january31PdfPath = path.join(outDir, "termo-adesao-31-janeiro.pdf");
  await writeFile(
    january31PdfPath,
    Buffer.from(await january31PdfResponse.arrayBuffer()),
  );
  const january31Text = run("pdftotext", [january31PdfPath, "-"]);
  for (const fragment of [
    "31/01/2026",
    "28/02/2026",
    "31/03/2026",
    "30/04/2026",
    "R$ 199,99",
  ]) {
    assert.ok(
      january31Text.includes(fragment),
      `31 January PDF text must include ${fragment}`,
    );
  }

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    run("pdftoppm", [
      "-png",
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      path.join(outDir, `termo-adesao-pagina-${String(pageNumber).padStart(2, "0")}`),
    ]);
  }
  const legacyInfo = run("pdfinfo", [legacyPdfPath]);
  assert.match(legacyInfo, /^Pages:\s+\d+/m);
  run("pdftoppm", [
    "-png",
    "-f",
    "1",
    "-l",
    "2",
    legacyPdfPath,
    path.join(outDir, "legado-termo-adesao-pagina"),
  ]);

  const newPresident = await replacePresident(refs, firstPresident.membershipId, user.id);
  const reissued = await api(
    `/students/${withGuardian.studentId}/official-documents/${issuedWithGuardian.body.id}/reissue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(reissued.response.status, 201, JSON.stringify(reissued.body));
  assert.equal(reissued.body.sourceIssueId, issuedWithGuardian.body.id);
  assert.deepEqual(
    reissued.body.adhesionDetails.installments,
    issuedWithGuardian.body.adhesionDetails.installments,
  );
  assert.equal(
    reissued.body.signerDetails[0]?.signerName,
    issuedWithGuardian.body.signerDetails[0]?.signerName,
  );
  assert.notEqual(reissued.body.signerDetails[0]?.signerStudentId, newPresident.studentId);

  const auditCount = await prisma.administrativeAuditLog.count({
    where: {
      recordId: {
        in: [
          issuedNoGuardian.body.id,
          issuedWithGuardian.body.id,
          issuedTenInstallments.body.id,
          issuedJanuary31.body.id,
          secretariaIssue.body.id,
          reissued.body.id,
        ],
      },
    },
  });
  assert.ok(auditCount >= 6, "issue/reissue audit logs must be recorded");

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/snap/bin/chromium",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { height: 768, width: 1366 } });
  const authCookie = parseCookie(cookie);
  await context.addCookies([
    { httpOnly: true, name: authCookie.name, sameSite: "Lax", url: apiUrl, value: authCookie.value },
  ]);
  const page = await context.newPage();
  await page.goto(`${webUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}",
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: /^Academicos/ }).first().click();
  await page.getByRole("heading", { exact: true, name: "Academicos" }).waitFor();
  await page
    .getByPlaceholder("Buscar por carteirinha, nome ou CPF")
    .fill(`Associado Com Responsavel ${runId}`);
  await page.getByRole("button", { exact: true, name: "Buscar" }).click();
  await page.getByText(`Associado Com Responsavel ${runId}`, { exact: true }).first().waitFor();
  await page
    .locator(`button[aria-label="Acoes de Associado Com Responsavel ${runId}"]`)
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { exact: true, name: "Documentos" }).click();
  await page.getByRole("heading", { exact: true, name: "Documentos Oficiais" }).waitFor();
  const adhesionCard = page.locator("article").filter({
    has: page.getByRole("heading", {
      exact: true,
      name: "Termo de Adesão e Filiação",
    }),
  });
  await adhesionCard.getByText("Primeira mensalidade").waitFor();
  await adhesionCard.getByText("Parcelas: 4").waitFor();
  await adhesionCard.getByText("Valor: R$ 330,00").waitFor();

  const viewports = [
    ["desktop", 1366, 768],
    ["notebook", 1024, 768],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ];
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await adhesionCard.getByRole("button", { exact: true, name: "Emitir" }).waitFor();
    await adhesionCard.getByRole("button", { exact: true, name: "Visualizar" }).waitFor();
    await adhesionCard.getByRole("button", { exact: true, name: "Reemitir" }).waitFor();
    await adhesionCard.getByRole("button", { exact: true, name: "Baixar PDF" }).waitFor();
    await assertNoHorizontalOverflow(page, `overflow ${name}`);
    await page.screenshot({
      fullPage: true,
      path: path.join(outDir, `documentos-termo-adesao-${name}-${width}.png`),
    });
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await adhesionCard.getByRole("button", { exact: true, name: "Emitir" }).click();
  await page
    .getByRole("heading", { exact: true, name: "Emitir Termo de Adesão e Filiação" })
    .waitFor();
  await page.getByLabel("Primeira mensalidade").waitFor();
  await page.getByLabel("Valor da parcela").waitFor();
  await page.getByLabel("Quantidade de parcelas").waitFor();
  await assertNoHorizontalOverflow(page, "dialog desktop");
  await page.screenshot({
    fullPage: true,
    path: path.join(outDir, "dialog-termo-adesao-desktop.png"),
  });
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await adhesionCard.getByRole("button", { exact: true, name: "Emitir" }).click();
  await page
    .getByRole("heading", { exact: true, name: "Emitir Termo de Adesão e Filiação" })
    .waitFor();
  await assertNoHorizontalOverflow(page, "dialog mobile");
  await page.screenshot({
    fullPage: true,
    path: path.join(outDir, "dialog-termo-adesao-mobile.png"),
  });
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();

  await browser.close();
  browser = undefined;
  await cleanup();
  const residue = {
    users: await prisma.user.count({ where: { id: { in: ids.users } } }),
    people: await prisma.person.count({ where: { id: { in: ids.people } } }),
    students: await prisma.student.count({ where: { id: { in: ids.students } } }),
    enrollments: await prisma.enrollment.count({ where: { id: { in: ids.enrollments } } }),
    guardians: await prisma.studentGuardian.count({ where: { id: { in: ids.guardians } } }),
    boardMemberships: await prisma.boardMembership.count({
      where: { id: { in: ids.boardMemberships } },
    }),
    officialDocumentIssues: await prisma.officialDocumentIssue.count({
      where: {
        id: {
          in: [
            issuedNoGuardian.body.id,
            issuedWithGuardian.body.id,
            issuedTenInstallments.body.id,
            issuedJanuary31.body.id,
            secretariaIssue.body.id,
            reissued.body.id,
          ],
        },
      },
    }),
    administrativeAudit: await prisma.administrativeAuditLog.count({
      where: { userId: { in: ids.users } },
    }),
    securityAudit: await prisma.securityAuditLog.count({
      where: { OR: [{ userId: { in: ids.users } }, { email: { in: emails } }] },
    }),
  };
  assert.deepEqual(residue, {
    users: 0,
    people: 0,
    students: 0,
    enrollments: 0,
    guardians: 0,
    boardMemberships: 0,
    officialDocumentIssues: 0,
    administrativeAudit: 0,
    securityAudit: 0,
  });

  console.log(JSON.stringify({ ok: true, outDir, pages, pdfPath }, null, 2));
} finally {
  await browser?.close();
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
}
