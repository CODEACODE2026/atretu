import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";
import { expect, test } from "@playwright/test";

const API_URL = process.env.REAL_API_URL ?? "http://localhost:3333";
const WEB_URL = process.env.REAL_WEB_URL ?? "http://localhost:3000";
const runId = `sprint10-t7-${Date.now()}`;
const emailDomain = "@atretu.local";
const screenshotDir = "/tmp/atretu-sprint10-t7-screenshots";
const passwords = {
  admin: `AdminT7#${runId}A1`,
  blocked: `BlockedT7#${runId}B1`,
  firstAccess: `TempT7#${runId}F1`,
  firstAccessNew: `FirstT7#${runId}N1`,
  gestor: `GestorT7#${runId}G1`,
  secretary: `SecretaryT7#${runId}S1`,
  voluntaryNew: `VoluntaryT7#${runId}V1`,
};

const fixtures = {
  admin: userFixture("admin", "QA T7 Super Admin", "SUPER_ADMIN", "ACTIVE", false),
  blocked: userFixture("blocked", "QA T7 Bloqueado", "SECRETARIA", "INACTIVE", false),
  firstAccess: userFixture("first-access", "QA T7 Primeiro Acesso", "SECRETARIA", "ACTIVE", true),
  gestor: userFixture("gestor", "QA T7 Gestor", "GESTOR", "ACTIVE", false),
  secretary: userFixture("secretaria", "QA T7 Secretaria", "SECRETARIA", "ACTIVE", false),
};

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let db;
let institution = null;
const consoleMessages = [];

test.beforeAll(async () => {
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  mkdirSync(screenshotDir, { recursive: true });
  await cleanupTemporaryData();
  institution = await activeInstitution();
  expect(institution).toBeTruthy();
  await seedFixtureUsers();
});

test.afterAll(async () => {
  if (!db) {
    return;
  }
  await cleanupTemporaryData();
  await db.end();
});

test("real first access redirects, blocks navigation and clears old cookie", async ({ browser }) => {
  const page = await login(browser, fixtures.firstAccess.email, passwords.firstAccess);
  await expect(page).toHaveURL(/\/first-access$/);
  await expect(page.getByRole("heading", { name: "Troque sua senha temporaria" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/first-access-desktop.png`,
  });

  await page.goto(`${WEB_URL}/admin`);
  await expect(page).toHaveURL(/\/first-access$/);
  const dashboard = await page.context().request.get(`${API_URL}/dashboard/overview`);
  expect(dashboard.status()).toBe(403);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/first-access-mobile.png`,
  });
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.locator("#first-access-current-password").fill(passwords.firstAccess);
  await page.locator("#first-access-new-password").fill(passwords.firstAccessNew);
  await page.locator("#first-access-confirm-password").fill(passwords.firstAccessNew);
  await page.getByRole("button", { name: "Concluir primeiro acesso" }).click();
  await expect(page.getByText("Senha alterada. Entre novamente com sua nova senha.")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/first-access-success.png`,
  });
  await expect(page).toHaveURL(/\/login$/);
  const oldCookieResponse = await page.context().request.get(`${API_URL}/auth/me`);
  expect(oldCookieResponse.status()).toBe(401);
  await assertNoSecretInPage(page, [
    passwords.firstAccess,
    passwords.firstAccessNew,
    "Bearer",
    "atretu_session",
  ]);
  await page.close();

  const normalSession = await login(browser, fixtures.firstAccess.email, passwords.firstAccessNew);
  await expect(normalSession).toHaveURL(/\/admin$/);
  await normalSession.close();
});

test("real account page edits name, cancels edits and changes voluntary password", async ({ browser }) => {
  const page = await login(browser, fixtures.secretary.email, passwords.secretary);
  await openAccount(page);
  await expect(page.getByRole("heading", { name: "Minha Conta" })).toBeVisible();
  await expect(page.getByText(fixtures.secretary.email)).toBeVisible();

  for (const viewport of [
    ["desktop", 1366, 900],
    ["notebook", 1024, 768],
    ["tablet", 768, 900],
    ["mobile", 390, 844],
  ]) {
    const [label, width, height] = viewport;
    await page.setViewportSize({ width, height });
    await page.screenshot({
      fullPage: true,
      path: `${screenshotDir}/account-${label}.png`,
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width + 1);
  }
  await page.setViewportSize({ width: 1366, height: 900 });

  const nameInput = page.getByLabel("Nome");
  await nameInput.fill("QA T7 Secretaria Temporaria");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(nameInput).toHaveValue(fixtures.secretary.name);

  await nameInput.fill("QA T7 Secretaria Editada");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Nome atualizado.")).toBeVisible();
  const accountResponse = await page.context().request.get(`${API_URL}/account`);
  expect(accountResponse.status()).toBe(200);
  const account = await accountResponse.json();
  expect(account.user.name).toBe("QA T7 Secretaria Editada");

  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(page.getByRole("dialog", { name: "Alterar senha" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/change-password-dialog.png`,
  });
  await page.locator("#current-password").fill(passwords.secretary);
  await page.locator("#new-password").fill("fraca");
  await expect(page.getByText("12 caracteres")).toBeVisible();
  await page.locator("#new-password").fill(passwords.voluntaryNew);
  await page.locator("#confirm-password").fill(`${passwords.voluntaryNew}x`);
  await expect(page.getByText("A confirmacao precisa ser igual a nova senha.")).toBeVisible();
  await page.locator("#confirm-password").fill(passwords.voluntaryNew);
  await page
    .getByRole("dialog", { name: "Alterar senha" })
    .getByRole("button", { name: "Alterar senha" })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Senha alterada. Entre novamente com sua nova senha.")).toBeVisible();
  await assertNoSecretInPage(page, [
    passwords.secretary,
    passwords.voluntaryNew,
    "Bearer",
    "atretu_session",
  ]);
  await page.close();

  const newLogin = await login(browser, fixtures.secretary.email, passwords.voluntaryNew);
  await expect(newLogin).toHaveURL(/\/admin$/);
  await newLogin.close();
});

test("real role and blocked-user navigation states", async ({ browser }) => {
  const admin = await login(browser, fixtures.admin.email, passwords.admin);
  await openAccount(admin);
  await expect(admin.getByText("SUPER_ADMIN")).toBeVisible();
  await admin.close();

  const gestor = await login(browser, fixtures.gestor.email, passwords.gestor);
  await expect(gestor).toHaveURL(/\/admin$/);
  await expect(gestor.getByRole("heading", { name: "Minha Conta" })).toBeVisible();
  await expect(gestor.getByText("Minha Conta permanece disponivel")).toBeVisible();
  await expect(gestor.getByText("Dashboard").first()).toBeHidden();
  await gestor.screenshot({
    fullPage: true,
    path: `${screenshotDir}/gestor-restricted-account.png`,
  });
  await gestor.close();

  const blocked = await browser.newPage({ baseURL: WEB_URL });
  await blocked.goto("/login");
  await blocked.getByLabel("E-mail").fill(fixtures.blocked.email);
  await blocked.getByLabel("Senha").fill(passwords.blocked);
  const blockedLogin = await Promise.all([
    blocked.waitForResponse((response) => response.url().includes("/auth/login")),
    blocked.getByRole("button", { name: "Entrar" }).click(),
  ]).then(([response]) => response);
  expect(blockedLogin.status()).toBe(401);
  await expect(blocked.getByText("Credenciais invalidas ou acesso indisponivel.")).toBeVisible();
  await blocked.close();
});

test("real audit and cleanup safety checks", async ({ browser }) => {
  const page = await login(browser, fixtures.admin.email, passwords.admin);
  await page.close();

  const audit = await auditSummary();
  expect(audit.adminEvents).toEqual(
    expect.arrayContaining([
      "USER_FIRST_ACCESS_PASSWORD_CHANGED",
      "USER_PASSWORD_CHANGED",
      "USER_UPDATED",
    ]),
  );
  expect(audit.sensitiveHits).toEqual([]);
});

function userFixture(key, name, role, status, mustChangePassword) {
  return {
    email: `${runId}-${key}${emailDomain}`,
    id: randomUUID(),
    mustChangePassword,
    name,
    role,
    status,
  };
}

async function login(browser, email, password) {
  const page = await browser.newPage({ baseURL: WEB_URL });
  page.on("console", (message) => consoleMessages.push(message.text()));
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|first-access)$/);
  return page;
}

async function openAccount(page) {
  const accountButton = page.getByRole("button", { name: "Minha Conta" }).first();
  await accountButton.click();
}

async function assertNoSecretInPage(page, secrets) {
  const storage = await page.evaluate(() => ({
    body: document.body.innerText,
    href: window.location.href,
    localStorage: JSON.stringify(window.localStorage),
    sessionStorage: JSON.stringify(window.sessionStorage),
  }));
  const combined = Object.values(storage).join("\n");
  for (const secret of secrets.filter(Boolean)) {
    expect(combined.includes(secret)).toBe(false);
  }
  for (const message of consoleMessages) {
    for (const secret of secrets.filter(Boolean)) {
      expect(message.includes(secret)).toBe(false);
    }
  }
}

async function activeInstitution() {
  const response = await db.query(
    `select id, name from institutions where status = 'ACTIVE' order by created_at asc limit 1`,
  );
  return response.rows[0] ?? null;
}

async function seedFixtureUsers() {
  const roles = await db.query(`select id, code from roles`);
  const roleIds = new Map(roles.rows.map((role) => [role.code, role.id]));

  for (const fixture of Object.values(fixtures)) {
    const password = passwords[
      fixture === fixtures.admin
        ? "admin"
        : fixture === fixtures.blocked
          ? "blocked"
          : fixture === fixtures.firstAccess
            ? "firstAccess"
            : fixture === fixtures.gestor
              ? "gestor"
              : "secretary"
    ];
    const now = new Date();
    await db.query(
      `insert into users
        (id, name, email, password_hash, status, must_change_password, password_changed_at, blocked_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        fixture.id,
        fixture.name,
        fixture.email,
        await bcrypt.hash(password, 8),
        fixture.status,
        fixture.mustChangePassword,
        now,
        fixture.status === "INACTIVE" ? now : null,
        now,
      ],
    );
    await db.query(
      `insert into user_roles (user_id, role_id) values ($1, $2)`,
      [fixture.id, roleIds.get(fixture.role)],
    );
    if (institution) {
      await db.query(
        `insert into user_institutions (user_id, institution_id) values ($1, $2)`,
        [fixture.id, institution.id],
      );
    }
  }
}

async function cleanupTemporaryData() {
  const users = await db.query(
    `select id from users where email like $1`,
    [`${runId}%${emailDomain}`],
  );
  const ids = users.rows.map((row) => row.id);
  await db.query(
    `delete from administrative_audit_logs
      where metadata::text like $1
         or record_id = any($2::uuid[])
         or user_id = any($2::uuid[])`,
    [`%${runId}%`, ids],
  );
  await db.query(
    `delete from security_audit_logs
      where email like $1
         or metadata::text like $2
         or user_id = any($3::uuid[])`,
    [`${runId}%${emailDomain}`, `%${runId}%`, ids],
  );
  await db.query(`delete from users where id = any($1::uuid[])`, [ids]);
}

async function auditSummary() {
  const ids = Object.values(fixtures).map((fixture) => fixture.id);
  const adminAudit = await db.query(
    `select event_type, metadata::text as metadata
       from administrative_audit_logs
      where metadata::text like $1
         or record_id = any($2::uuid[])
         or user_id = any($2::uuid[])
      order by created_at asc`,
    [`%${runId}%`, ids],
  );
  const securityAudit = await db.query(
    `select event_type, email, metadata::text as metadata
       from security_audit_logs
      where email like $1
         or metadata::text like $2
         or user_id = any($3::uuid[])
      order by created_at asc`,
    [`${runId}%${emailDomain}`, `%${runId}%`, ids],
  );
  const sensitiveValues = [
    ...Object.values(passwords),
    "Bearer",
    "atretu_session",
  ];
  const serialized = JSON.stringify({
    adminAudit: adminAudit.rows,
    securityAudit: securityAudit.rows,
  });
  return {
    adminEvents: adminAudit.rows.map((row) => row.event_type),
    sensitiveHits: sensitiveValues.filter((value) => serialized.includes(value)),
  };
}
