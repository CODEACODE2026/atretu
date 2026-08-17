import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReportPdf, buildReportXlsx, type GeneratedReport } from "../src/app/admin/reports/report-export";

const user = { name: "QA Relatórios" };
const generatedAt = "2026-08-04T12:00:00.000Z";

async function main() {
  const activeStudents = makeStudentsReport(11, "Acadêmicos ativos");
  const pdfText = await blobToLatin1(buildReportPdf(activeStudents, user));
  assertIncludes(pdfText, "Acadêmicos ativos", "PDF title with accent");
  assertIncludes(pdfText, "Instituição", "PDF institution column with accent");
  assertIncludes(pdfText, "Aluno 001", "PDF first row");
  assertIncludes(pdfText, "Aluno 011", "PDF last row");
  assertIncludes(pdfText, "Registros: 11", "PDF row count summary");
  assert(!pdfText.includes("<FEFF"), "PDF must not write UTF-16 hex text into a simple Type1 font");
  assert(!pdfText.includes("AcadEmicos"), "PDF must not contain corrupted academic title");
  assert(pdfText.length > 4_000, "PDF must not be almost empty");

  const emptyPdfText = await blobToLatin1(buildReportPdf(makeStudentsReport(0, "Acadêmicos ativos"), user));
  assertIncludes(emptyPdfText, "Nenhum registro encontrado.", "PDF empty state");

  const singlePdfText = await blobToLatin1(buildReportPdf(makeStudentsReport(1, "Acadêmicos ativos"), user));
  assertIncludes(singlePdfText, "Aluno 001", "PDF single row");

  const longPdfText = await blobToLatin1(buildReportPdf(makeStudentsReport(125, "Acadêmicos ativos"), user));
  assertIncludes(longPdfText, "Aluno 001", "PDF long report first row");
  assertIncludes(longPdfText, "Aluno 125", "PDF long report last row");
  assert(pageCount(longPdfText) > 1, "PDF long report must paginate");

  const financialPdfText = await blobToLatin1(buildReportPdf(makeFinancialReport("POSITIVE"), user, fakeLogo()));
  assertIncludes(financialPdfText, "Relatório financeiro gerencial", "financial PDF title");
  assertIncludes(financialPdfText, "Resumo financeiro", "financial PDF summary section");
  assertIncludes(financialPdfText, "Mensalidades recebidas", "financial PDF invoice revenue");
  assertIncludes(financialPdfText, "Outras entradas", "financial PDF manual income");
  assertIncludes(financialPdfText, "Receita total", "financial PDF total revenue highlight");
  assertIncludes(financialPdfText, "Despesas pagas", "financial PDF paid expenses");
  assertIncludes(financialPdfText, "Resultado do mês", "financial PDF monthly result highlight");
  assertIncludes(financialPdfText, "Composição das receitas", "financial PDF income composition");
  assertIncludes(financialPdfText, "Composição das despesas", "financial PDF expense composition");
  assertIncludes(financialPdfText, "Evolução financeira - últimos 12 meses", "financial PDF comparison chart");
  assertIncludes(financialPdfText, "Doação", "financial PDF income category");
  assertIncludes(financialPdfText, "93.46%", "financial PDF category percentage");
  assertIncludes(financialPdfText, "+ R$ 2.500,00", "financial PDF positive result");
  assertIncludes(financialPdfText, "/Im1 Do", "financial PDF logo image");
  assert(!financialPdfText.includes("America/Sao_Paulo"), "financial PDF must not expose timezone in body");
  assert(!financialPdfText.includes("Registros:"), "financial PDF must not expose row count noise");
  assert(!financialPdfText.includes("Competência"), "financial PDF must not repeat competence details");
  assert(!financialPdfText.includes("Seção"), "financial PDF must not expose generic section column");
  assert(!financialPdfText.includes("Detalhe"), "financial PDF must not expose generic detail column");
  assert(!financialPdfText.includes("Comparativo dos últimos 12 meses"), "financial PDF must not use old comparison table title");
  assert(pageCount(financialPdfText) === 1, "financial PDF with regular August 2026 data should fit one page");

  const negativeFinancialPdfText = await blobToLatin1(buildReportPdf(makeFinancialReport("NEGATIVE"), user));
  assertIncludes(negativeFinancialPdfText, "- R$ 1.400,00", "financial PDF negative result");

  const zeroFinancialPdfText = await blobToLatin1(buildReportPdf(makeFinancialReport("ZERO"), user));
  assertIncludes(zeroFinancialPdfText, "R$ 0,00", "financial PDF zero values");
  assertIncludes(zeroFinancialPdfText, "Nenhuma receita adicional no período.", "financial PDF empty income categories");

  const longFinancialPdfText = await blobToLatin1(buildReportPdf(makeFinancialReport("MANY_CATEGORIES"), user));
  assert(pageCount(longFinancialPdfText) > 1, "financial PDF with many categories must paginate");
  assertIncludes(longFinancialPdfText, "Página 2 de", "financial PDF pagination");

  const xlsxText = await blobToUtf8(buildReportXlsx(activeStudents, user));
  assertIncludes(xlsxText, "Acadêmicos ativos", "XLSX title with accent");
  assertIncludes(xlsxText, "Instituição", "XLSX institution column with accent");
  assertIncludes(xlsxText, "Aluno 001", "XLSX first row");
  assertIncludes(xlsxText, "Aluno 011", "XLSX last row");

  if (process.env.WRITE_REPORT_QA_ARTIFACTS === "true") {
    writeFileSync(join("/tmp", "atretu-academicos-ativos-guard.pdf"), Buffer.from(await buildReportPdf(activeStudents, user).arrayBuffer()));
    writeFileSync(join("/tmp", "atretu-academicos-ativos-guard.xlsx"), Buffer.from(await buildReportXlsx(activeStudents, user).arrayBuffer()));
  }

  console.log("Reports PDF export guard OK");
}

function makeFinancialReport(mode: "MANY_CATEGORIES" | "NEGATIVE" | "POSITIVE" | "ZERO"): GeneratedReport {
  const positiveSummary = [
    { label: "Mensalidades recebidas", value: "R$ 4.000,00" },
    { label: "Outras entradas", value: "R$ 535,00" },
    { highlight: true, label: "Receita total", tone: "positive" as const, value: "R$ 4.535,00" },
    { label: "Despesas pagas", value: "R$ 2.035,00" },
    { highlight: true, label: "Resultado do mês", tone: "positive" as const, value: "+ R$ 2.500,00" },
  ];
  const negativeSummary = [
    { label: "Mensalidades recebidas", value: "R$ 1.000,00" },
    { label: "Outras entradas", value: "R$ 100,00" },
    { highlight: true, label: "Receita total", tone: "positive" as const, value: "R$ 1.100,00" },
    { label: "Despesas pagas", value: "R$ 2.500,00" },
    { highlight: true, label: "Resultado do mês", tone: "negative" as const, value: "- R$ 1.400,00" },
  ];
  const zeroSummary = [
    { label: "Mensalidades recebidas", value: "R$ 0,00" },
    { label: "Outras entradas", value: "R$ 0,00" },
    { highlight: true, label: "Receita total", tone: "positive" as const, value: "R$ 0,00" },
    { label: "Despesas pagas", value: "R$ 0,00" },
    { highlight: true, label: "Resultado do mês", tone: "positive" as const, value: "+ R$ 0,00" },
  ];
  const baseIncomeCategories = [
    { count: 1, label: "Doação", percentage: 93.46, totalFormatted: "R$ 500,00" },
    { count: 1, label: "Segunda via", percentage: 4.67, totalFormatted: "R$ 25,00" },
    { count: 1, label: "Xerox", percentage: 1.87, totalFormatted: "R$ 10,00" },
  ];
  const baseExpenseCategories = [
    { count: 2, label: "Combustível", percentage: 72.24, totalFormatted: "R$ 1.470,00" },
    { count: 1, label: "Contabilidade", percentage: 27.76, totalFormatted: "R$ 565,00" },
  ];
  const manyCategories = Array.from({ length: 13 }, (_, index) => ({
    count: index + 1,
    label: `Categoria ${String(index + 1).padStart(2, "0")}`,
    percentage: index === 0 ? 20 : 6.67,
    totalFormatted: `R$ ${(index + 1) * 100},00`,
  }));

  return {
    category: "Financeiro",
    columns: [],
    financialMonthly: {
      comparison: Array.from({ length: 12 }, (_, index) => {
        const revenueCents = mode === "ZERO" ? 0 : 100000 + index * 12000;
        const expenseCents = mode === "ZERO" ? 0 : 60000 + index * 8000;
        const resultCents = mode === "NEGATIVE" && index === 11 ? -140000 : revenueCents - expenseCents;
        return {
          expenseCents,
          expenseFormatted: money(expenseCents),
          label: `${String(index + 1).padStart(2, "0")}/2026`,
          resultFormatted: money(Math.abs(resultCents)),
          resultStatus: resultCents < 0 ? "NEGATIVE" : "POSITIVE",
          revenueCents,
          revenueFormatted: money(revenueCents),
        };
      }),
      expenseCategories: mode === "ZERO" ? [] : mode === "MANY_CATEGORIES" ? manyCategories : baseExpenseCategories,
      incomeCategories: mode === "ZERO" ? [] : mode === "MANY_CATEGORIES" ? manyCategories : baseIncomeCategories,
      periodLabel: "agosto de 2026",
      summary: mode === "ZERO" ? zeroSummary : mode === "NEGATIVE" ? negativeSummary : positiveSummary,
    },
    filters: [
      { label: "Associação", value: "ATRETU" },
      { label: "Período", value: "agosto de 2026" },
    ],
    generatedAt,
    rows: [],
    summary: [],
    title: "Relatório financeiro gerencial",
  };
}

function fakeLogo() {
  return {
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    height: 32,
    name: "Im1",
    width: 48,
  };
}

function money(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueCents / 100);
}

function makeStudentsReport(count: number, title: string): GeneratedReport {
  return {
    category: "Acadêmicos",
    columns: [
      { key: "student", label: "Acadêmico" },
      { key: "cpf", label: "CPF" },
      { key: "status", label: "Status" },
      { key: "institution", label: "Instituição" },
      { key: "course", label: "Curso" },
      { key: "academicYear", label: "Ano letivo", type: "number" },
      { key: "entryDate", label: "Entrada", type: "date" },
    ],
    filters: [
      { label: "Instituição", value: "Instituição São João" },
      { label: "Ano letivo", value: "2026" },
    ],
    generatedAt,
    rows: Array.from({ length: count }, (_, index) => ({
      academicYear: 2026,
      course: index % 2 === 0 ? "Técnico em Administração" : "Ensino Médio",
      cpf: `000.000.000-${String(index + 1).padStart(2, "0")}`,
      entryDate: `2026-02-${String((index % 25) + 1).padStart(2, "0")}T00:00:00.000Z`,
      institution: index % 2 === 0 ? "Instituição São João" : "Instituição Educação Brasil",
      status: "Ativo",
      student: `Aluno ${String(index + 1).padStart(3, "0")}`,
    })),
    summary: [
      { label: "Total", value: String(count) },
      { label: "Situação", value: "Ativos" },
      { label: "Ônibus", value: "Linha Centro" },
      { label: "Emissão", value: "04/08/2026" },
    ],
    title,
  };
}

async function blobToLatin1(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer()).toString("latin1");
}

async function blobToUtf8(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer()).toString("utf8");
}

function pageCount(pdfText: string) {
  return [...pdfText.matchAll(/\/Type \/Page\b/g)].length;
}

function assertIncludes(source: string, expected: string, label: string) {
  assert(source.includes(expected), `${label}: expected "${expected}"`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
