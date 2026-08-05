import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const navigation = readFileSync(join(root, "src/app/admin/admin-navigation.ts"), "utf8");
const shell = readFileSync(join(root, "src/app/admin/admin-shell.tsx"), "utf8");
const panel = readFileSync(join(root, "src/app/admin/reports-panel.tsx"), "utf8");
const exportUtils = readFileSync(join(root, "src/app/admin/reports/report-export.ts"), "utf8");

const requiredSnippets = [
  [navigation, 'key: "reports"', "reports navigation key"],
  [navigation, 'label: "Relatórios"', "reports navigation label"],
  [shell, "ReportsPanel", "reports panel render"],
  [panel, "Gerar PDF", "PDF action"],
  [panel, "Exportar Excel", "Excel action"],
  [panel, "Imprimir", "print action"],
  [panel, "Acadêmicos", "academic category"],
  [panel, "Transporte", "transport category"],
  [panel, "Financeiro", "finance category"],
  [panel, "Carteirinhas", "student cards category"],
  [panel, "Rematrículas", "reenrollment category"],
  [panel, "Acadêmicos sem documentação", "students without documentation report"],
  [panel, "Acadêmicos com documentação pendente", "students pending documentation report"],
  [panel, "Vagas disponíveis", "available seats report"],
  [panel, "Ônibus lotados", "full buses report"],
  [panel, "pending-cards", "pending cards report"],
  [panel, "Candidatos à rematrícula", "reenrollment candidates report"],
  [panel, "documentationReport", "documentation report builder"],
  [panel, "pendingCardsReport", "pending cards report builder"],
  [panel, "reenrollmentCandidatesReport", "reenrollment candidates report builder"],
  [panel, "availability", "bus availability filter"],
  [panel, "Depende de campanha ou status oficial", "concluded reenrollments disabled reason"],
  [panel, "Depende de campanha de rematrícula", "not started reenrollments disabled reason"],
  [panel, "Próxima etapa", "disabled reports label"],
  [panel, "listStudentDocumentationStatus", "documentation status API call"],
  [panel, "listPendingStudentCards", "pending cards API call"],
  [panel, "listReenrollmentCandidates", "reenrollment candidates API call"],
  [exportUtils, "application/pdf", "PDF blob"],
  [exportUtils, "spreadsheetml.sheet", "XLSX blob"],
  [exportUtils, "@page", "print layout"],
];

const missing = requiredSnippets.filter(([source, snippet]) => !source.includes(snippet));

if (missing.length > 0) {
  console.error(
    `Reports center guard failed: ${missing.map(([, , label]) => label).join(", ")}`,
  );
  process.exit(1);
}

const disabledReportCount = (panel.match(/unavailableReport\("/g) ?? []).length;
if (disabledReportCount !== 2) {
  console.error(
    `Reports center guard failed: expected 2 disabled reports, found ${disabledReportCount}`,
  );
  process.exit(1);
}

console.log("Reports center guard OK");
