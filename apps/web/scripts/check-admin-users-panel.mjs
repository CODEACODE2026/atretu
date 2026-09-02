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
  "Selecionar todas",
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
  /await api\.updateAdminUser\(dialog\.user\.id, \{[\s\S]*?institutionIds: administratorEditingAdministrator[\s\S]*?\? undefined[\s\S]*?: nextInstitutionIds,[\s\S]*?permissionProfileId:[\s\S]*?form\.role === "USER" \? form\.permissionProfileId : undefined,[\s\S]*?role: currentUserIsAdministrator[\s\S]*?\? roleForAdministratorUpdate\(dialog\.user\.roles\[0\]\)[\s\S]*?: form\.role === "GESTOR"[\s\S]*?\? undefined[\s\S]*?: form\.role,/,
  "Administrator edits must preserve the target role while sending profile and institutions atomically",
);

assert.match(panel, /function canManageUser\(currentUser: ApiUser, user: AdminUser\)/);
assert.match(
  panel,
  /user\.roles\.length === 1 &&[\s\S]*\(user\.roles\.includes\("USER"\) \|\| user\.roles\.includes\("ADMINISTRATOR"\)\)/,
);
assert.match(panel, /function canChangeUserStatus\(currentUser: ApiUser, user: AdminUser\)/);
assert.match(
  panel,
  /function canChangeUserStatus[\s\S]*user\.roles\.includes\("USER"\)/,
);
assert.match(panel, /function canManageUserInstitutions\(currentUser: ApiUser, user: AdminUser\)/);
assert.match(
  panel,
  /function canManageUserInstitutions[\s\S]*user\.roles\.includes\("USER"\)/,
);
assert.match(panel, /administratorEditingAdministrator[\s\S]*\? undefined[\s\S]*: nextInstitutionIds/);
assert.match(panel, /canManageInstitutions \? \([\s\S]*Gerenciar instituições/);
assert.match(panel, /function roleOptionsForDialog\([\s\S]*currentUserIsAdministrator/);
assert.match(panel, /dialog\.mode === "create"[\s\S]*return \["USER"\];/);
assert.match(panel, /return currentRole === "ADMINISTRATOR" \? \["ADMINISTRATOR"\] : \["USER"\];/);
assert.match(panel, /const visibleFilterRoles = currentUserIsAdministrator[\s\S]*FILTER_ROLES\.filter\(\(item\) => item !== "SUPER_ADMIN"\)/);
assert.match(panel, /currentUserIsAdministrator[\s\S]*\? Promise\.resolve\(\{ pagination: \{ total: 0 \} \}\)[\s\S]*: api\.listAdminUsers\(\{ limit: 1, role: "SUPER_ADMIN" \}\)/);
assert.match(panel, /\{currentUserIsAdministrator \? null : \([\s\S]*label="SUPER_ADMIN"/);
assert.match(shell, /<UsersPanel currentUser=\{user\} \/>/);

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
  /<p className="text-sm font-semibold text-slate-950">Acesso<\/p>[\s\S]*?Nível[\s\S]*?Perfil de Permissões \*[\s\S]*?\{administratorEditingAdministrator \? null : institutionPicker\}[\s\S]*?<p className="text-sm font-semibold text-slate-950">Segurança<\/p>/,
  "Role, permission profile, and institutions must stay in Access, with institutions hidden only for Administrator editing Administrator",
);

assert.match(
  panel,
  /function updateAllInstitutions\(checked: boolean\) \{[\s\S]*?institutionIds: checked \? sortedIds\(institutions\.map\(\(institution\) => institution\.id\)\) : \[],[\s\S]*?\}/,
  "Select all must use every available institution, not the filtered search result",
);

assert.match(
  panel,
  /selectAllInstitutionsRef\.current\.indeterminate = someInstitutionsSelected;/,
  "Select all must expose an indeterminate state when only some institutions are selected",
);

assert.match(
  panel,
  /checked=\{allInstitutionsSelected\}[\s\S]*?onChange=\{\(event\) => updateAllInstitutions\(event\.target\.checked\)\}/,
  "Select all checkbox must check all institutions and uncheck back to an empty selection",
);

assert.match(
  panel,
  /onChange=\{\(event\) => onInstitutionSearch\(event\.target\.value\)\}[\s\S]*?Selecionar todas[\s\S]*?filteredInstitutions\.map/,
  "Select all must appear below search and above the filtered institution list",
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
