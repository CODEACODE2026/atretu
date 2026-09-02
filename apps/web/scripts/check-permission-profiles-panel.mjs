import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/app/admin/permission-profiles-panel.tsx", "utf8");
const labels = readFileSync("src/app/admin/permission-labels.ts", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");
const navigation = readFileSync("src/app/admin/admin-navigation.ts", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const usersPanel = readFileSync("src/app/admin/users-panel.tsx", "utf8");

function assertPreset(label, permissionKeys) {
  const start = panel.indexOf(`label: "${label}"`);
  assert.notEqual(start, -1, `Missing financial preset: ${label}`);
  const end = panel.indexOf("},", start);
  assert.notEqual(end, -1, `Missing financial preset end: ${label}`);
  const block = panel.slice(start, end);
  for (const permissionKey of permissionKeys) {
    assert.match(block, new RegExp(`"${permissionKey.replaceAll(".", "\\.")}"`));
  }
  const selectedKeys = [...block.matchAll(/"([a-zA-Z]+(?:\.[a-zA-Z]+)+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    selectedKeys.sort(),
    [...permissionKeys].sort(),
    `Unexpected permissions for financial preset: ${label}`,
  );
}

assert.match(navigation, /key: "permission-profiles"/);
assert.match(navigation, /restricted: true/);
assert.match(shell, /<PermissionProfilesPanel \/>/);
assert.match(shell, /canAccessUserAdministration/);
assert.match(shell, /canAccessArea/);
assert.match(shell, /router\.replace\(adminAreaHref\(fallbackArea\)\)/);
assert.match(api, /\/admin\/permission-profiles\/catalog/);
assert.match(api, /\/admin\/permission-profiles/);
assert.match(usersPanel, /api\.listPermissionProfiles\(\)/);
assert.match(api, /\/admin\/users\/permission-profiles/);
assert.match(panel, /Selecionar módulo/);
assert.match(panel, /Limpar módulo/);
assert.match(panel, /Permissões disponíveis/);
assert.doesNotMatch(panel, /Em breve/);
assert.doesNotMatch(panel, /Esta permissão ainda não está disponível para perfis de usuário/);
assert.doesNotMatch(panel, /comingSoonPermissionCatalog/);
assert.doesNotMatch(panel, /comingSoonGroups/);
assert.match(panel, /resolvePermissionDependencies/);
assert.match(panel, /selectedDependents/);
assert.match(panel, /é obrigatória porque/);
assert.match(panel, /FINANCIAL_PERMISSION_KEYS/);
assert.match(panel, /FINANCIAL_PERMISSION_PRESETS/);
assert.match(panel, /Somente leitura/);
assert.match(panel, /Faturas/);
assert.match(panel, /Cobrança/);
assert.match(panel, /Financeiro completo/);
assert.match(panel, /Limpar/);
assert.match(panel, /module === "finance"/);
assert.match(panel, /onApplyFinancialPreset/);
assert.match(panel, /permissionsOutsideFinance/);
assert.match(panel, /resolvePermissionDependencies\(\s*\[\.\.\.permissionsOutsideFinance, \.\.\.presetPermissions\]/);
assert.match(panel, /finance\.invoices\.view/);
assert.match(panel, /finance\.invoices\.manage/);
assert.match(panel, /finance\.bankSlips\.manage/);
assert.match(panel, /collections\.view/);
assert.match(panel, /collections\.manage/);
assert.match(panel, /manualMovements\.view/);
assert.match(panel, /manualMovements\.manage/);
assertPreset("Somente leitura", [
  "finance.invoices.view",
  "collections.view",
  "manualMovements.view",
]);
assertPreset("Faturas", [
  "finance.invoices.view",
  "finance.invoices.manage",
  "finance.bankSlips.manage",
]);
assertPreset("Cobrança", ["collections.view", "collections.manage"]);
const financialPermissionKeysBlock = panel.slice(
  panel.indexOf("const FINANCIAL_PERMISSION_KEYS"),
  panel.indexOf("const FINANCIAL_PERMISSION_PRESETS"),
);
assert.deepEqual(
  [
    ...financialPermissionKeysBlock.matchAll(
      /"(finance\.invoices\.view|finance\.invoices\.manage|finance\.bankSlips\.manage|collections\.view|collections\.manage|manualMovements\.view|manualMovements\.manage)"/g,
    ),
  ].map((match) => match[1]).sort(),
  [
    "finance.invoices.view",
    "finance.invoices.manage",
    "finance.bankSlips.manage",
    "collections.view",
    "collections.manage",
    "manualMovements.view",
    "manualMovements.manage",
  ].sort(),
);
assert.match(panel, /label: "Financeiro completo"[\s\S]*permissions: FINANCIAL_PERMISSION_KEYS/);
assert.match(panel, /label: "Limpar"[\s\S]*permissions: \[\]/);
assert.doesNotMatch(panel, /presetId|financialAccessType|financeiroAccessType|FinancialAccessType/);
assert.doesNotMatch(api, /presetId|financialAccessType|financeiroAccessType|FinancialAccessType/);
assert.match(panel, /Atualizado em/);
assert.match(panel, /usersCount/);
assert.match(api, /dependencies: PermissionKey\[\]/);
assert.match(labels, /students\.changeStatus/);
assert.match(labels, /Alterar situação do acadêmico/);
assert.doesNotMatch(labels, /legacyImport\.access|jobs\.access|sicredi\.technical/);
assert.match(labels, /HIDDEN_PERMISSION_MODULES/);

console.log("Permission profiles panel guard OK");
