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
