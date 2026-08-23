import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auth = readFileSync("src/lib/auth.ts", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const cardsPanel = readFileSync("src/app/admin/student-cards-panel.tsx", "utf8");
const profileSections = readFileSync(
  "src/app/admin/students/cards/student-card-profile-sections.tsx",
  "utf8",
);
const profile = readFileSync(
  "src/app/admin/students/student-profile-view.tsx",
  "utf8",
);

includesAll(auth, [
  '"studentCards.view"',
  '"studentCards.issue"',
  '"studentCards.invalidate"',
  'area === "student-cards"',
  'return hasCapability(user, "studentCards.view")',
]);

includesAll(shell, [
  'nextArea === "student-cards"',
  "canAccessMigratedArea(user, nextArea)",
  "const effectiveArea = canAccessArea(area) ? area : fallbackArea",
]);

includesAll(cardsPanel, [
  'hasCapability(user, "studentCards.issue")',
  'hasCapability(\n    user,\n    "studentCards.invalidate"',
  "canIssueStudentCards ? (",
  "canInvalidate={canInvalidateStudentCards}",
  "onPreview={pendingRequirement ? () => void handlePreview() : undefined}",
  "Seu perfil nao possui permissao para imprimir em lote.",
  "Seu perfil nao possui permissao para emitir carteirinhas.",
]);
assert.doesNotMatch(
  cardsPanel,
  /const canUseAdministrativeIssue = canAccessOperationalAdmin\(user\);/,
  "StudentCardsPanel must not use the legacy operational gate for issue actions",
);

includesAll(profile, [
  'const canViewStudentCards = hasCapability(user, "studentCards.view")',
  '...(canViewStudentCards ? (["cards"] as const) : [])',
  "if (!canViewStudentCards) {",
]);
includesAll(profileSections, [
  "onPreview?: () => void",
  "Visualizar prévia",
  "onIssue ? (",
]);

console.log("Student cards web permissions OK");

function includesAll(source, values) {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
}
