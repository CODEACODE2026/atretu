import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apiSource = readFileSync("src/lib/api.ts", "utf8");
const profileUtilsSource = readFileSync(
  "src/app/admin/students/student-profile-utils.ts",
  "utf8",
);
const legacyPanelSource = readFileSync("src/app/admin/students-panel.tsx", "utf8");
const prismaSchema = readFileSync("../../apps/api/prisma/schema.prisma", "utf8");

const expectedBankSlipLabels = {
  BANK_SLIP_ISSUED: "Boleto emitido",
  BANK_SLIP_PAYMENT_CONFIRMED: "Pagamento confirmado",
  BANK_SLIP_CANCELLATION_REQUESTED: "Cancelamento de boleto solicitado",
  BANK_SLIP_CANCELLED: "Boleto cancelado",
};

const backendHistoryEvents = extractStudentHistoryEvents(prismaSchema);
const apiHistoryEvents = extractStudentHistoryEvents(apiSource);

for (const eventType of backendHistoryEvents) {
  assert.ok(
    apiHistoryEvents.includes(eventType),
    `StudentHistoryEvent API type must include ${eventType}`,
  );
  assertLabel(profileUtilsSource, eventType);
  assertLabel(legacyPanelSource, eventType);
}

for (const [eventType, label] of Object.entries(expectedBankSlipLabels)) {
  assert.equal(
    extractLabel(profileUtilsSource, eventType),
    label,
    `${eventType} must render a friendly title in student profile history`,
  );
  assert.equal(
    extractLabel(legacyPanelSource, eventType),
    label,
    `${eventType} must render a friendly title in legacy student history`,
  );
}

assert.equal(
  backendHistoryEvents.includes("BANK_SLIP_SYNCED"),
  false,
  "BANK_SLIP_SYNCED must remain only in technical audit, not functional history",
);

console.log("Student history labels guard OK");

function extractStudentHistoryEvents(source) {
  const prismaEnum = source.match(/enum StudentHistoryEventType\s+\{([\s\S]*?)\}/);
  if (prismaEnum) {
    return prismaEnum[1]
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const typeUnion = source.match(
    /export type StudentHistoryEvent = \{[\s\S]*?eventType:\s*([\s\S]*?);/,
  );
  assert.ok(typeUnion, "StudentHistoryEvent eventType union must exist");
  return [...typeUnion[1].matchAll(/\|\s*"([^"]+)"/g)].map((match) => match[1]);
}

function assertLabel(source, eventType) {
  const label = extractLabel(source, eventType);
  assert.ok(label, `${eventType} must have a non-empty history label`);
}

function extractLabel(source, eventType) {
  const match = source.match(new RegExp(`${eventType}:\\s*"([^"]+)"`));
  return match?.[1] ?? "";
}
