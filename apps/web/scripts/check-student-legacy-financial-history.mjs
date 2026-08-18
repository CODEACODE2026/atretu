import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const financePanelSource = readFileSync(
  resolve("src/app/admin/finance-panel.tsx"),
  "utf8",
);
const apiSource = readFileSync(resolve("src/lib/api.ts"), "utf8");

assertIncludes(
  apiSource,
  "legacyFinancialHistory?: LegacyFinancialHistoryRecord[]",
  "Student detail must expose legacy financial history separately",
);
assertIncludes(
  financePanelSource,
  "Histórico financeiro legado",
  "Student finance tab must render a separate legacy financial history section",
);
assertIncludes(
  financePanelSource,
  "records={student.legacyFinancialHistory ?? []}",
  "Student finance tab must use only the read-only legacy financial collection",
);
assertIncludes(
  financePanelSource,
  "Sem ações Sicredi para registros legados",
  "Legacy financial cards must make the Sicredi action boundary explicit",
);

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
