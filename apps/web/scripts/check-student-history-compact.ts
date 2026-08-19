import assert from "node:assert/strict";
import type { StudentHistoryEvent } from "../src/lib/api";
import {
  filterStudentHistoryEvents,
  getVisibleStudentHistoryEvents,
  groupStudentHistoryEventsByMonth,
  historyEventCategory,
  historyEventDescription,
  historyEventDetails,
  STUDENT_HISTORY_PAGE_SIZE,
} from "../src/app/admin/students/student-profile-utils";

const eventTypes: StudentHistoryEvent["eventType"][] = [
  "INVOICE_CREATED",
  "BANK_SLIP_ISSUED",
  "BANK_SLIP_PAYMENT_CONFIRMED",
  "STUDENT_CARD_ISSUED",
  "STUDENT_SUSPENDED",
];

const fakeBus = {
  id: "bus-1",
  name: "Linha Centro",
  status: "ACTIVE",
  capacity: 44,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
} satisfies NonNullable<StudentHistoryEvent["bus"]>;

const events = Array.from({ length: 50 }, (_, index): StudentHistoryEvent => ({
  id: `event-${index}`,
  eventType: eventTypes[index % eventTypes.length],
  occurredAt: new Date(Date.UTC(2026, index < 25 ? 7 : 6, 28 - (index % 25), 15, index % 60)).toISOString(),
  justification: index % 10 === 0 ? "Observacao operacional" : null,
  suspensionReason: index % eventTypes.length === 4 ? "NON_PAYMENT" : null,
  terminationReason: null,
  busSeatReleased: index % eventTypes.length === 4,
  bus: index % eventTypes.length === 4 ? fakeBus : null,
  busAssignment: null,
  boardMembership: null,
}));

assert.equal(STUDENT_HISTORY_PAGE_SIZE, 20);
assert.equal(getVisibleStudentHistoryEvents(events, "all", STUDENT_HISTORY_PAGE_SIZE).length, 20);
assert.equal(getVisibleStudentHistoryEvents(events, "all", 40).length, 40);
assert.equal(filterStudentHistoryEvents(events, "finance").length, 30);
assert.equal(filterStudentHistoryEvents(events, "cards").length, 10);
assert.equal(filterStudentHistoryEvents(events, "academic").length, 10);
assert.equal(historyEventCategory("BANK_SLIP_ISSUED"), "finance");
assert.equal(historyEventCategory("BANK_SLIP_PAYMENT_CONFIRMED"), "finance");
assert.equal(historyEventCategory("STUDENT_CARD_ISSUED"), "cards");
assert.equal(historyEventCategory("STUDENT_SUSPENDED"), "academic");

const grouped = groupStudentHistoryEventsByMonth(events);
assert.equal(grouped.length, 2);
assert.deepEqual(
  grouped.map((group) => group.label),
  ["Agosto de 2026", "Julho de 2026"],
);

const suspension = events.find((event) => event.eventType === "STUDENT_SUSPENDED");
assert.ok(suspension);
assert.equal(historyEventDescription(suspension), "Motivo: Falta de pagamento");
assert.ok(
  historyEventDetails(suspension).includes("Vaga de onibus: liberada"),
  "Expanded details must preserve optional event details compactly",
);

const legacySuspensionWithoutBus: StudentHistoryEvent = {
  ...suspension,
  id: "legacy-suspension-without-bus",
  justification:
    "Academico importado via LEGACY ja como SUSPENSO. Observacao legado: previsão de retorno em outubro",
  suspensionReason: "OTHER",
  busSeatReleased: false,
  bus: null,
  busAssignment: null,
};
assert.deepEqual(
  historyEventDetails(legacySuspensionWithoutBus),
  ["Onibus: nao informado no legado"],
  "Legacy suspended imports without bus must not render a maintained bus seat",
);

console.log("Student history compact guard OK");
