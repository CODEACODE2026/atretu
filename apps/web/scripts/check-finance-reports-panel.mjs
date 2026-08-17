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
assert.match(panel, /Evolução financeira — últimos 12 meses/);
assert.match(panel, /Despesas por categoria/);
assert.match(panel, /Outras entradas/);
assert.match(panel, /MonthlyEvolutionChart/);
assert.match(panel, /CategoryDonutChart/);
assert.match(panel, /donutSegments/);
assert.match(panel, /whitespace-nowrap text-xl/);
assert.match(panel, /Receita.*Despesa.*Resultado/s);
assert.match(panel, /Sem movimentação financeira no período/);
assert.match(panel, /Receita: \$\{row\.revenueFormatted\}/);
assert.match(panel, /Despesa: \$\{row\.expenseFormatted\}/);
assert.match(panel, /Resultado: \$\{formatSignedResult\(row\)\}/);
assert.match(panel, /Percentual:/);
assert.match(panel, /financialMonthly/);
assert.match(panel, /downloadReportPdf/);
assert.match(panel, /Gerar relatório/);
assert.match(panel, /Não foi possível gerar o PDF gerencial/);
assert.doesNotMatch(panel, /ResponsiveContainer|recharts|from "recharts"|from 'recharts'/i);
assert.doesNotMatch(panel, /ComparisonRow|grid min-w-\[760px\]/);
assert.doesNotMatch(panel, /Excel|downloadReportXlsx/i);

const exporter = readFileSync(new URL("../src/app/admin/reports/report-export.ts", import.meta.url), "utf8");
assert.match(exporter, /Resumo financeiro/);
assert.match(exporter, /Composição das receitas/);
assert.match(exporter, /Composição das despesas/);
assert.match(exporter, /Evolução financeira - últimos 12 meses/);
