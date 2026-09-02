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

includesAll(shell, [
  'import { UsersPanel } from "./users-panel";',
  'effectiveArea === "users"',
]);

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
  "O acesso do usuário é limitado às instituições selecionadas.",
  "Selecione um perfil de permissão.",
  "Selecione pelo menos uma instituição.",
  "Segurança",
  "Esta senha será exibida apenas uma vez.",
  "Nunca logou",
  "Primeiro acesso pendente",
  "Sem instituição",
  "table-fixed",
  "lg:hidden",
]);

assert.match(
  panel,
  /await api\.updateAdminUser\(dialog\.user\.id, \{[\s\S]*?institutionIds: nextInstitutionIds,[\s\S]*?permissionProfileId:[\s\S]*?form\.role === "USER" \? form\.permissionProfileId : undefined,[\s\S]*?role: form\.role === "GESTOR" \? undefined : form\.role,/,
  "Editing a legacy admin into USER must submit role, permission profile, and institutions in one update request",
);

assert.match(
  panel,
  /const userNeedsPermissionProfile =[\s\S]*?form\.role === "USER" && !form\.permissionProfileId;/,
  "USER edit must expose a validation reason while permission profile is missing",
);

assert.match(
  panel,
  /disabled=\{saving \|\| userNeedsPermissionProfile \|\| userNeedsInstitution\}/,
  "Save must enable only after USER has both a permission profile and institution",
);

assert.match(
  panel,
  /<p className="text-sm font-semibold text-slate-950">Acesso<\/p>[\s\S]*?Nível[\s\S]*?Perfil de Permissões \*[\s\S]*?\{institutionPicker\}[\s\S]*?<p className="text-sm font-semibold text-slate-950">Segurança<\/p>/,
  "Role, permission profile, and institutions must appear together in the Access section before Security",
);

assert.equal(
  panel.includes("const currentInstitutionIds = sortedIds(dialog.user.institutionIds);"),
  false,
  "Edit submit must not depend on comparing institutions for a second update request",
);

assert.equal(
  panel.includes("function sameIds("),
  false,
  "Edit submit must send institution IDs atomically instead of keeping a second-request helper",
);

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
