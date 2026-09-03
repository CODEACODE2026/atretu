import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const navigation = readFileSync("src/app/admin/admin-navigation.ts", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const sidebar = readFileSync("src/app/admin/components/admin-sidebar.tsx", "utf8");
const mobileNavigation = readFileSync(
  "src/app/admin/components/mobile-navigation.tsx",
  "utf8",
);
const auth = readFileSync("src/lib/auth.ts", "utf8");
const panel = readFileSync("src/app/admin/pre-registrations-panel.tsx", "utf8");
const login = readFileSync("src/app/login/login-form.tsx", "utf8");
const home = readFileSync("src/app/page.tsx", "utf8");

includesAll(navigation, [
  "ClipboardCheck",
  'description: "Cadastros recebidos para análise"',
  'group: "academic"',
  'key: "pre-registrations"',
  'label: "Pré-cadastros"',
]);

const academicOrder = [
  'key: "students"',
  'key: "pre-registrations"',
  'key: "reenrollments"',
  'key: "student-cards"',
].map((fragment) => navigation.indexOf(fragment));
assert.deepEqual(
  academicOrder,
  [...academicOrder].sort((left, right) => left - right),
  "academic menu order must be Academicos, Pre-cadastros, Rematriculas, Carteirinhas",
);
assert.ok(
  academicOrder.every((index) => index >= 0),
  "academic menu must include all expected areas",
);

includesAll(shell, [
  "canAccessMigratedArea(user, nextArea)",
  "mergeAccountUserNavigationContext(user, accountUser)",
  "const visibleTabs = ADMIN_NAV_ITEMS.filter((tab) => canAccessArea(tab.key))",
  "const navigationItems = visibleTabs",
  "const effectiveArea = canAccessArea(area) ? area : fallbackArea",
  'activeArea={navigationActiveArea}',
  "items={navigationItems}",
  'nextArea === "pre-registrations"',
  '"pre-registrations": { area: "pre-registrations" }',
  'effectiveArea === "pre-registrations"',
  "PreRegistrationsPanel",
  "user={user}",
]);
includesAll(auth, [
  "user.capabilities?.includes(capability)",
  '"student-cards"',
  '"preRegistrations.view"',
  '"studentCards.view"',
  'user.roles.includes("ADMINISTRATOR")',
  'user.roles.includes("GESTOR")',
]);

includesAll(sidebar, [
  "groupAdminNavItems(items)",
  "title={collapsed ? item.label : undefined}",
  "Navegacao administrativa",
]);
includesAll(mobileNavigation, [
  "groupAdminNavItems(items)",
  "Navegacao administrativa mobile",
  "onNavigate(item.key)",
]);

includesAll(panel, [
  'hasCapability(user, "preRegistrations.review")',
  'hasCapability(',
  '"preRegistrations.documents.view"',
  "AdminLargeModal",
  "detailOpen",
  "setDetailOpen(false)",
  'title="Pré-cadastro"',
  'role="button"',
  "tabIndex={0}",
  "onKeyDown={(event) => event.stopPropagation()}",
  "Abrir",
  "copyPublicPreRegistrationLink",
  'navigator.clipboard.writeText(`${window.location.origin}/pre-cadastro`)',
  "Link copiado",
  "Copiar link de pré-cadastro",
  "DocumentSection",
  "DocumentPreviewModal",
  "closeButtonRef.current?.focus()",
  'event.key === "Escape"',
  "approveSelected",
  "rejectSelected",
]);
assert.equal(
  panel.includes("xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]"),
  false,
  "pre-registration panel must not keep the old split list/detail grid",
);

for (const source of [panel, login, home]) {
  assert.equal(source.includes("window.alert"), false, "window.alert is forbidden");
}
for (const [label, source] of [
  ["login", login],
  ["home", home],
]) {
  for (const forbidden of [
    "/pre-cadastro",
    "Pré-cadastros",
    "Pré-cadastro",
    "pre-cadastro",
  ]) {
    assert.equal(source.includes(forbidden), false, `${label} must not expose ${forbidden}`);
  }
}

includesAll(home, ['redirect("/login")']);

console.log("Pre-registration admin access guard OK");

function includesAll(source, values) {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
}
