import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/app/admin/students-panel.tsx", "utf8");
const adminUi = readFileSync("src/app/admin/components/admin-ui.tsx", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");
const auth = readFileSync("src/lib/auth.ts", "utf8");

includesAll(panel, [
  "export function ReenrollmentsPanel()",
  "AdminLargeModal",
  "detailOpen",
  "setDetailOpen(false)",
  "void selectCandidate(candidate)",
  "api.previewReenrollment(candidate.id, academicYearId)",
  "api.reenrollStudent(selected.id",
  'title="Nova rematrícula"',
  'form="reenrollment-detail-form"',
  'id="reenrollment-detail-form"',
  'role="button"',
  "tabIndex={0}",
  "onKeyDown={(event) => event.stopPropagation()}",
  "Abrir",
  "preview.blockingReason",
  "pendingReenrollment",
]);

includesAll(adminUi, [
  "AdminLargeModal",
  'aria-modal="true"',
  'event.key === "Escape"',
  'event.key !== "Tab"',
  'document.body.style.overflow = "hidden"',
  "document.removeEventListener",
  "document.body.style.overflow = previousOverflow",
  "previousActiveElement?.focus()",
  "!dialogRef.current.contains(target)",
  "z-40",
  "z-[60]",
  'aria-label="Fechar modal"',
]);

includesAll(api, [
  "listReenrollmentCandidates",
  "previewReenrollment",
  "reenrollStudent",
]);
includesAll(auth, ['"students.reenroll"']);

for (const forbidden of [
  "xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]",
  "2xl:grid-cols-[minmax(0,1.55fr)_minmax(400px,0.85fr)]",
]) {
  assert.equal(
    panel.includes(forbidden),
    false,
    `reenrollment panel must not keep old split grid ${forbidden}`,
  );
}

console.log("Reenrollment panel guard OK");

function includesAll(source, values) {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
}
