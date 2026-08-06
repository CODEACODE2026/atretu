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
const outDir = "/tmp/atretu-sprint11-4-internal-regulation";
const storageDir =
  process.env.PRIVATE_STORAGE_PATH ??
  process.env.DOCUMENT_STORAGE_DIR ??
  path.join(outDir, "storage");
const runId = `qa-s114-${Date.now()}`;
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
  boardMemberships: [],
  people: [],
  students: [],
  users: [],
};
const emails = [];
let browser;

async function ensureRole(code) {
  return prisma.role.upsert({
    where: { code },
    create: { code, description: code },
    update: {},
  });
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

async function createUser(roleCode = "SUPER_ADMIN", name = "QA Regimento Interno") {
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
      roles: { create: { roleId: role.id } },
    },
  });
  return { email, id };
}

async function createPresident() {
  const personId = randomUUID();
  const studentId = randomUUID();
  const membershipId = randomUUID();
  ids.people.push(personId);
  ids.students.push(studentId);
  ids.boardMemberships.push(membershipId);
  await prisma.person.create({
    data: {
      id: personId,
      fullName: "Presidente Regimento QA",
      normalizedName: "presidente regimento qa",
      cpf: buildCpf(Math.floor(Math.random() * 800_000_000) + 100_000_000),
      rg: `RG-${runId}`,
      birthDate: new Date("1998-05-12T00:00:00.000Z"),
      phone: "44999999999",
      email: `${runId}.presidente@qa.local`,
      addressStreet: "Rua Institucional",
      addressNumber: "100",
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
  await prisma.boardMembership.create({
    data: {
      id: membershipId,
      role: "PRESIDENT",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      studentId,
    },
  });
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
    where: {
      OR: [
        { issuedByUserId: { in: ids.users } },
        { studentId: { in: ids.students } },
      ],
    },
    select: { id: true, storageKey: true },
  });
  const issueIds = issues.map((issue) => issue.id);
  await prisma.administrativeAuditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: ids.users } },
        { recordId: { in: [...issueIds, ...ids.students, ...ids.boardMemberships] } },
      ],
    },
  });
  await prisma.securityAuditLog.deleteMany({
    where: { OR: [{ userId: { in: ids.users } }, { email: { in: emails } }] },
  });
  await prisma.officialDocumentIssue.deleteMany({ where: { id: { in: issueIds } } });
  await prisma.boardMembership.deleteMany({ where: { id: { in: ids.boardMemberships } } });
  await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
  await prisma.person.deleteMany({ where: { id: { in: ids.people } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  for (const issue of issues) {
    await rm(path.join(storageDir, issue.storageKey), { force: true });
  }
}

try {
  await cleanup();
  const user = await createUser("SUPER_ADMIN", "QA Regimento Interno");
  const secretaria = await createUser("SECRETARIA", "QA Secretaria Regimento");
  const gestor = await createUser("GESTOR", "QA Gestor Regimento");
  await createPresident();

  const login = await api("/auth/login", {
    body: JSON.stringify({ email: user.email, password }),
    headers: json(),
    method: "POST",
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  assert.ok(login.cookie, "login must set auth cookie");
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

  const noSession = await api("/official-documents/institutional");
  assert.equal(noSession.response.status, 401, JSON.stringify(noSession.body));

  const gestorList = await api("/official-documents/institutional", {
    headers: json(gestorCookie),
  });
  assert.equal(gestorList.response.status, 403, JSON.stringify(gestorList.body));

  const catalog = await api("/official-documents/institutional", {
    headers: json(cookie),
  });
  assert.equal(catalog.response.status, 200, JSON.stringify(catalog.body));
  assert.equal(catalog.body.data[0]?.type, "INTERNAL_REGULATION");
  assert.equal(catalog.body.data[0]?.signerPreview?.signerName, "Presidente Regimento QA");

  const secretariaCatalog = await api("/official-documents/institutional", {
    headers: json(secretariaCookie),
  });
  assert.equal(secretariaCatalog.response.status, 200, JSON.stringify(secretariaCatalog.body));

  const secretariaIssue = await api("/official-documents/institutional/INTERNAL_REGULATION/issue", {
    body: JSON.stringify({ approvalDate: "2022-12-20" }),
    headers: json(secretariaCookie),
    method: "POST",
  });
  assert.equal(secretariaIssue.response.status, 403, JSON.stringify(secretariaIssue.body));

  const issued = await api("/official-documents/institutional/INTERNAL_REGULATION/issue", {
    body: JSON.stringify({
      approvalDate: "2022-12-20",
      notes: "QA Sprint 11.4 Regimento Interno",
    }),
    headers: json(cookie),
    method: "POST",
  });
  assert.equal(issued.response.status, 201, JSON.stringify(issued.body));
  assert.equal(issued.body.studentId, null);
  assert.equal(issued.body.approvalDate, "2022-12-20");
  assert.equal(issued.body.signerDetails[0]?.signerName, "Presidente Regimento QA");
  assert.equal(issued.body.signerDetails[0]?.signerRole, "PRESIDENT");

  const inline = await fetch(
    `${apiUrl}/official-documents/institutional/${issued.body.id}/file?disposition=inline`,
    { headers: { cookie } },
  );
  assert.equal(inline.status, 200);
  const pdf = Buffer.from(await inline.arrayBuffer());
  const pdfPath = path.join(outDir, "regimento-interno.pdf");
  await writeFile(pdfPath, pdf);

  const info = run("pdfinfo", [pdfPath]);
  assert.match(info, /^Page size:\s+595\.28 x 841\.89 pts \(A4\)$/m);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  assert.ok(pages >= 5 && pages <= 7, "internal regulation should stay close to the legacy page count");

  const text = run("pdftotext", [pdfPath, "-"]);
  for (const fragment of [
    "REGIMENTO INTERNO DA ASSOCIAÇÃO TERRARIQUENSE",
    "TÍTULO I",
    "Art. 1º",
    "ASSEFAR",
    "Art. 43º",
    "Terra Rica, 20 de dezembro de 2022",
    "Presidente Regimento QA",
    issued.body.protocol,
  ]) {
    assert.ok(text.includes(fragment), `PDF text must include ${fragment}`);
  }
  assert.equal(text.includes("ATRTU"), false, "approved typo ATRTU must be corrected to ATRETU");

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const pageText = run("pdftotext", [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      "-",
    ])
      .replace(/\s+/g, " ")
      .trim();
    assert.match(
      pageText,
      /REGIMENTO|Art\.|Presidente Regimento QA/i,
      `page ${pageNumber} must not be empty or chrome-only`,
    );
    run("pdftoppm", [
      "-png",
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      path.join(outDir, `regimento-pagina-${String(pageNumber).padStart(2, "0")}`),
    ]);
  }

  const reissued = await api(
    `/official-documents/institutional/${issued.body.id}/reissue`,
    { headers: json(cookie), method: "POST" },
  );
  assert.equal(reissued.response.status, 201, JSON.stringify(reissued.body));
  assert.equal(reissued.body.sourceIssueId, issued.body.id);
  assert.equal(reissued.body.signerDetails[0]?.signerName, "Presidente Regimento QA");

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const authCookie = parseCookie(cookie);
  await context.addCookies([
    { ...authCookie, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  await page.goto(`${webUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByRole("button", { exact: true, name: /Documentos Oficiais/ }).click();
  await page.getByRole("heading", { exact: true, name: "Documentos Oficiais" }).waitFor();
  await page.getByRole("heading", { exact: true, name: "Regimento Interno da ATRETU" }).waitFor();
  const regulationCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Regimento Interno da ATRETU" }) });
  await regulationCard.getByText("Presidente Regimento QA").first().waitFor();
  await regulationCard.getByRole("button", { exact: true, name: "Emitir" }).click();
  await page.getByRole("heading", { exact: true, name: "Emitir Regimento Interno" }).waitFor();
  await page.getByLabel("Data de aprovação").waitFor();
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();
  await page.screenshot({
    fullPage: true,
    path: path.join(outDir, "documentos-oficiais-institucionais.png"),
  });
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth <= document.body.clientWidth + 1,
    document:
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  }));
  assert.deepEqual(overflow, { body: true, document: true });

  await cleanup();
  const residue = {
    users: await prisma.user.count({ where: { id: { in: ids.users } } }),
    people: await prisma.person.count({ where: { id: { in: ids.people } } }),
    students: await prisma.student.count({ where: { id: { in: ids.students } } }),
    boardMemberships: await prisma.boardMembership.count({
      where: { id: { in: ids.boardMemberships } },
    }),
    officialDocumentIssues: await prisma.officialDocumentIssue.count({
      where: { id: { in: [issued.body.id, reissued.body.id] } },
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
    boardMemberships: 0,
    officialDocumentIssues: 0,
    administrativeAudit: 0,
    securityAudit: 0,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outDir,
        pages,
        pdfPath,
        screenshot: path.join(outDir, "documentos-oficiais-institucionais.png"),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
}
