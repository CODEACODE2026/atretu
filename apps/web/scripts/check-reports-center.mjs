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

console.log("Reports center guard OK");
