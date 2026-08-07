import type { OfficialDocumentPdfBlock } from "./official-document-pdf.builder.js";

export const TRANSPORT_REFUND_REQUEST_DOCUMENT_TITLE =
  "Solicitação de Reembolso Transporte Universitário";

export type TransportRefundPaymentMethod = "BANK_ACCOUNT" | "PIX";

export type TransportRefundRequestContentInput = {
  issuePlaceDateText: string;
  payment: {
    bankAccount?: {
      account: string;
      agency: string;
      bankName: string;
      accountType?: string | null;
    } | null;
    method: TransportRefundPaymentMethod;
    methodText: string;
    pixKey?: string | null;
  };
  reason: string;
  refundAmount: string;
  refundAmountWords: string;
  student: {
    academicYear: string;
    address: string;
    cpf: string;
    email: string;
    fullName: string;
    institution: string;
    phone: string;
  };
};

export function transportRefundRequestBody(
  input: TransportRefundRequestContentInput,
): OfficialDocumentPdfBlock[] {
  const paymentLines =
    input.payment.method === "PIX"
      ? [`Forma de recebimento: PIX`, `Chave PIX: ${input.payment.pixKey ?? ""}`]
      : [
          "Forma de recebimento: Conta bancária",
          `Banco: ${input.payment.bankAccount?.bankName ?? ""}`,
          `Agência: ${input.payment.bankAccount?.agency ?? ""}`,
          `Conta: ${input.payment.bankAccount?.account ?? ""}`,
          input.payment.bankAccount?.accountType
            ? `Tipo de conta: ${input.payment.bankAccount.accountType}`
            : null,
        ].filter((item): item is string => Boolean(item));

  return [
    {
      type: "paragraph",
      text: `Eu, ${input.student.fullName}, residente à ${input.student.address}, CPF: ${input.student.cpf} aluno(a) do ${input.student.academicYear} na instituição de ensino ${input.student.institution} venho, por meio desta solicitação, requerer o reembolso do valor de ${input.refundAmount} (${input.refundAmountWords}) referente ao transporte escolar do ano letivo corrente.`,
    },
    {
      type: "paragraph",
      text: `O motivo desta solicitação é ${input.reason}. Para que o reembolso seja realizado, informo os seguintes dados bancários ou Pix:`,
    },
    {
      items: paymentLines,
      type: "list",
    },
    { type: "spacer", size: 8 },
    { text: input.issuePlaceDateText, type: "boldParagraph" },
    { type: "spacer", size: 6 },
    {
      items: [
        `Aluno: ${input.student.fullName}`,
        "Informações de Contato:",
        `Telefone: ${input.student.phone}`,
        `E-mail: ${input.student.email}`,
      ],
      type: "list",
    },
  ];
}
