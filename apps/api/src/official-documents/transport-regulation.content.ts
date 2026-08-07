import type { OfficialDocumentPdfBlock } from "./official-document-pdf.builder.js";

export const TRANSPORT_REGULATION_DOCUMENT_TITLE =
  "DIRETRIZES PARA TRANSPORTE DE ALUNOS INTEGRANTES DA ASSOCIAÇÃO TERRARIQUENSE DOS ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS.";

export type TransportRegulationContentInput = {
  issuePlaceDateText: string;
  guardian?: {
    cpf: string | null;
    fullName: string;
    rg: string | null;
  } | null;
  president: {
    label: string;
    name: string;
  };
  student: {
    cpf: string;
    fullName: string;
    rg: string;
  };
};

export function transportRegulationBody(
  input: TransportRegulationContentInput,
): OfficialDocumentPdfBlock[] {
  const blocks: OfficialDocumentPdfBlock[] = [
    {
      type: "paragraph",
      text: "Pelo presente termo, o associado ao final identificado e assinado, toma inteiro conhecimento das normas abaixo preestabelecidas, desde já se comprometendo a cumpri-las rigorosamente, de conformidade com as regras Estatutárias da ATRETU, sob pena de cometimento de infrações e de se sujeitar às penas previstas nos Artigos 42º do respectivo Estatuto, que o(a) signatário(a) declara conhecer.",
    },
    {
      type: "paragraph",
      text: "A ATRETU disponibilizará aos seus ASSOCIADOS serviços de transporte com padrões de qualidade e regularidade adequados à sua natureza sendo ônibus rodoviário, micro-ônibus ou van, diário com destino, pontos a serem definidos por sua Diretoria.",
    },
    { type: "paragraph", text: "Todos associados tem direito à privacidade nos documentos pessoais." },
    {
      type: "paragraph",
      text: "Todos Associados tem direito de resposta às suas reclamações pelo prestador de serviço.",
    },
    {
      type: "paragraph",
      text: "É dever de todos associados respeitar os demais usuários; não falar alto ou gritar e promover festa, não praticar gestos obscenos, ou qualquer conduta reprovável, e trote dentro do ônibus.",
    },
    {
      type: "paragraph",
      text: "Não utilizar equipamentos sonoros com alto-falante (apenas com fone de ouvido).",
    },
    { type: "paragraph", text: "Não danificar ou sujar instalações dos veículos." },
    { type: "paragraph", text: "Não portar materiais explosivos ou tóxicos." },
    {
      type: "paragraph",
      text: "As instituições que ATRETU, disponibilizará transporte dentro de cidade de Paranavaí serão Unifatecie, Unespar, Unipar, Unopar, IFPR, Colégio Bento Munhoz da Rocha Neto (POLO), e Senac, qualquer outra instituição de curso técnico ou universitário para ser incluída no itinerário deverá conter mínimo de 10 alunos devidamente matriculado em cursos de mínimo de 2 (dois) anos",
    },
    {
      type: "paragraph",
      text: "A ATRETU só se responsabiliza pelo associado que embarca na cidade de origem (Terra Rica). Sendo assim o associado que necessitar somente retornar à cidade de origem (Terra Rica) fica obrigado a entrar em contato com o representante do ônibus ou com a diretoria da ATRETU",
    },
    {
      type: "paragraph",
      text: "A ATRETU e a Empresa contratada para o transporte, não se responsabilizarão por alunos deixados para trás, notadamente aqueles que não estiverem no local de embarque no horário estipulado pela diretoria, ou seja, até 10 minutos após o termino do horário de aula de sua instituição de ensino, salvo nos casos em que o representante ou motorista estiverem cientes de que o aluno irá se atrasar por mais tempo.",
    },
    {
      type: "boldParagraph",
      text: "O valor de R$ 150,00 fixado pela Diretoria, será pago no ato do cadastro ou recadastro, cuja arrecadação será destinada aos gastos administrativos ordinários e/ou extraordinários da AEUA, não sendo incluindo no custo mensal do transporte;",
    },
    {
      type: "paragraph",
      text: "O pagamento da taxa de manutenção supracitado, será feito anualmente, podendo sofrer reajuste caso haja desequilíbrio financeiro.",
    },
    {
      type: "paragraph",
      text: "Os associados deverão, obrigatoriamente, estar no local de embarque com antecedência mínima de dez (10) minutos do horário marcado para a saída de Terra Rica, não tendo o motorista qualquer obrigação de espera por atrasados.",
    },
    {
      type: "paragraph",
      text: "Caso o aluno tenha ido em um veículo e por algum motivo justificado tiver que retornar em outro, obrigatoriamente deverá comunicar o representante ou motorista, com antecedência inerente.",
    },
    {
      type: "boldParagraph",
      text: "É terminantemente proibido o uso de bebidas alcoólicas e o tabagismo no interior dos veículos transportadores dos associados.",
    },
    {
      type: "boldParagraph",
      text: "Em caso de Associado alcoolizado, não será permitido o seu embarque.",
    },
    {
      type: "paragraph",
      text: "As infrações eventualmente cometidas serão apuradas e aplicadas as penalidades de conformidade com o previsto nos artigos 9º e 10º dos Estatutos da Entidade, que vão desde simples advertência até a exclusão do quadro associativo.",
    },
    {
      type: "paragraph",
      text: "Qualquer comportamento inadequado no interior dos veículos transportadores, sujeitará o infrator às penalidades previstas, mediante representação do(s) associado(s) que se sentir(em) prejudicado(s) ou por iniciativa do representante do ônibus, por escrito à diretoria, informando sobre os fatos e as partes envolvidas, com assinatura de duas ou mais testemunhas.",
    },
    {
      type: "boldParagraph",
      text: "Fica proibido ao associado levar acompanhantes estranhos ao veículo transportador",
    },
    {
      type: "paragraph",
      text: "Em caso de quebra do veículo, os transportados deverão permanecer em seu interior, a fim de evitar acidentes, podendo desembarcar somente o representante do ônibus, o motorista e demais pessoas que forem solicitadas.",
    },
    {
      type: "paragraph",
      text: "É permitido viajar na cabine do veículo ônibus com o motorista, apenas o representante de ônibus ou membro da diretoria/conselho fiscal, caso o veículo tenha o banco na frente e com cinto de segurança;",
    },
    {
      type: "paragraph",
      text: "A cobrança mensal do transporte será feita pela empresa transportadora contratada, ficando a cargo da Diretoria repassar para a mesma os cálculos mensais;",
    },
    {
      type: "boldParagraph",
      text: "Todas informações pertinentes ao transporte serão divulgadas nos grupos de cada instituição e grupo geral, não sendo a Diretoria responsável por prestar qualquer informação de forma particular a cada aluno.",
    },
    {
      type: "paragraph",
      text: "Fica o associado ciente de que qualquer mudança de itinerário, que gerar questionamentos, este deve ser direcionado somente ao representante do ônibus, o qual se necessário pedira ajuda a diretoria para solucionar possíveis divergências, não tendo o motorista do ônibus ou empresa qualquer autoridade para tomar decisões.",
    },
    {
      type: "boldParagraph",
      text: "É de total responsabilidade do associado manter-se no grupo whatsapp tanto Grupo dos Universitários como no grupo do ônibus de sua instituição",
    },
    {
      type: "paragraph",
      text: "Fica o associado ciente de que é obrigatória a apresentação da carteirinha de associado, autorização de embarque ou passe fornecido pela diretoria, como condição para o embarque no veículo transportador.",
    },
    {
      type: "boldParagraph",
      text: "A inadimplência por parte do associado lhe retira o direito de utilizar o transporte;",
    },
    {
      type: "paragraph",
      text: "A carteira de estudante será suspensa nos casos de inadimplência no pagamento da mensalidade junto à prestadora dos serviços de transporte, bem como por infrações conforme o Estatuto da ATRETU",
    },
    {
      type: "paragraph",
      text: "Os protocolos realizados junto à Associação serão divulgados em Assembleia Ordinárias e/ou Extraordinária e reuniões da Diretoria.",
    },
    {
      type: "paragraph",
      text: "Os requerimentos protocolados junto a ATRETU deverão ser respondidos em até 20 dias úteis.",
    },
    {
      type: "paragraph",
      text: "Adquire-se a condição de associado quando o interessado houver efetivado o pagamento integral da contribuição anual para ATRETU, bem como apresentado a documentação inerente e solicitada pela ATRETU, estando em dia com suas mensalidades.",
    },
    {
      type: "paragraph",
      text: "Caso o associado desistir do curso ou deixe de usar os serviços de transporte aqui tratados, não lhe será reembolsado, em hipótese alguma, qualquer valor já pago para ATRETU.",
    },
    {
      type: "paragraph",
      text: "Fica o associado ciente de que o valor cobrado anualmente não estão inclusos gastos extraordinários, a exemplo de contratação de serviços advocatícios, periciais, etc, se por ventura houver algum processo e/ou denuncia a qual traga gastos a esta associação, será feita uma Assembleia Extraordinária e exposto o ocorrido e uma chamada de capital para pagamento dos custos e todos associados deverão pagar mesmo estando em dia com a contribuição mensal e com a empresa prestadora do serviço, caso não seja efetuado o pagamento o associado perderá os direitos de usufruir os benefícios desta associação.",
    },
    {
      type: "boldParagraph",
      text: "A ATRETU não ficará responsável pelo transporte de associado para locais distintos de seu ponto de destino, tais como estágios, palestras, fóruns, etc.",
    },
    {
      type: "paragraph",
      text: "Em caso de quebra de ônibus será feito remanejamento de acordo com a decisão da Diretoria, que transmitirá aos representantes do ônibus, quais serão veículos e rotas a serem utilizados.",
    },
    {
      type: "paragraph",
      text: "Os horários deverão ser respeitados rigorosamente e alinhados de acordo com o “horário da linha”.",
    },
    { type: "spacer", size: 6 },
    { type: "paragraph", text: input.issuePlaceDateText },
    {
      type: "signatureGroup",
      signatures: [
        {
          label: input.president.label,
          name: input.president.name,
        },
      ],
    },
    { type: "heading", text: "TERMO DE CIENCIA DO REGIMENTO DO TRANSPORTE" },
    {
      type: "signatureGroup",
      signatures: [
        {
          details: [
            `Nome do Associado: ${input.student.fullName}`,
            `RG n°: ${input.student.rg}`,
            `CPF n°: ${input.student.cpf}`,
          ],
          label: "Associado",
          name: input.student.fullName,
        },
      ],
    },
  ];

  if (input.guardian) {
    blocks.push(
      { type: "heading", text: "QUANDO INTERESSADO FOR MENOR DE IDADE:" },
      {
        type: "signatureGroup",
        signatures: [
          {
            details: [
              `Nome do Representante legal do associado : ${input.guardian.fullName}`,
              `RG n°: ${input.guardian.rg || "nao informado"}`,
              `CPF n°: ${input.guardian.cpf || "nao informado"}`,
            ],
            label: "Responsavel legal",
            name: input.guardian.fullName,
          },
        ],
      },
    );
  }

  return blocks;
}
