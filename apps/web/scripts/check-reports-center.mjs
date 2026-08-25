import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const navigation = readFileSync(join(root, "src/app/admin/admin-navigation.ts"), "utf8");
const auth = readFileSync(join(root, "src/lib/auth.ts"), "utf8");
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
  [panel, 'const canExportReports = hasCapability(user, "reports.export")', "reports export capability gate"],
  [panel, "disabled={!generatedReport || !isReportAvailable(selectedReport) || !canExportReports}", "client-side export disabled without reports.export"],
  [auth, 'return hasCapability(user, "reports.view")', "reports area requires reports.view"],
  [auth, '"reports.export"', "reports export remains in the operational frontend capability set"],
  [panel, "downloadReportPdf(generatedReport, user)", "PDF export uses generated report"],
  [panel, "downloadReportXlsx(generatedReport, user)", "XLSX export uses generated report"],
  [panel, "printReport(generatedReport, user)", "print export uses generated report"],
  [exportUtils, "application/pdf", "PDF blob"],
  [exportUtils, "spreadsheetml.sheet", "XLSX blob"],
  [exportUtils, "@page", "print layout"],
  [exportUtils, "function loadPdfLogo(src: string)", "PDF export only fetches static logo"],
];

const missing = requiredSnippets.filter(([source, snippet]) => !source.includes(snippet));

if (missing.length > 0) {
  console.error(
    `Reports center guard failed: ${missing.map(([, , label]) => label).join(", ")}`,
  );
  process.exit(1);
}

const reportsAreaBlock = auth.match(/if \(area === "reports"\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
if (!reportsAreaBlock.includes('hasCapability(user, "reports.view")')) {
  console.error("Reports center guard failed: reports.export must not open Reports without reports.view");
  process.exit(1);
}
if (reportsAreaBlock.includes("reports.export")) {
  console.error("Reports center guard failed: reports.export must not be an area access fallback");
  process.exit(1);
}

const exportDisabledChecks = panel.match(
  /disabled=\{!generatedReport \|\| !isReportAvailable\(selectedReport\) \|\| !canExportReports\}/g,
) ?? [];
if (exportDisabledChecks.length !== 3) {
  console.error(
    `Reports center guard failed: expected 3 export buttons gated by reports.export, found ${exportDisabledChecks.length}`,
  );
  process.exit(1);
}
for (const call of [
  "downloadReportPdf(generatedReport, user)",
  "downloadReportXlsx(generatedReport, user)",
  "printReport(generatedReport, user)",
]) {
  const callIndex = panel.indexOf(call);
  const nearbySource = panel.slice(Math.max(0, callIndex - 140), callIndex + call.length + 20);
  if (callIndex === -1 || !nearbySource.includes("canExportReports")) {
    console.error(`Reports center guard failed: ${call} must remain protected by reports.export`);
    process.exit(1);
  }
}

const disabledReportCount = (panel.match(/unavailableReport\("/g) ?? []).length;
if (disabledReportCount !== 2) {
  console.error(
    `Reports center guard failed: expected 2 disabled reports, found ${disabledReportCount}`,
  );
  process.exit(1);
}

const exportFunctionBlock = exportUtils.match(
  /export async function downloadReportPdf[\s\S]*?function formatCell/,
)?.[0] ?? "";
if (!exportFunctionBlock) {
  console.error("Reports center guard failed: export function block not found");
  process.exit(1);
}
if (/api\.|request\(|withParams\(/.test(exportFunctionBlock)) {
  console.error("Reports center guard failed: export helpers must not fetch domain data");
  process.exit(1);
}
const fetchCalls = exportFunctionBlock.match(/\bfetch\(/g) ?? [];
if (fetchCalls.length !== 1 || !exportFunctionBlock.includes("fetch(src)")) {
  console.error("Reports center guard failed: export fetch must be limited to the static logo");
  process.exit(1);
}
if (/api\.|request\(|withParams\(/.test(exportUtils)) {
  console.error("Reports center guard failed: export module must only transform the authorized GeneratedReport dataset");
  process.exit(1);
}
const allExportFetches = exportUtils.match(/\bfetch\(/g) ?? [];
if (allExportFetches.length !== 1 || !exportUtils.includes("fetch(src)")) {
  console.error("Reports center guard failed: report export module must not fetch domain data");
  process.exit(1);
}

console.log("Reports center guard OK");
