import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/app/admin/users-panel.tsx", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const navigation = readFileSync("src/app/admin/admin-navigation.ts", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");

const includesAll = (source, values) => {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
};

includesAll(navigation, [
  "ADMIN_NAV_GROUPS",
  "groupAdminNavItems",
  'label: "VISÃO GERAL"',
  'label: "ACADÊMICO"',
  'label: "GESTÃO"',
  'label: "ADMINISTRAÇÃO"',
  'group: "administration"',
  '| "users"',
  'key: "users"',
  'label: "Usuários"',
  "restricted: true",
]);

includesAll(shell, ['import { UsersPanel } from "./users-panel";', 'area === "users"']);

includesAll(api, [
  "export type AdminUser",
  "export type ListAdminUsersParams",
  "createAdminUser",
  "updateAdminUser",
  "updateAdminUserInstitutions",
  "blockAdminUser",
  "unblockAdminUser",
  "resetAdminUserPassword",
  "listPermissionProfiles",
  "/admin/users",
  "/admin/users/permission-profiles",
  "/reset-password",
]);

includesAll(panel, [
  "AdminModuleHeader",
  "AdminSummaryCard",
  "AdminSectionHeader",
  "AdminStatusBadge",
  "AdminEmptyState",
  "AdminFeedback",
  "AdminConfirmDialog",
  "Novo usuário",
  "Cargo/Função",
  "Perfil de Permissões",
  "Segurança",
  "Esta senha será exibida apenas uma vez.",
  "Nunca logou",
  "Primeiro acesso pendente",
  "Sem instituição",
  "table-fixed",
  "lg:hidden",
]);

for (const forbidden of [
  "window.confirm",
  "window.prompt",
  "window.alert",
  "api.delete",
  "DELETE",
  "passwordHash",
]) {
  assert.equal(
    panel.includes(forbidden),
    false,
    `Users panel must not include ${forbidden}`,
  );
}

assert.ok(
  panel.includes('form.role === "GESTOR"') &&
    panel.includes("<option value=\"GESTOR\">GESTOR</option>") &&
    !panel.includes('"GESTOR",]'),
  "GESTOR may only appear as a preserved existing value, not as an assignable role",
);
