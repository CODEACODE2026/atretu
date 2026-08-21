import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/app/admin/permission-profiles-panel.tsx", "utf8");
const labels = readFileSync("src/app/admin/permission-labels.ts", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");
const navigation = readFileSync("src/app/admin/admin-navigation.ts", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const usersPanel = readFileSync("src/app/admin/users-panel.tsx", "utf8");

assert.match(navigation, /key: "permission-profiles"/);
assert.match(navigation, /restricted: true/);
assert.match(shell, /<PermissionProfilesPanel \/>/);
assert.match(shell, /canAccessArea/);
assert.match(shell, /router\.replace\(adminAreaHref\(fallbackArea\)\)/);
assert.match(api, /\/admin\/permission-profiles\/catalog/);
assert.match(api, /\/admin\/permission-profiles/);
assert.match(usersPanel, /api\.listPermissionProfiles\(\)/);
assert.match(api, /\/admin\/users\/permission-profiles/);
assert.match(panel, /Selecionar módulo/);
assert.match(panel, /Limpar módulo/);
assert.match(panel, /resolvePermissionDependencies/);
assert.match(panel, /selectedDependents/);
assert.match(panel, /é obrigatória porque/);
assert.match(panel, /Atualizado em/);
assert.match(panel, /usersCount/);
assert.match(api, /dependencies: PermissionKey\[\]/);
assert.match(labels, /students\.changeStatus/);
assert.match(labels, /Alterar situação do acadêmico/);
assert.doesNotMatch(labels, /legacyImport\.access|jobs\.access|sicredi\.technical/);
assert.match(labels, /HIDDEN_PERMISSION_MODULES/);

console.log("Permission profiles panel guard OK");
