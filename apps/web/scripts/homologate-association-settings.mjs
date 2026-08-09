import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const outDir = "/tmp/atretu-sprint12-association-settings";
const storageDir =
  process.env.DOCUMENT_STORAGE_DIR ??
  "/tmp/atretu-sprint12-association-settings/storage";
const runId = `s12-${Date.now()}`;
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
const uploadedLogoKeys = [];
let browser;
let institutionId;
let shiftId;
let originalSettings;

const configA = {
  city: "Terra Rica",
  cnpj: "49.682.667/0001-00",
  complement: "",
  displayName: "ATRETU QA A",
  district: "Centro",
  email: "qa-a@atretu.local",
  legalName: "ATRETU QA A",
  number: "100",
  postalCode: "87890-000",
  primaryPhone: "44 99999-0001",
  secondaryPhone: "",
  state: "PR",
  street: "Rua Configuração A",
  website: "",
};

const configB = {
  ...configA,
  displayName: "ATRETU QA B",
  email: "qa-b@atretu.local",
  legalName: "ATRETU QA B",
  number: "200",
  primaryPhone: "44 99999-0002",
  street: "Rua Configuração B",
};

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

const realLogo = readFileSync("apps/api/src/student-cards/assets/atretu-logo.png");
const pngA = realLogo;
const pngB = realLogo;

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
  const email = `${runId}-${roleCode.toLowerCase()}-${ids.users.length}@qa.local`;
  ids.users.push(id);
  emails.push(email);
  await prisma.user.create({
    data: {
      id,
      email,
      mustChangePassword: false,
      name,
      passwordHash: await bcrypt.hash(password, 8),
      roles: { create: { roleId: role.id } },
      institutions: {
        create: institutionIds.map((institutionId) => ({ institutionId })),
      },
    },
  });
  return { email, id };
}

async function createStudent({
  academicYearId,
  name,
  status = "ACTIVE",
  targetInstitutionId,
  targetShiftId,
}) {
  const personId = randomUUID();
  const studentId = randomUUID();
  const enrollmentId = randomUUID();
  ids.people.push(personId);
  ids.students.push(studentId);
  ids.enrollments.push(enrollmentId);
  await prisma.person.create({
    data: {
      id: personId,
      addressCity: "Terra Rica",
      addressNeighborhood: "Centro",
      addressNumber: "123",
      addressState: "PR",
      addressStreet: "Rua QA",
      addressZipCode: "87890-000",
      birthDate: new Date("2001-05-12T00:00:00.000Z"),
      cpf: buildCpf(Math.floor(Math.random() * 800_000_000) + 100_000_000),
      email: `${name.replace(/\s+/g, ".").toLowerCase()}@qa.local`,
      fullName: name,
      normalizedName: name.toLowerCase(),
      phone: "44999999999",
      rg: `RG-${runId}`,
    },
  });
  await prisma.student.create({
    data: {
      id: studentId,
      joinedAt: new Date("2024-02-01T00:00:00.000Z"),
      personId,
      status,
    },
  });
  await prisma.enrollment.create({
    data: {
      id: enrollmentId,
      academicYearId,
      course: "Direito",
      grade: "1o",
      institutionId: targetInstitutionId,
      shiftId: targetShiftId,
      status: "ACTIVE",
      studentId,
    },
  });
  if (status === "TERMINATED") {
    await prisma.studentHistoryEvent.create({
      data: {
        eventType: "STUDENT_TERMINATED",
        id: randomUUID(),
        justification: `QA encerramento ${runId}`,
        occurredAt: new Date("2026-08-08T12:00:00.000Z"),
        studentId,
        terminationReason: "WITHDRAWAL",
      },
    });
  }
  return { studentId };
}

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const text = await response.text();
  return {
    body: text ? safeJson(text) : {},
    cookie: response.headers.get("set-cookie"),
    response,
    text,
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
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

async function login(user) {
  const response = await api("/auth/login", {
    body: JSON.stringify({ email: user.email, password }),
    headers: json(),
    method: "POST",
  });
  assert.equal(response.response.status, 200, `login ${user.email}`);
  assert.ok(response.cookie, "login cookie");
  return response.cookie;
}

async function uploadLogo(cookie, fileName, buffer, type = "image/png") {
  const form = new FormData();
  form.set("file", new File([buffer], fileName, { type }));
  const response = await api("/admin/association-settings/logo", {
    body: form,
    headers: { cookie },
    method: "POST",
  });
  assert.equal(response.response.status, 201, JSON.stringify(response.body));
  assert.ok(response.body.logoStorageKey, "logo storage key");
  uploadedLogoKeys.push(response.body.logoStorageKey);
  return response.body;
}

async function updateSettings(cookie, body) {
  const response = await api("/admin/association-settings", {
    body: JSON.stringify(body),
    headers: json(cookie),
    method: "PUT",
  });
  assert.equal(response.response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function issueStudentDocument(cookie, studentId, type, body) {
  const response = await api(
    `/students/${studentId}/official-documents/${type}/issue`,
    {
      body: body ? JSON.stringify(body) : undefined,
      headers: json(cookie),
      method: "POST",
    },
  );
  assert.equal(response.response.status, 201, `${type}: ${JSON.stringify(response.body)}`);
  return response.body;
}

async function issueInstitutionalDocument(cookie) {
  const response = await api("/official-documents/institutional/INTERNAL_REGULATION/issue", {
    body: JSON.stringify({ approvalDate: "2026-08-08", notes: `QA ${runId}` }),
    headers: json(cookie),
    method: "POST",
  });
  assert.equal(response.response.status, 201, JSON.stringify(response.body));
  return response.body;
}

async function reissueDocument(cookie, studentId, issueId) {
  const response = await api(
    `/students/${studentId}/official-documents/${issueId}/reissue`,
    {
      headers: json(cookie),
      method: "POST",
    },
  );
  assert.equal(response.response.status, 201, JSON.stringify(response.body));
  return response.body;
}

function snapshot(issueId) {
  return prisma.officialDocumentIssue
    .findUniqueOrThrow({ where: { id: issueId } })
    .then((issue) => issue.contentSnapshot);
}

function assertAssociation(snapshot, expected, logoStorageKey, label) {
  assert.equal(snapshot.association.legalName, expected.legalName, `${label} name`);
  assert.equal(snapshot.association.cnpj, expected.cnpj, `${label} cnpj`);
  assert.equal(snapshot.association.street, expected.street, `${label} street`);
  assert.equal(snapshot.association.number, expected.number, `${label} number`);
  assert.equal(snapshot.association.city, expected.city, `${label} city`);
  assert.equal(snapshot.association.state, expected.state, `${label} state`);
  assert.equal(snapshot.association.postalCode, expected.postalCode, `${label} cep`);
  assert.equal(
    snapshot.association.primaryPhone,
    expected.primaryPhone,
    `${label} phone`,
  );
  assert.equal(snapshot.association.email, expected.email, `${label} email`);
  assert.equal(snapshot.association.logoStorageKey, logoStorageKey, `${label} logo`);
  assert.ok(snapshot.footerNote.includes(expected.legalName), `${label} footer name`);
  assert.ok(snapshot.footerNote.includes(expected.email), `${label} footer email`);
}

async function assertFileAccessible(cookie, storageKey) {
  const response = await fetch(
    `${apiUrl}/admin/association-settings/logo?key=${encodeURIComponent(storageKey)}`,
    { headers: { cookie } },
  );
  assert.equal(response.status, 200, `logo accessible ${storageKey}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.ok(buffer.byteLength > 20, "logo bytes");
}

async function assertPdfText(cookie, studentId, issueId, expected) {
  const pdf = await fetch(
    `${apiUrl}/students/${studentId}/official-documents/${issueId}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(pdf.status, 200, "PDF inline");
  const pdfPath = `${outDir}/${issueId}.pdf`;
  await writeFile(pdfPath, Buffer.from(await pdf.arrayBuffer()));
  const textPath = `${outDir}/${issueId}`;
  const pdftotext = spawnSync("pdftotext", [pdfPath, textPath]);
  assert.equal(pdftotext.status, 0, "pdftotext");
  const result = spawnSync("cat", [textPath], { encoding: "utf8" });
  for (const fragment of expected) {
    assert.ok(result.stdout.includes(fragment), `PDF includes ${fragment}`);
  }
}

async function cleanup() {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (originalSettings) {
    await prisma.associationSettings.update({
      where: { id: "association-settings" },
      data: {
        city: originalSettings.city,
        cnpj: originalSettings.cnpj,
        complement: originalSettings.complement,
        displayName: originalSettings.displayName,
        district: originalSettings.district,
        email: originalSettings.email,
        legalName: originalSettings.legalName,
        logoContentType: originalSettings.logoContentType,
        logoFileName: originalSettings.logoFileName,
        logoSizeBytes: originalSettings.logoSizeBytes,
        logoStorageKey: originalSettings.logoStorageKey,
        number: originalSettings.number,
        postalCode: originalSettings.postalCode,
        primaryPhone: originalSettings.primaryPhone,
        secondaryPhone: originalSettings.secondaryPhone,
        state: originalSettings.state,
        street: originalSettings.street,
        updatedByUserId: originalSettings.updatedByUserId,
        website: originalSettings.website,
      },
    });
  }
  const issues = await prisma.officialDocumentIssue.findMany({
    where: { studentId: { in: ids.students } },
    select: { id: true, storageKey: true },
  });
  const institutionalIssues = await prisma.officialDocumentIssue.findMany({
    where: {
      studentId: null,
      issuedByUserId: { in: ids.users },
    },
    select: { id: true, storageKey: true },
  });
  const allIssues = [...issues, ...institutionalIssues];
  const issueIds = allIssues.map((issue) => issue.id);
  const boardMemberships = await prisma.boardMembership.findMany({
    where: { studentId: { in: ids.students } },
    select: { id: true },
  });
  const boardMembershipIds = Array.from(
    new Set([...ids.boardMemberships, ...boardMemberships.map((item) => item.id)]),
  );
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
  await prisma.studentHistoryEvent.deleteMany({
    where: { studentId: { in: ids.students } },
  });
  await prisma.boardMembership.deleteMany({ where: { id: { in: boardMembershipIds } } });
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
  for (const issue of allIssues) {
    await rm(path.join(storageDir, issue.storageKey), { force: true });
  }
  for (const key of uploadedLogoKeys) {
    if (key !== originalSettings?.logoStorageKey) {
      await rm(path.join(storageDir, key), { force: true });
    }
  }
}

async function screenshotSettings(cookie) {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/snap/bin/chromium",
    headless: true,
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 768, width: 1366 },
  });
  const sessionCookie = parseCookie(cookie);
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
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("heading", { name: "Configurações Institucionais" }).waitFor();
  await page.getByLabel("Nome institucional").fill("ATRETU QA B WEB");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByLabel("Nome institucional").fill("ATRETU QA B WEB");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Configurações institucionais salvas.").waitFor();
  await page.getByLabel("Nome institucional").fill(configB.legalName);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Configurações institucionais salvas.").waitFor();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    buffer: pngB,
    mimeType: "image/png",
    name: "logo-b-web.png",
  });
  await page.getByText("Logo oficial atualizada.").waitFor();
  const currentSettings = await api("/admin/association-settings", {
    headers: json(cookie),
  });
  if (currentSettings.body.logoStorageKey) {
    uploadedLogoKeys.push(currentSettings.body.logoStorageKey);
  }
  for (const [fileName, viewport] of [
    ["settings-desktop-1366.png", { height: 768, width: 1366 }],
    ["settings-notebook-1024.png", { height: 768, width: 1024 }],
    ["settings-tablet-768.png", { height: 1024, width: 768 }],
    ["settings-mobile-390.png", { height: 844, width: 390 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth <= document.body.clientWidth + 1,
      document:
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    }));
    assert.deepEqual(overflow, { body: true, document: true }, fileName);
    await page.screenshot({ fullPage: true, path: `${outDir}/${fileName}` });
  }
  assert.deepEqual(dialogs, [], "no native browser dialogs");
}

try {
  originalSettings = await prisma.associationSettings.findUnique({
    where: { id: "association-settings" },
  });
  assert.ok(originalSettings, "original association settings");

  const year = await prisma.academicYear.upsert({
    where: { year: 2096 },
    create: { isCurrent: false, status: "ACTIVE", year: 2096 },
    update: {},
  });
  const institution = await prisma.institution.create({
    data: {
      name: `Instituicao S12 ${runId}`,
      normalizedName: `instituicao s12 ${runId}`,
    },
  });
  institutionId = institution.id;
  const shift = await prisma.shift.create({
    data: { name: `Noite S12 ${runId}`, normalizedName: `noite s12 ${runId}` },
  });
  shiftId = shift.id;

  const superAdmin = await createUser("SUPER_ADMIN", "QA S12 Super");
  const secretary = await createUser("SECRETARIA", "QA S12 Secretaria", [
    institution.id,
  ]);
  const gestor = await createUser("GESTOR", "QA S12 Gestor");
  const superCookie = await login(superAdmin);
  const secretaryCookie = await login(secretary);
  const gestorCookie = await login(gestor);

  const activeStudent = await createStudent({
    academicYearId: year.id,
    name: `Associado S12 ${runId}`,
    targetInstitutionId: institution.id,
    targetShiftId: shift.id,
  });
  const terminatedStudent = await createStudent({
    academicYearId: year.id,
    name: `Desligado S12 ${runId}`,
    status: "TERMINATED",
    targetInstitutionId: institution.id,
    targetShiftId: shift.id,
  });
  const president = await createStudent({
    academicYearId: year.id,
    name: `Presidente S12 ${runId}`,
    targetInstitutionId: institution.id,
    targetShiftId: shift.id,
  });
  const boardMembershipId = randomUUID();
  ids.boardMemberships.push(boardMembershipId);
  await prisma.boardMembership.create({
    data: {
      id: boardMembershipId,
      role: "PRESIDENT",
      startNote: `presidente ${runId}`,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      studentId: president.studentId,
    },
  });

  assert.equal((await api("/admin/association-settings")).response.status, 401);
  assert.equal(
    (await api("/admin/association-settings", { headers: json(secretaryCookie) }))
      .response.status,
    403,
  );
  assert.equal(
    (await api("/admin/association-settings", { headers: json(gestorCookie) }))
      .response.status,
    403,
  );
  assert.equal(
    (await api("/admin/association-settings", { headers: json(superCookie) }))
      .response.status,
    200,
  );

  assert.equal(
    (
      await api("/admin/association-settings", {
        body: JSON.stringify(configA),
        headers: json(secretaryCookie),
        method: "PUT",
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await api("/admin/association-settings/logo", {
        body: new FormData(),
        headers: { cookie: secretaryCookie },
        method: "POST",
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await api("/admin/association-settings", {
        body: JSON.stringify(configA),
        headers: json(gestorCookie),
        method: "PUT",
      })
    ).response.status,
    403,
  );

  await updateSettings(superCookie, configA);
  const settingsA = await uploadLogo(superCookie, "logo-a.png", pngA);
  const issueA = await issueStudentDocument(
    secretaryCookie,
    activeStudent.studentId,
    "TERMINATION_TERM",
    {
      dueDate: "2026-08-01",
      notificationDate: "2026-08-06",
      notes: `config A ${runId}`,
      reason: "Inadimplência",
      regularizationDeadlineDays: 10,
    },
  );
  const snapA = await snapshot(issueA.id);
  assertAssociation(snapA, configA, settingsA.logoStorageKey, "issue A");

  await updateSettings(superCookie, configB);
  const settingsB = await uploadLogo(superCookie, "logo-b.png", pngB);
  const issueB = await issueStudentDocument(
    secretaryCookie,
    activeStudent.studentId,
    "ANNUAL_CLEARANCE_DECLARATION",
    {
      finalClearanceDate: "2026-11-15",
      totalAmountCents: 30000,
      year: 2026,
    },
  );
  const snapB = await snapshot(issueB.id);
  assertAssociation(snapB, configB, settingsB.logoStorageKey, "issue B");
  assertAssociation(await snapshot(issueA.id), configA, settingsA.logoStorageKey, "stored A");

  const reissueA = await reissueDocument(
    secretaryCookie,
    activeStudent.studentId,
    issueA.id,
  );
  const reissueSnapA = await snapshot(reissueA.id);
  assertAssociation(reissueSnapA, configA, settingsA.logoStorageKey, "reissue A");
  assert.ok(!JSON.stringify(reissueSnapA.association).includes("ATRETU QA B"));

  assert.notEqual(settingsA.logoStorageKey, settingsB.logoStorageKey, "logos versioned");
  assert.ok(existsSync(path.join(storageDir, settingsA.logoStorageKey)), "logo A file");
  assert.ok(existsSync(path.join(storageDir, settingsB.logoStorageKey)), "logo B file");
  await assertFileAccessible(superCookie, settingsA.logoStorageKey);
  await assertFileAccessible(superCookie, settingsB.logoStorageKey);
  assert.equal(
    (
      await api(
        `/admin/association-settings/logo?key=${encodeURIComponent("../../etc/passwd")}`,
        { headers: json(superCookie) },
      )
    ).response.status,
    400,
  );

  const invalidForm = new FormData();
  invalidForm.set(
    "file",
    new File([Buffer.from("nao e png")], "logo-invalida.png", {
      type: "image/png",
    }),
  );
  assert.equal(
    (
      await api("/admin/association-settings/logo", {
        body: invalidForm,
        headers: { cookie: superCookie },
        method: "POST",
      })
    ).response.status,
    400,
  );
  const largeForm = new FormData();
  largeForm.set(
    "file",
    new File([Buffer.alloc(2 * 1024 * 1024 + 1)], "logo-grande.png", {
      type: "image/png",
    }),
  );
  assert.ok(
    [400, 413].includes(
      (
        await api("/admin/association-settings/logo", {
          body: largeForm,
          headers: { cookie: superCookie },
          method: "POST",
        })
      ).response.status,
    ),
    "large logo rejected",
  );

  const documentIssues = [];
  documentIssues.push(issueA);
  documentIssues.push(issueB);
  documentIssues.push(reissueA);
  documentIssues.push(
    await issueStudentDocument(secretaryCookie, activeStudent.studentId, "ADHESION_TERM", {
      firstInstallmentDate: "2026-08-10",
      installmentAmountCents: 30000,
      installmentCount: 10,
    }),
  );
  documentIssues.push(
    await issueStudentDocument(
      secretaryCookie,
      activeStudent.studentId,
      "TRANSPORT_REGULATION",
    ),
  );
  documentIssues.push(
    await issueStudentDocument(
      secretaryCookie,
      activeStudent.studentId,
      "TRANSPORT_REFUND_REQUEST",
      {
        paymentMethod: "PIX",
        pixKey: `pix-${runId}@qa.local`,
        reason: "Reembolso QA",
        refundAmountCents: 12550,
      },
    ),
  );
  documentIssues.push(
    await issueStudentDocument(
      secretaryCookie,
      terminatedStudent.studentId,
      "TERMINATION_LETTER",
    ),
  );
  const internalIssue = await issueInstitutionalDocument(superCookie);
  for (const issue of documentIssues) {
    const snap = await snapshot(issue.id);
    assert.ok(snap.association?.legalName, `${issue.type} association snapshot`);
    assert.ok(snap.footerNote.includes(snap.association.email), `${issue.type} footer`);
  }
  const internalSnap = await snapshot(internalIssue.id);
  assert.equal(internalSnap.association.legalName, configB.legalName);

  await assertPdfText(secretaryCookie, activeStudent.studentId, issueB.id, [
    "ATRETU QA B",
    "Rua Configuração B",
    "qa-b@atretu.local",
    "49.682.667/0001-00",
  ]);
  await assertPdfText(secretaryCookie, activeStudent.studentId, reissueA.id, [
    "ATRETU QA A",
    "Rua Configuração A",
    "qa-a@atretu.local",
    "49.682.667/0001-00",
  ]);

  const originalLegalName = (await prisma.associationSettings.findUniqueOrThrow({
    where: { id: "association-settings" },
  })).legalName;
  await prisma.associationSettings.update({
    where: { id: "association-settings" },
    data: { legalName: "" },
  });
  const incompleteIssue = await api(
    `/students/${activeStudent.studentId}/official-documents/TERMINATION_TERM/issue`,
    {
      body: JSON.stringify({
        dueDate: "2026-08-01",
        notificationDate: "2026-08-06",
        reason: "Inadimplência",
        regularizationDeadlineDays: 10,
      }),
      headers: json(secretaryCookie),
      method: "POST",
    },
  );
  assert.equal(incompleteIssue.response.status, 400);
  await prisma.associationSettings.update({
    where: { id: "association-settings" },
    data: { legalName: originalLegalName },
  });

  const auditLogs = await prisma.administrativeAuditLog.findMany({
    where: {
      eventType: {
        in: ["ASSOCIATION_SETTINGS_UPDATED", "ASSOCIATION_LOGO_UPDATED"],
      },
      userId: superAdmin.id,
    },
  });
  assert.ok(auditLogs.length >= 4, "association audit logs");
  assert.ok(
    auditLogs.every((log) => !JSON.stringify(log.metadata).includes("iVBOR")),
    "audit does not contain base64",
  );

  await screenshotSettings(superCookie);

  const residueBeforeCleanup = {
    issues: await prisma.officialDocumentIssue.count({
      where: { issuedByUserId: { in: ids.users } },
    }),
    logos: uploadedLogoKeys.length,
    users: await prisma.user.count({ where: { id: { in: ids.users } } }),
  };

  await cleanup();

  const restored = await prisma.associationSettings.findUniqueOrThrow({
    where: { id: "association-settings" },
  });
  assert.equal(restored.legalName, originalSettings.legalName, "settings restored");
  assert.equal(restored.logoStorageKey, originalSettings.logoStorageKey, "logo restored");
  const residue = {
    auditLogs: await prisma.administrativeAuditLog.count({
      where: { userId: { in: ids.users } },
    }),
    issues: await prisma.officialDocumentIssue.count({
      where: { issuedByUserId: { in: ids.users } },
    }),
    people: await prisma.person.count({ where: { id: { in: ids.people } } }),
    students: await prisma.student.count({ where: { id: { in: ids.students } } }),
    users: await prisma.user.count({ where: { id: { in: ids.users } } }),
  };
  assert.deepEqual(residue, {
    auditLogs: 0,
    issues: 0,
    people: 0,
    students: 0,
    users: 0,
  });

  console.log(
    JSON.stringify(
      {
        auditLogs: auditLogs.length,
        configA,
        configB,
        documentA: issueA.id,
        documentB: issueB.id,
        logos: {
          A: settingsA.logoStorageKey,
          B: settingsB.logoStorageKey,
        },
        residue,
        residueBeforeCleanup,
        reissueA: reissueA.id,
        screenshots: [
          "settings-desktop-1366.png",
          "settings-notebook-1024.png",
          "settings-tablet-768.png",
          "settings-mobile-390.png",
        ],
        testedDocuments: [
          "TERMINATION_LETTER",
          "TERMINATION_TERM",
          "INTERNAL_REGULATION",
          "ADHESION_TERM",
          "TRANSPORT_REGULATION",
          "TRANSPORT_REFUND_REQUEST",
          "ANNUAL_CLEARANCE_DECLARATION",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  await cleanup().catch((cleanupError) => {
    console.error("cleanup failed", cleanupError);
  });
  throw error;
} finally {
  await prisma.$disconnect();
}
