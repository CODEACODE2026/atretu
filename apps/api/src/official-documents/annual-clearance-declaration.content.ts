import type { OfficialDocumentPdfBlock } from "./official-document-pdf.builder.js";

export const ANNUAL_CLEARANCE_DECLARATION_DOCUMENT_TITLE =
  "Declaração de Quitação Anual";

export type AnnualClearanceDeclarationContentInput = {
  finalClearanceDate: string;
  issuePlaceDateText: string;
  periodEnd: string;
  periodStart: string;
  presidentName: string;
  student: {
    cpf: string;
    fullName: string;
  };
  totalAmount: string;
  totalAmountWords: string;
  year: number;
};

export function annualClearanceDeclarationBody(
  input: AnnualClearanceDeclarationContentInput,
): OfficialDocumentPdfBlock[] {
  return [
    {
      type: "paragraph",
      text: `Declaramos, para os devidos fins, que o(a) associado(a) abaixo identificado(a) quitou integralmente todas as obrigações financeiras junto à ATRETU - Associação Terra-riquense de Estudante Técnico e Universitário, referentes ao exercício do ano de ${input.year}.`,
    },
    { type: "spacer", size: 10 },
    {
      items: [
        `Nome do Associado: ${input.student.fullName}`,
        `CPF: ${input.student.cpf}`,
      ],
      type: "list",
    },
    { type: "spacer", size: 8 },
    {
      items: [
        `Período Quitado: ${input.periodStart} a ${input.periodEnd}`,
        `Valor Total Pago no Período: ${input.totalAmount} (${input.totalAmountWords})`,
        `Data da quitação final: ${input.finalClearanceDate}`,
      ],
      type: "list",
    },
    { type: "spacer", size: 10 },
    {
      type: "paragraph",
      text: "Esta declaração é expedida nos termos das normas internas da associação, podendo ser utilizada como comprovação de adimplemento junto à ATRETU.",
    },
    { type: "spacer", size: 14 },
    { text: input.issuePlaceDateText, type: "boldParagraph" },
  ];
}
