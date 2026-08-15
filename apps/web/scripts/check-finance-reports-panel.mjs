import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/app/admin/finance/financial-reports-panel.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/app/admin/finance/finance-navigation.tsx", import.meta.url), "utf8");

assert.match(api, /getFinancialMonthlyReport\(params\?: FinancialMonthlyReportParams\)/);
assert.match(api, /withParams\("\/finance\/reports\/monthly", params\)/);
assert.match(navigation, /area: "reports"/);
assert.match(navigation, /label: "Relatórios"/);

assert.match(panel, /Receita de mensalidades/);
assert.match(panel, /Outras entradas/);
assert.match(panel, /Receita total/);
assert.match(panel, /Despesas/);
assert.match(panel, /Resultado/);
assert.match(panel, /Comparativo dos últimos 12 meses/);
assert.match(panel, /Despesas por categoria/);
assert.match(panel, /Entradas manuais por categoria/);
assert.match(panel, /downloadReportPdf/);
assert.match(panel, /Gerar relatório/);
assert.match(panel, /Não foi possível gerar o PDF gerencial/);
assert.doesNotMatch(panel, /Excel|downloadReportXlsx/i);
