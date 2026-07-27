import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const profileSource = readFileSync(
  resolve("src/app/admin/students/student-profile-view.tsx"),
  "utf8",
);
const summarySource = readFileSync(
  resolve("src/app/admin/students/student-profile-summary.tsx"),
  "utf8",
);
const headerSource = readFileSync(
  resolve("src/app/admin/students/student-profile-header.tsx"),
  "utf8",
);
const cardsSource = readFileSync(
  resolve("src/app/admin/student-cards-panel.tsx"),
  "utf8",
);
const utilsSource = readFileSync(
  resolve("src/app/admin/students/cards/student-card-display-utils.ts"),
  "utf8",
);

assertIncludes(
  profileSource,
  "api.listStudentCardsForStudent(detail.id)",
  "Student profile must load card summary from the existing student cards endpoint",
);
assertIncludes(
  profileSource,
  "activeCard={cardSummary.activeCard}",
  "Student profile header must receive the computed active card",
);
assertIncludes(
  profileSource,
  "cardSummary={cardSummary}",
  "Student profile summary must receive the computed card summary",
);
assertIncludes(
  profileSource,
  "activeCard={cardSummary.activeCard}",
  "Student profile card tab must receive the computed active card",
);
assertIncludes(
  summarySource,
  '"Emitida"',
  "Executive summary must show Emitida when an active card exists",
);
assertIncludes(
  summarySource,
  '? "Sem ativa"',
  "Executive summary must distinguish historical cards from no card",
);
assertIncludes(
  headerSource,
  "Sem carteirinha ativa",
  "Profile header must not show a misleading not-issued label for historical cards",
);
assertIncludes(
  cardsSource,
  "selectCurrentStudentCard(student, cards)",
  "Student card tab must use the same active-card selector",
);
assertIncludes(
  utilsSource,
  'card.status === "ACTIVE"',
  "Active card selector must require ACTIVE status",
);
assertIncludes(
  utilsSource,
  "card.validity.usable",
  "Active card selector must require usable validity",
);
assertIncludes(
  utilsSource,
  "card.enrollment.id === currentEnrollment.id",
  "Active card selector must match the current enrollment",
);

console.log("Student profile card summary guard OK");

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message);
  }
}
