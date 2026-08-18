import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const financePanelSource = readFileSync(
  resolve("src/app/admin/finance-panel.tsx"),
  "utf8",
);
const apiSource = readFileSync(resolve("src/lib/api.ts"), "utf8");

assertIncludes(
  apiSource,
  "listStudentLegacyFinancialHistory",
  "API client must expose paginated legacy financial history",
);
assertIncludes(
  apiSource,
  "/legacy-financial-history",
  "API client must call the paginated legacy financial history endpoint",
);
assertIncludes(
  financePanelSource,
  "Histórico financeiro legado",
  "Student finance tab must render a separate legacy financial history section",
);
assertIncludes(
  financePanelSource,
  "LEGACY_FINANCIAL_PAGE_SIZE = 10",
  "Student finance tab must keep legacy history at 10 records per page",
);
assertIncludes(
  financePanelSource,
  "response={legacyFinancialHistory}",
  "Student finance tab must render the paginated legacy history response",
);
assertIncludes(
  financePanelSource,
  "Sem ações Sicredi para registros legados",
  "Legacy financial cards must make the Sicredi action boundary explicit",
);
for (const [fragment, message] of [
  ["Total", "Legacy history summary must include total records"],
  ["Pagos", "Legacy history summary must include paid count"],
  ["Baixados", "Legacy history summary must include settled/cancelled count"],
  ["Pendentes", "Legacy history summary must include pending count"],
  ["Vencidos", "Legacy history summary must include overdue count"],
  ["Ver detalhes", "Legacy history rows must expose detail expansion"],
  ["Pagina {pagination.page} de {totalPages}", "Legacy history must show page count"],
  ["Exibindo {firstVisible}-{lastVisible} de {pagination.total}", "Legacy history must show visible range"],
  ["Mais recente primeiro", "Legacy history must support newest first sorting"],
  ["Mais antigo primeiro", "Legacy history must support oldest first sorting"],
]) {
  assertIncludes(financePanelSource, fragment, message);
}

const legacySection = sourceBetween(
  financePanelSource,
  "function LegacyFinancialHistorySection",
  "function StudentInvoiceCard",
);
for (const forbidden of [
  "issueInvoiceBankSlip",
  "syncInvoiceBankSlip",
  "cancelInvoiceBankSlip",
  "createInvoice(",
  "cancelInvoice(",
]) {
  if (legacySection.includes(forbidden)) {
    throw new Error(`Legacy financial section must not call ${forbidden}`);
  }
}

console.log("Student legacy financial history guard OK");

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message);
  }
}

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error("Could not locate legacy financial history section");
  }
  return source.slice(startIndex, endIndex);
}
