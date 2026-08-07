import type { OfficialDocumentPdfBlock } from "./official-document-pdf.builder.js";

export const ADHESION_TERM_DOCUMENT_TITLE =
  "Termo de Adesão e Filiação Instrumento Particular de Associação";

export type AdhesionTermContentInput = {
  installmentAmount: string;
  installmentAmountWords: string;
  installmentCount: number;
  installmentCountWords: string;
  installmentDueDay: number;
  installments: Array<{ amountText: string; dateText: string; label: string }>;
  totalContractAmount: string;
  student: {
    address: string;
    birthDate: string;
    cpf: string;
    course: string;
    email: string;
    fullName: string;
    grade: string;
    institution: string;
    phone: string;
    rg: string;
    shift: string;
  };
};

export function adhesionTermBody(input: AdhesionTermContentInput): OfficialDocumentPdfBlock[] {
  const installmentCountText = `${input.installmentCount} (${input.installmentCountWords})`;
  return [
    {
      text: `Pelo presente Instrumento Particular de Associação, de um lado ATRETU - Associação Terra-riquense de Estudantes Técnico Universitários e de outro ${input.student.fullName} nascido (a) no dia ${input.student.birthDate}, portador (a) do RG nº ${input.student.rg} e inscrito (a) no CPF sob o nº ${input.student.cpf} residente na ${input.student.address} Cidade de Terra Rica PR, Telefone ${input.student.phone} email ${input.student.email}`,
      type: "paragraph",
    },
    {
      text: `Acadêmico da Instituição ${input.student.institution}, cursando ${input.student.course}, ${input.student.grade} ano, no período ${input.student.shift}`,
      type: "paragraph",
    },
    { text: "Ajustam o seguinte:", type: "paragraph" },
    {
      label: "Cláusula 1ª",
      text: " - Através do aceite a este Termo de Adesão de Associação, o(a) ASSOCIADO(A) descrito(a) no Cadastro acima preenchido, manifesta sua vontade de adesão ao quadro de associados do ATRETU - Associação Terrariquense de Estudantes Técnico Universitários, declarando conhecer e concordar com as normas estatutárias, subordinando-se a elas e às cláusulas abaixo.",
      type: "article",
    },
    {
      items: [
        "§ 1º - O referido cadastro será analisado pela Diretoria do(a) ASSOCIADO(A) para aprovação, conforme previsto no seu Estatuto.",
        "§ 2º - A aprovação da associação do(a) ASSOCIADO(A) estará condicionada ao cumprimento dos requisitos necessários ao gozo dos benefícios oferecidos, a critério exclusivo da Diretoria do ATRETU.",
      ],
      type: "list",
    },
    {
      label: "Cláusula 2ª DO OBJETO:",
      text: " - O presente termo tem como objeto a “ADESÃO DE ASSOCIAÇÃO”.",
      type: "article",
    },
    {
      text: "§ Único - O ASSOCIADO poderá fazer uso dos benefícios oferecidos por este Instituto, mediante seu aceite a este TERMO DE ADESÃO DE ASSOCIAÇÃO e após a aprovação do ATRETU",
      type: "paragraph",
    },
    {
      label: "Cláusula 3ª - DA EFETIVAÇÃO DA ASSOCIAÇÃO",
      text: " - Considerar-se-á efetiva a associação após o pagamento da primeira mensalidade por parte do ASSOCIADO.",
      type: "article",
    },
    {
      items: [
        "§ 1º - O pagamento da contribuição mensal só será disponibilizado ao ASSOCIADO cuja adesão de associação seja aprovada por parte da Diretoria do ATRETU, o que se dará de acordo com o previsto no Artigo 1º.",
        `§ 2º Contribuições. Os valores a serem pagos pelo Associado à ATRETU a título de contribuição são de ${installmentCountText} parcelas de ${input.installmentAmount} (${input.installmentAmountWords}) mensais, totalizando ${input.totalContractAmount}, com vencimentos mensais calculados a partir do dia ${input.installmentDueDay}, conforme cronograma abaixo.`,
      ],
      type: "list",
    },
    {
      headers: ["Parcela", "Vencimento", "Valor"],
      rows: input.installments.map((installment) => [
        installment.label,
        installment.dateText,
        installment.amountText,
      ]),
      type: "table",
    },
    {
      items: [
        "* Em caso de atraso no pagamento da Contribuição será devido multa moratória de 2% (dois por cento), juros de 1% (um por cento) incidentes sobre o montante em atraso, além da tarifa bancária para nova emissão de boletos.",
        "* O pagamento da contribuição mesmo com atraso só poderá ser feito dentro o mês corrente do vencimento, ou seja, até dia 30.",
        "* O pagamento da Contribuição é vinculado ao mês sequente de referência. Pagamento de 20 de janeiro vincula prestação de serviços e benefícios do mês de fevereiro e assim suscetivelmente não podendo esta ser utilizada para obtenção de benefícios junto à ATRETU relativos a períodos posteriores.",
      ],
      type: "list",
    },
    {
      label: "Cláusula 4ª Vigência e Desligamento:",
      text: " - É indeterminado o prazo de filiação do Associado à ATRETU sendo garantido a ele o direito de solicitar seu desligamento a qualquer tempo, observadas as condições previstas neste instrumento.",
      type: "article",
    },
    {
      items: [
        "§ 1º - Na hipótese da Associado solicitar seu desligamento da ATRETU, a associação terá o prazo mínimo de 30 dias para processar o pedido.",
        "§ 2º - O inadimplemento da Contribuição mensal implica desligamento do associado inadimplente.",
        "§ 3º - Após a data do desligamento, o ex-associado não gozará dos benefícios e atividades ofertados pela ATRETU.",
      ],
      type: "list",
    },
    {
      label: "Cláusula 5ª:",
      text: " - O Associado declara estar ciente e concorda com as suas obrigações previstas neste instrumento e no Estatuto Social da ATRETU",
      type: "article",
    },
    {
      label: "Cláusula 6ª :",
      text: " - Lei Aplicável e Foro. Este Termo será regido pela legislação aplicável e emitida pela República Federativa do Brasil. Para dirimir quaisquer controvérsias oriundas do presente Termo, as Partes elegem o foro da comarca de Terra Rica",
      type: "article",
    },
  ];
}
