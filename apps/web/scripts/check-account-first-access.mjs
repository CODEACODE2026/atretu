import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountPanel = readFileSync("src/app/admin/account-panel.tsx", "utf8");
const firstAccess = readFileSync("src/app/first-access/page.tsx", "utf8");
const home = readFileSync("src/app/page.tsx", "utf8");
const login = readFileSync("src/app/login/login-form.tsx", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");

const includesAll = (source, values) => {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
};

includesAll(api, [
  "export type AccountResponse",
  "export type UpdateOwnAccountPayload",
  "export type ChangeOwnPasswordPayload",
  "getAccount",
  "updateAccount",
  "changeOwnPassword",
  "atretu:session-invalid",
]);

includesAll(shell, [
  "AccountPanel",
  "onRequireLogin",
  "canAccessOperationalAdmin",
  "Minha Conta permanece disponivel",
  'area === "account"',
]);

includesAll(login, [
  "mustChangePassword",
  '"/first-access"',
  "atretu_login_notice",
  "Credenciais invalidas ou acesso indisponivel.",
  "Acessar sistema",
  "Mostrar senha",
  "Ocultar senha",
]);

includesAll(home, ["redirect(\"/login\")"]);

for (const [label, source] of [
  ["home", home],
  ["login", login],
]) {
  for (const forbidden of [
    "/pre-cadastro",
    "Pre-cadastro",
    "pre-cadastro",
    "Fazer cadastro",
    "Criar conta",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${label} must not expose ${forbidden}`,
    );
  }
}

includesAll(accountPanel, [
  "AdminModuleHeader",
  "AdminSectionHeader",
  "AdminStatusBadge",
  "AdminFeedback",
  "Alterar senha",
  "8 caracteres",
  "autoComplete",
  "current-password",
  "new-password",
  "Perfis, instituicoes, status e permissoes sao alterados apenas pela",
]);

includesAll(firstAccess, [
  "Troque sua senha temporaria",
  "Concluir primeiro acesso",
  "current-password",
  "new-password",
  "router.replace(\"/login\")",
  "router.replace(\"/admin\")",
]);

for (const [label, source] of [
  ["account panel", accountPanel],
  ["first access", firstAccess],
]) {
  for (const forbidden of [
    "passwordHash",
    "localStorage",
    "document.cookie",
    "Authorization",
    "Bearer",
    "Set-Cookie",
    "window.confirm",
    "window.prompt",
    "window.alert",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${label} must not include ${forbidden}`,
    );
  }
}

console.log("Account and first access guard OK");
