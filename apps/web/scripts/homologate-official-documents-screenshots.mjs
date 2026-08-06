import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const outDir = "/tmp/atretu-sprint11-2-termination-term";
const storageDir =
  process.env.DOCUMENT_STORAGE_DIR ??
  "/tmp/atretu-sprint11-2-termination-term/storage";
const runId = `ui-s112-${Date.now()}`;
const password = "SenhaForte123";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

await mkdir(outDir, { recursive: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const ids = {
  boardMemberships: [],
  enrollments: [],
  people: [],
  students: [],
  users: [],
};
const emails = [];
let browser;
let institutionId;
let shiftId;

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

async function createUser(roleCode, institutionIds = []) {
  const role = await ensureRole(roleCode);
  const id = randomUUID();
  const email = `${runId}-${roleCode.toLowerCase()}@qa.local`;
  ids.users.push(id);
  emails.push(email);
  await prisma.user.create({
    data: {
      id,
      name: `QA Visual ${roleCode}`,
      email,
      passwordHash: await bcrypt.hash(password, 8),
      mustChangePassword: false,
      roles: { create: { roleId: role.id } },
      institutions: {
        create: institutionIds.map((institutionId) => ({ institutionId })),
      },
    },
  });
  return { email, id };
}

async function createStudent(name, academicYearId, targetInstitutionId, targetShiftId) {
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
      birthDate: new Date("2001-05-12T00:00:00.000Z"),
      phone: "44999999999",
      email: `${name.replace(/\s+/g, ".").toLowerCase()}@qa.local`,
      addressStreet: "Rua QA",
      addressNumber: "123",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
      addressState: "PR",
      addressZipCode: "87890000",
    },
  });
  await prisma.student.create({
    data: {
      id: studentId,
      personId,
      joinedAt: new Date("2024-02-01T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });
  await prisma.enrollment.create({
    data: {
      id: enrollmentId,
      studentId,
      academicYearId,
      institutionId: targetInstitutionId,
      shiftId: targetShiftId,
      course: "Direito",
      grade: "1o",
      status: "ACTIVE",
    },
  });
  return { studentId };
}

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
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

async function cleanup() {
  const issues = await prisma.officialDocumentIssue.findMany({
    where: { studentId: { in: ids.students } },
    select: { id: true, storageKey: true },
  });
  const issueIds = issues.map((issue) => issue.id);
  const boardMemberships = await prisma.boardMembership.findMany({
    where: { studentId: { in: ids.students } },
    select: { id: true },
  });
  const boardMembershipIds = Array.from(
    new Set([...ids.boardMemberships, ...boardMemberships.map((item) => item.id)]),
  );
  const recordIds = [
    ...issueIds,
    ...ids.students,
    ...ids.enrollments,
    ...boardMembershipIds,
  ];

  await prisma.administrativeAuditLog.deleteMany({
    where: {
      OR: [{ userId: { in: ids.users } }, { recordId: { in: recordIds } }],
    },
  });
  await prisma.securityAuditLog.deleteMany({
    where: { OR: [{ userId: { in: ids.users } }, { email: { in: emails } }] },
  });
  await prisma.officialDocumentIssue.deleteMany({
    where: { id: { in: issueIds } },
  });
  await prisma.studentHistoryEvent.deleteMany({
    where: { studentId: { in: ids.students } },
  });
  await prisma.boardMembership.deleteMany({
    where: { id: { in: boardMembershipIds } },
  });
  await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollments } } });
  await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
  await prisma.person.deleteMany({ where: { id: { in: ids.people } } });
  await prisma.userInstitution.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  if (institutionId) {
    await prisma.institution.deleteMany({ where: { id: institutionId } });
  }
  if (shiftId) {
    await prisma.shift.deleteMany({ where: { id: shiftId } });
  }
  for (const issue of issues) {
    await rm(`${storageDir}/${issue.storageKey}`, { force: true });
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({
    body: document.body.scrollWidth <= document.body.clientWidth + 1,
    document:
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  }));
  assert.deepEqual(result, { body: true, document: true }, `${label} overflow`);
}

async function assertVisibleControls(page, label) {
  for (const name of ["Emitir", "Visualizar", "Baixar PDF", "Reemitir"]) {
    await assertVisibleBox(
      page.locator("article").filter({
        has: page.getByRole("heading", {
          exact: true,
          name: "Termo de Desligamento da Associação ATRETU",
        }),
      }).getByRole("button", { exact: true, name }),
      `${label} ${name}`,
    );
  }
}

async function assertVisibleBox(locator, label) {
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  assert.ok(box, `${label} bounding box`);
  assert.ok(box.width > 0 && box.height > 0, `${label} visible size`);
  assert.ok(box.x >= -1, `${label} left clipped`);
}

async function screenshotDocuments(page, fileName, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("heading", {
    exact: true,
    name: "Documentos Oficiais",
  }).waitFor();
  await assertNoHorizontalOverflow(page, fileName);
  await assertVisibleControls(page, fileName);
  await page.screenshot({ fullPage: true, path: `${outDir}/${fileName}` });
}

try {
  const year = await prisma.academicYear.upsert({
    where: { year: 2095 },
    create: { year: 2095, isCurrent: false, status: "ACTIVE" },
    update: {},
  });
  const institution = await prisma.institution.create({
    data: {
      name: `Instituicao Visual ${runId}`,
      normalizedName: `instituicao visual ${runId}`,
    },
  });
  institutionId = institution.id;
  const shift = await prisma.shift.create({
    data: { name: `Noite Visual ${runId}`, normalizedName: `noite visual ${runId}` },
  });
  shiftId = shift.id;

  const secretary = await createUser("SECRETARIA", [institution.id]);
  const student = await createStudent(
    `Associado Visual ${runId}`,
    year.id,
    institution.id,
    shift.id,
  );
  const representative = await createStudent(
    `Presidente Visual ${runId}`,
    year.id,
    institution.id,
    shift.id,
  );
  const boardMembershipId = randomUUID();
  ids.boardMemberships.push(boardMembershipId);
  await prisma.boardMembership.create({
    data: {
      id: boardMembershipId,
      studentId: representative.studentId,
      status: "ACTIVE",
      startedAt: new Date(),
      startNote: `representante ${runId}`,
    },
  });

  const login = await api("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({ email: secretary.email, password }),
  });
  assert.equal(login.response.status, 200, "API login");
  assert.ok(login.cookie, "API cookie");

  const issued = await api(
    `/students/${student.studentId}/official-documents/TERMINATION_TERM/issue`,
    {
      method: "POST",
      headers: json(login.cookie),
      body: JSON.stringify({
        dueDate: "2026-08-01",
        notificationDate: "2026-08-06",
        notes: `captura visual ${runId}`,
        reason: "Inadimplência",
        regularizationDeadlineDays: 10,
      }),
    },
  );
  assert.equal(issued.response.status, 201, JSON.stringify(issued.body));

  const pdf = await fetch(
    `${apiUrl}/students/${student.studentId}/official-documents/${issued.body.id}/file?disposition=inline`,
    { headers: { cookie: login.cookie } },
  );
  assert.equal(pdf.status, 200, "PDF inline");
  const pdfPath = `${outDir}/termo-desligamento-real.pdf`;
  await writeFile(pdfPath, Buffer.from(await pdf.arrayBuffer()));
  const pdfResult = spawnSync("pdftoppm", [
    "-png",
    "-f",
    "1",
    "-singlefile",
    pdfPath,
    `${outDir}/pdf-primeira-pagina`,
  ]);
  assert.equal(pdfResult.status, 0, "PDF first page render");

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/snap/bin/chromium",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { height: 768, width: 1366 } });
  const sessionCookie = parseCookie(login.cookie);
  await context.addCookies([
    {
      httpOnly: true,
      name: sessionCookie.name,
      sameSite: "Lax",
      url: apiUrl,
      value: sessionCookie.value,
    },
  ]);
  const page = await context.newPage();
  const dialogs = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.dismiss();
  });

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
    .fill(`Associado Visual ${runId}`);
  await page.getByRole("button", { exact: true, name: "Buscar" }).click();
  await page.getByText(`Associado Visual ${runId}`, { exact: true }).first().waitFor();
  await page
    .locator(`button[aria-label="Acoes de Associado Visual ${runId}"]`)
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { exact: true, name: "Documentos" }).click();
  await page
    .getByRole("heading", { exact: true, name: "Documentos Oficiais" })
    .waitFor();

  await screenshotDocuments(page, "documentos-do-aluno-desktop-1366.png", {
    height: 768,
    width: 1366,
  });
  await screenshotDocuments(page, "documentos-do-aluno-notebook-1024.png", {
    height: 768,
    width: 1024,
  });
  await screenshotDocuments(page, "documentos-do-aluno-tablet-768.png", {
    height: 1024,
    width: 768,
  });
  await screenshotDocuments(page, "documentos-do-aluno-mobile-390.png", {
    height: 844,
    width: 390,
  });

  const termCard = page.locator("article").filter({
    has: page.getByRole("heading", {
      exact: true,
      name: "Termo de Desligamento da Associação ATRETU",
    }),
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await termCard.getByRole("button", { exact: true, name: "Emitir" }).click();
  await page
    .getByRole("heading", { exact: true, name: "Emitir Termo de Desligamento" })
    .waitFor();
  await assertNoHorizontalOverflow(page, "dialog desktop");
  await assertVisibleBox(page.getByLabel("Data do vencimento"), "vencimento");
  await assertVisibleBox(page.getByLabel("Data da notificacao"), "notificacao");
  await assertVisibleBox(page.getByLabel("Prazo"), "prazo");
  await page.screenshot({
    fullPage: true,
    path: `${outDir}/dialog-termo-desligamento-desktop.png`,
  });
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();

  await page.setViewportSize({ height: 844, width: 390 });
  await termCard.getByRole("button", { exact: true, name: "Emitir" }).click();
  await page
    .getByRole("heading", { exact: true, name: "Emitir Termo de Desligamento" })
    .waitFor();
  await assertNoHorizontalOverflow(page, "dialog mobile");
  await assertVisibleBox(page.getByLabel("Data do vencimento"), "mobile vencimento");
  await assertVisibleBox(page.getByLabel("Data da notificacao"), "mobile notificacao");
  await assertVisibleBox(page.getByLabel("Prazo"), "mobile prazo");
  await page.screenshot({
    fullPage: true,
    path: `${outDir}/dialog-termo-desligamento-mobile.png`,
  });
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();

  await page.setViewportSize({ height: 768, width: 1366 });
  await page.screenshot({ fullPage: true, path: `${outDir}/documento-emitido.png` });
  await page.getByRole("button", { exact: true, name: "Historico" }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("heading", { exact: true, name: "Historico funcional" }).waitFor();
  await assertNoHorizontalOverflow(page, "historico");
  await page.screenshot({
    fullPage: true,
    path: `${outDir}/historico-termo-desligamento.png`,
  });

  assert.equal(dialogs.length, 0, `window dialogs: ${dialogs.join(", ")}`);
  const visibleText = await page.locator("body").innerText();
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
      visibleText,
    ),
    "visible technical UUID",
  );

  await browser.close();
  browser = undefined;
  await cleanup();

  const residue = {
    administrativeAudit: await prisma.administrativeAuditLog.count({
      where: { userId: { in: ids.users } },
    }),
    enrollments: await prisma.enrollment.count({
      where: { id: { in: ids.enrollments } },
    }),
    officialDocumentIssues: await prisma.officialDocumentIssue.count({
      where: { studentId: { in: ids.students } },
    }),
    people: await prisma.person.count({ where: { id: { in: ids.people } } }),
    securityAudit: await prisma.securityAuditLog.count({
      where: { OR: [{ userId: { in: ids.users } }, { email: { in: emails } }] },
    }),
    storageFiles: existsSync(storageDir)
      ? (await readdir(storageDir, { recursive: true })).filter((item) =>
          String(item).endsWith(".pdf"),
        ).length
      : 0,
    students: await prisma.student.count({ where: { id: { in: ids.students } } }),
    users: await prisma.user.count({ where: { id: { in: ids.users } } }),
  };
  assert.deepEqual(residue, {
    administrativeAudit: 0,
    enrollments: 0,
    officialDocumentIssues: 0,
    people: 0,
    securityAudit: 0,
    storageFiles: 0,
    students: 0,
    users: 0,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        residue,
        runId,
        screenshots: [
          "documentos-do-aluno-desktop-1366.png",
          "documentos-do-aluno-notebook-1024.png",
          "documentos-do-aluno-tablet-768.png",
          "documentos-do-aluno-mobile-390.png",
          "dialog-termo-desligamento-desktop.png",
          "dialog-termo-desligamento-mobile.png",
          "historico-termo-desligamento.png",
          "documento-emitido.png",
          "pdf-primeira-pagina.png",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  if (browser) {
    await browser.close().catch(() => {});
  }
  await cleanup().catch((cleanupError) => {
    console.error("cleanup failed", cleanupError);
  });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
