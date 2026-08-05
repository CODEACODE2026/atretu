import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";
import { expect, test } from "@playwright/test";

const API_URL = process.env.REAL_API_URL ?? "http://localhost:3333";
const WEB_URL = process.env.REAL_WEB_URL ?? "http://127.0.0.1:3000";
const runId = `sprint10-t61-${Date.now()}`;
const screenshotDir = "/tmp/atretu-sprint10-t61-screenshots";
const emailDomain = "@atretu.local";
const passwords = {
  admin: `Admin#${runId}A1`,
  blocked: `Blocked#${runId}B1`,
  firstAccessNew: `FirstAccess#${runId}C1`,
  gestor: `Gestor#${runId}G1`,
  secretary: `Secretary#${runId}S1`,
  voluntaryNew: `Voluntary#${runId}V1`,
};

const fixtures = {
  admin: {
    email: `${runId}-admin${emailDomain}`,
    id: randomUUID(),
    name: "QA T6.1 Super Admin",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  },
  blocked: {
    email: `${runId}-blocked${emailDomain}`,
    id: randomUUID(),
    name: "QA T6.1 Bloqueado",
    role: "SECRETARIA",
    status: "INACTIVE",
  },
  gestor: {
    email: `${runId}-gestor${emailDomain}`,
    id: randomUUID(),
    name: "QA T6.1 Gestor",
    role: "GESTOR",
    status: "ACTIVE",
  },
  secretary: {
    email: `${runId}-secretaria${emailDomain}`,
    id: randomUUID(),
    name: "QA T6.1 Secretaria",
    role: "SECRETARIA",
    status: "ACTIVE",
  },
};

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let db;
let institutions = [];
let createdUser = null;
let createdTemporaryPassword = "";
let resetTemporaryPassword = "";
const consoleMessages = [];

test.beforeAll(async () => {
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await cleanupTemporaryData();
  mkdirSync(screenshotDir, { recursive: true });
  institutions = await activeInstitutions();
  expect(institutions.length).toBeGreaterThanOrEqual(2);
  await seedFixtureUsers();
});

test.afterAll(async () => {
  if (!db) {
    return;
  }
  await cleanupTemporaryData();
  await db.end();
});

test("real login permissions and menu visibility", async ({ browser }) => {
  const adminPage = await login(browser, fixtures.admin.email, passwords.admin);
  await navigateToUsers(adminPage, 1440);
  await expect(adminPage.getByRole("heading", { exact: true, name: "Usuários" })).toBeVisible();
  await adminPage.close();

  const secretaryPage = await login(
    browser,
    fixtures.secretary.email,
    passwords.secretary,
  );
  await expect(secretaryPage.getByText("Usuários").first()).toBeHidden();
  const secretaryAdminUsers = await secretaryPage
    .context()
    .request.get(`${API_URL}/admin/users`);
  expect(secretaryAdminUsers.status()).toBe(403);
  await secretaryPage.close();

  const gestorPage = await login(browser, fixtures.gestor.email, passwords.gestor);
  await expect(gestorPage.getByText("Usuários").first()).toBeHidden();
  const gestorAdminUsers = await gestorPage
    .context()
    .request.get(`${API_URL}/admin/users`);
  expect(gestorAdminUsers.status()).toBe(403);
  await gestorPage.close();

  const blockedPage = await browser.newPage();
  await blockedPage.goto(`${WEB_URL}/login`);
  await blockedPage.getByLabel("E-mail").fill(fixtures.blocked.email);
  await blockedPage.getByLabel("Senha").fill(passwords.blocked);
  const [blockedLoginResponse] = await Promise.all([
    blockedPage.waitForResponse((response) =>
      response.url().endsWith("/auth/login"),
    ),
    blockedPage.getByRole("button", { name: "Entrar" }).click(),
  ]);
  expect(blockedLoginResponse.status()).toBe(401);
  await blockedPage.close();
});

test("real listing, filters, ordering and responsive screenshots", async ({ browser }) => {
  const page = await login(browser, fixtures.admin.email, passwords.admin);
  await navigateToUsers(page, 1440);

  await assertSummaryMatchesApi(page);
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/real-list-desktop.png`,
  });

  await page.getByPlaceholder("Nome ou e-mail").fill(runId);
  await page.getByRole("button", { name: "Buscar" }).click();
  const apiList = await apiJson(page, `/admin/users?search=${runId}&limit=10&sort=name&order=asc`);
  await expect(page.locator("tbody tr")).toHaveCount(apiList.data.length);
  const renderedNames = await page.locator("tbody tr td:first-child p:first-child").allTextContents();
  expect(renderedNames).toEqual(apiList.data.map((user) => user.name));

  await page.getByLabel("Perfil").selectOption("SECRETARIA");
  const roleList = await apiJson(
    page,
    `/admin/users?search=${runId}&role=SECRETARIA&limit=10&sort=name&order=asc`,
  );
  await expect(page.getByText(`${roleList.pagination.total} usuário`).first()).toBeVisible();

  await page.getByLabel("Status").selectOption("INACTIVE");
  const statusList = await apiJson(
    page,
    `/admin/users?search=${runId}&role=SECRETARIA&status=INACTIVE&limit=10&sort=name&order=asc`,
  );
  await expect(page.getByText(`${statusList.pagination.total} usuário`).first()).toBeVisible();

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.setViewportSize({ height: 1000, width: 1180 });
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/real-list-notebook.png`,
  });
  await page.setViewportSize({ height: 1180, width: 820 });
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/real-list-tablet.png`,
  });
  await page.setViewportSize({ height: 1180, width: 390 });
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/real-list-mobile.png`,
  });
  await page.close();
});

test("real create, edit, institutions, block, reset and first access", async ({ browser }) => {
  const page = await login(browser, fixtures.admin.email, passwords.admin);
  await page.on("console", (message) => consoleMessages.push(message.text()));
  await navigateToUsers(page, 1440);

  await page.getByRole("button", { name: "Novo usuário" }).click();
  let dialog = page.getByRole("dialog").filter({ hasText: "Novo usuário" });
  await dialog.screenshot({
    path: `${screenshotDir}/real-new-user-dialog.png`,
  });
  await dialog.getByLabel("Nome").fill("QA T6.1 Criado");
  await dialog.getByLabel("Email").fill(`${runId}-created${emailDomain}`);
  await dialog.getByLabel("Perfil").selectOption("SECRETARIA");
  await dialog.getByLabel(institutions[0].name).check();
  await dialog.getByRole("button", { name: "Salvar" }).click();

  const passwordDialog = page.getByRole("dialog").filter({ hasText: "Senha temporária" });
  await expect(passwordDialog.getByText("Esta senha será exibida apenas uma vez.")).toBeVisible();
  createdTemporaryPassword = (await passwordDialog.locator(".font-mono").innerText()).trim();
  expect(createdTemporaryPassword.length).toBeGreaterThanOrEqual(12);
  await passwordDialog.screenshot({
    path: `${screenshotDir}/real-temporary-password.png`,
  });
  await passwordDialog.getByRole("button", { name: "Copiar" }).click();
  await passwordDialog.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText(createdTemporaryPassword)).toBeHidden();

  createdUser = await waitForUserByEmail(page, `${runId}-created${emailDomain}`);
  await expect(page.getByText("QA T6.1 Criado").first()).toBeVisible();

  await page.getByLabel("Editar QA T6.1 Criado").first().click();
  dialog = page.getByRole("dialog").filter({ hasText: "Editar usuário" });
  await dialog.screenshot({
    path: `${screenshotDir}/real-edit-dialog.png`,
  });
  await dialog.getByLabel("Nome").fill("QA T6.1 Criado Editado");
  await dialog.getByLabel("Email").fill(`${runId}-created-editado${emailDomain}`);
  await dialog.getByLabel("Perfil").selectOption("SUPER_ADMIN");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.roles).toContain("SUPER_ADMIN");

  await page.getByLabel("Editar QA T6.1 Criado Editado").first().click();
  dialog = page.getByRole("dialog").filter({ hasText: "Editar usuário" });
  await dialog.getByLabel("Perfil").selectOption("SECRETARIA");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.roles).toContain("SECRETARIA");

  await setInstitutions(page, []);
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.institutionIds).toEqual([]);

  await setInstitutions(page, [institutions[0].name]);
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.institutionIds).toHaveLength(1);

  await setInstitutions(page, [institutions[0].name, institutions[1].name]);
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDir}/real-institutions.png`,
  });
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.institutionIds).toHaveLength(2);

  const firstAccessPage = await login(
    browser,
    `${runId}-created-editado${emailDomain}`,
    createdTemporaryPassword,
    /\/first-access$/,
  );
  const dashboardBlocked = await firstAccessPage
    .context()
    .request.get(`${API_URL}/dashboard/overview`);
  expect(dashboardBlocked.status()).toBe(403);
  const accountResponse = await firstAccessPage.context().request.get(`${API_URL}/account`);
  expect(accountResponse.status()).toBe(200);
  await firstAccessPage.screenshot({
    fullPage: true,
    path: `${screenshotDir}/real-first-access.png`,
  });
  const changeResponse = await firstAccessPage.context().request.patch(`${API_URL}/account/password`, {
    data: {
      confirmPassword: passwords.firstAccessNew,
      currentPassword: createdTemporaryPassword,
      newPassword: passwords.firstAccessNew,
    },
    headers: { Origin: WEB_URL },
  });
  expect(changeResponse.status(), await changeResponse.text()).toBe(200);
  const oldCookieResponse = await firstAccessPage.context().request.get(`${API_URL}/auth/me`);
  expect(oldCookieResponse.status()).toBe(401);
  await firstAccessPage.close();

  const userSession = await login(
    browser,
    `${runId}-created-editado${emailDomain}`,
    passwords.firstAccessNew,
  );
  await expect(userSession.getByText("Usuários").first()).toBeHidden();

  await navigateToUsers(page, 1440);
  await page.getByLabel("Bloquear QA T6.1 Criado Editado").first().click();
  const blockDialog = page.getByRole("dialog").filter({ hasText: "Bloquear usuário" });
  await blockDialog.screenshot({
    path: `${screenshotDir}/real-block-dialog.png`,
  });
  await blockDialog.getByRole("button", { exact: true, name: "Bloquear" }).click();
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.status).toBe("INACTIVE");
  const blockedOldSession = await userSession.context().request.get(`${API_URL}/auth/me`);
  expect([401, 403]).toContain(blockedOldSession.status());
  await userSession.close();

  const blockedLoginPage = await browser.newPage();
  await blockedLoginPage.goto(`${WEB_URL}/login`);
  await blockedLoginPage.getByLabel("E-mail").fill(`${runId}-created-editado${emailDomain}`);
  await blockedLoginPage.getByLabel("Senha").fill(passwords.firstAccessNew);
  const [createdBlockedLoginResponse] = await Promise.all([
    blockedLoginPage.waitForResponse((response) =>
      response.url().endsWith("/auth/login"),
    ),
    blockedLoginPage.getByRole("button", { name: "Entrar" }).click(),
  ]);
  expect(createdBlockedLoginResponse.status()).toBe(401);
  await blockedLoginPage.close();

  await page.getByLabel("Desbloquear QA T6.1 Criado Editado").first().click();
  await page.getByRole("button", { exact: true, name: "Desbloquear" }).click();
  createdUser = await waitForUserByEmail(page, `${runId}-created-editado${emailDomain}`);
  expect(createdUser.status).toBe("ACTIVE");
  expect(createdUser.mustChangePassword).toBe(false);

  await page
    .getByLabel("Gerar nova senha temporária para QA T6.1 Criado Editado")
    .first()
    .click();
  await page.getByRole("button", { exact: true, name: "Gerar senha" }).click();
  const resetDialog = page.getByRole("dialog").filter({ hasText: "Senha temporária" });
  resetTemporaryPassword = (await resetDialog.locator(".font-mono").innerText()).trim();
  expect(resetTemporaryPassword).not.toBe(createdTemporaryPassword);
  await resetDialog.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText(resetTemporaryPassword)).toBeHidden();

  const oldPasswordPage = await browser.newPage();
  await oldPasswordPage.goto(`${WEB_URL}/login`);
  await oldPasswordPage.getByLabel("E-mail").fill(`${runId}-created-editado${emailDomain}`);
  await oldPasswordPage.getByLabel("Senha").fill(passwords.firstAccessNew);
  const [oldPasswordLoginResponse] = await Promise.all([
    oldPasswordPage.waitForResponse((response) =>
      response.url().endsWith("/auth/login"),
    ),
    oldPasswordPage.getByRole("button", { name: "Entrar" }).click(),
  ]);
  expect(oldPasswordLoginResponse.status()).toBe(401);
  await oldPasswordPage.close();

  const resetLoginPage = await login(
    browser,
    `${runId}-created-editado${emailDomain}`,
    resetTemporaryPassword,
    /\/first-access$/,
  );
  const resetDashboardBlocked = await resetLoginPage
    .context()
    .request.get(`${API_URL}/dashboard/overview`);
  expect(resetDashboardBlocked.status()).toBe(403);
  await resetLoginPage.close();

  await assertFrontendDidNotKeepSecrets(page, [
    createdTemporaryPassword,
    resetTemporaryPassword,
    passwords.firstAccessNew,
    passwords.voluntaryNew,
  ]);
  await page.close();
});

test("real voluntary password change and audit presence", async ({ browser }) => {
  const accountPage = await login(
    browser,
    fixtures.secretary.email,
    passwords.secretary,
  );
  const response = await accountPage.context().request.patch(`${API_URL}/account/password`, {
    data: {
      confirmPassword: passwords.voluntaryNew,
      currentPassword: passwords.secretary,
      newPassword: passwords.voluntaryNew,
    },
    headers: { Origin: WEB_URL },
  });
  expect(response.status()).toBe(200);
  const oldCookieResponse = await accountPage.context().request.get(`${API_URL}/auth/me`);
  expect(oldCookieResponse.status()).toBe(401);
  await accountPage.close();

  const loginPage = await login(browser, fixtures.secretary.email, passwords.voluntaryNew);
  await expect(loginPage.getByText("Usuários").first()).toBeHidden();
  await loginPage.close();

  const audit = await auditSummary();
  expect(audit.adminEvents).toEqual(
    expect.arrayContaining([
      "USER_CREATED",
      "USER_UPDATED",
      "USER_ROLE_CHANGED",
      "USER_INSTITUTIONS_CHANGED",
      "USER_BLOCKED",
      "USER_UNBLOCKED",
      "USER_PASSWORD_RESET",
      "USER_FIRST_ACCESS_PASSWORD_CHANGED",
      "USER_PASSWORD_CHANGED",
    ]),
  );
  expect(audit.sensitiveHits).toEqual([]);
});

async function login(browser, email, password, expectedUrl = /\/admin/) {
  const page = await browser.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(expectedUrl);
  return page;
}

async function navigateToUsers(page, width) {
  await page.setViewportSize({ height: 1100, width });
  await page.goto(`${WEB_URL}/admin`);
  if (width < 768) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Usuários/ })
      .click();
  } else if (width < 1024) {
    await page.getByTitle("Usuários").click();
  } else {
    await page.getByRole("button", { name: /Usuários/ }).click();
  }
  await expect(page.getByRole("heading", { exact: true, name: "Usuários" })).toBeVisible();
}

async function apiJson(page, path) {
  const response = await page.context().request.get(`${API_URL}${path}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function waitForUserByEmail(page, email) {
  await expect.poll(async () => {
    const response = await page.context().request.get(
      `${API_URL}/admin/users?search=${encodeURIComponent(email)}&limit=10`,
    );
    if (!response.ok()) {
      return null;
    }
    const body = await response.json();
    return body.data.find((user) => user.email === email) ?? null;
  }).not.toBeNull();
  const body = await apiJson(
    page,
    `/admin/users?search=${encodeURIComponent(email)}&limit=10`,
  );
  return body.data.find((user) => user.email === email);
}

async function setInstitutions(page, labels) {
  await page
    .getByLabel("Editar instituições de QA T6.1 Criado Editado")
    .first()
    .click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Instituições" });
  await dialog.screenshot({
    path: `${screenshotDir}/real-institutions-${labels.length}.png`,
  });
  for (const institution of institutions.slice(0, 2)) {
    const checkbox = dialog.getByLabel(institution.name);
    const shouldCheck = labels.includes(institution.name);
    if (shouldCheck) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
  await dialog.getByRole("button", { name: "Salvar" }).click();
}

async function assertSummaryMatchesApi(page) {
  const [active, inactive, superAdmin, secretaria] = await Promise.all([
    apiJson(page, "/admin/users?limit=1&status=ACTIVE"),
    apiJson(page, "/admin/users?limit=1&status=INACTIVE"),
    apiJson(page, "/admin/users?limit=1&role=SUPER_ADMIN"),
    apiJson(page, "/admin/users?limit=1&role=SECRETARIA"),
  ]);
  const summaryCards = page
    .locator("section")
    .filter({ hasText: "Contas liberadas para autenticação." })
    .locator("article");
  await expect(summaryCards.nth(0)).toContainText(String(active.pagination.total));
  await expect(summaryCards.nth(1)).toContainText(String(inactive.pagination.total));
  await expect(summaryCards.nth(2)).toContainText(String(superAdmin.pagination.total));
  await expect(summaryCards.nth(3)).toContainText(String(secretaria.pagination.total));
}

async function assertFrontendDidNotKeepSecrets(page, secrets) {
  const storage = await page.evaluate(() => ({
    body: document.body.innerText,
    localStorage: JSON.stringify(window.localStorage),
    sessionStorage: JSON.stringify(window.sessionStorage),
  }));
  const combined = `${storage.body}\n${storage.localStorage}\n${storage.sessionStorage}`;
  for (const secret of secrets.filter(Boolean)) {
    expect(combined.includes(secret)).toBe(false);
  }
  for (const message of consoleMessages) {
    for (const secret of secrets.filter(Boolean)) {
      expect(message.includes(secret)).toBe(false);
    }
  }
}

async function activeInstitutions() {
  const result = await db.query(
    `select id, name from institutions where status = 'ACTIVE' order by name limit 3`,
  );
  return result.rows;
}

async function seedFixtureUsers() {
  const roleIds = await db.query(`select id, code from roles`);
  const roles = new Map(roleIds.rows.map((row) => [row.code, row.id]));
  for (const fixture of Object.values(fixtures)) {
    const password = passwords[
      fixture.role === "SUPER_ADMIN"
        ? "admin"
        : fixture.role === "GESTOR"
          ? "gestor"
          : fixture.status === "INACTIVE"
            ? "blocked"
            : "secretary"
    ];
    await db.query(
      `insert into users
        (id, name, email, password_hash, status, must_change_password, password_changed_at, blocked_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, false, now(), $6, now(), now())`,
      [
        fixture.id,
        fixture.name,
        fixture.email,
        await bcrypt.hash(password, 8),
        fixture.status,
        fixture.status === "INACTIVE" ? new Date() : null,
      ],
    );
    await db.query(
      `insert into user_roles (user_id, role_id) values ($1, $2)`,
      [fixture.id, roles.get(fixture.role)],
    );
    if (institutions[0]) {
      await db.query(
        `insert into user_institutions (user_id, institution_id) values ($1, $2)`,
        [fixture.id, institutions[0].id],
      );
    }
  }
}

async function cleanupTemporaryData() {
  const users = await db.query(
    `select id, email from users where email like $1`,
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
         or user_id = any($2::uuid[])
         or metadata::text like $3`,
    [`${runId}%${emailDomain}`, ids, `%${runId}%`],
  );
  await db.query(`delete from users where id = any($1::uuid[])`, [ids]);
}

async function auditSummary() {
  const ids = [
    fixtures.admin.id,
    fixtures.blocked.id,
    fixtures.gestor.id,
    fixtures.secretary.id,
    createdUser?.id,
  ].filter(Boolean);
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
    createdTemporaryPassword,
    resetTemporaryPassword,
    passwords.admin,
    passwords.blocked,
    passwords.firstAccessNew,
    passwords.gestor,
    passwords.secretary,
    passwords.voluntaryNew,
    "Bearer",
    "atretu_session",
  ].filter(Boolean);
  const serialized = JSON.stringify({
    adminAudit: adminAudit.rows,
    securityAudit: securityAudit.rows,
  });
  return {
    adminEvents: adminAudit.rows.map((row) => row.event_type),
    securityEvents: securityAudit.rows.map((row) => row.event_type),
    sensitiveHits: sensitiveValues.filter((value) => serialized.includes(value)),
  };
}
