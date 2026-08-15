import {
  BoardMemberRole,
  OfficialDocumentType,
  StudentStatus,
} from "@prisma/client";

export type OfficialDocumentSignerSource =
  | "BOARD_ROLE"
  | "EMISSOR"
  | "GUARDIAN"
  | "STUDENT";

export type OfficialDocumentSignerRole =
  | BoardMemberRole
  | "ACADEMICO"
  | "EMISSOR"
  | "RESPONSAVEL";

export type OfficialDocumentSignerDefinition = {
  label: string;
  required: boolean;
  role: OfficialDocumentSignerRole;
  source: OfficialDocumentSignerSource;
};

export type OfficialDocumentDefinition = {
  blockedReason: string;
  description: string;
  scope: "INSTITUTIONAL" | "STUDENT";
  templateKey: string;
  templateVersion: number;
  title: string;
  type: OfficialDocumentType;
  version: number;
  signers: OfficialDocumentSignerDefinition[];
  canIssue: (student: { status: StudentStatus }) => boolean;
};

export const OFFICIAL_DOCUMENT_DEFINITIONS: Partial<
  Record<OfficialDocumentType, OfficialDocumentDefinition>
> = {
  [OfficialDocumentType.ADHESION_TERM]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Formaliza a adesao e filiacao do academico ao quadro de associados da ATRETU.",
    scope: "STUDENT",
    templateKey: "adhesion-term",
    templateVersion: 1,
    title: "Termo de Adesão e Filiação",
    type: OfficialDocumentType.ADHESION_TERM,
    version: 1,
    signers: [
      {
        label: "Presidente da ATRETU",
        required: true,
        role: BoardMemberRole.PRESIDENT,
        source: "BOARD_ROLE",
      },
      {
        label: "Associado",
        required: true,
        role: "ACADEMICO",
        source: "STUDENT",
      },
      {
        label: "Responsavel",
        required: false,
        role: "RESPONSAVEL",
        source: "GUARDIAN",
      },
    ],
  },
  [OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Declara a quitacao anual das obrigacoes financeiras do academico junto a ATRETU.",
    scope: "STUDENT",
    templateKey: "annual-clearance-declaration",
    templateVersion: 1,
    title: "Declaração de Quitação Anual",
    type: OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION,
    version: 1,
    signers: [
      {
        label: "Presidente da ATRETU",
        required: true,
        role: BoardMemberRole.PRESIDENT,
        source: "BOARD_ROLE",
      },
    ],
  },
  [OfficialDocumentType.TRANSPORT_REGULATION]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Registra ciencia do academico sobre as diretrizes oficiais de uso do transporte da ATRETU.",
    scope: "STUDENT",
    templateKey: "transport-regulation",
    templateVersion: 1,
    title: "Regimento do Transporte / Termo de Ciência",
    type: OfficialDocumentType.TRANSPORT_REGULATION,
    version: 1,
    signers: [
      {
        label: "Presidente da ATRETU",
        required: true,
        role: BoardMemberRole.PRESIDENT,
        source: "BOARD_ROLE",
      },
      {
        label: "Associado",
        required: true,
        role: "ACADEMICO",
        source: "STUDENT",
      },
      {
        label: "Responsavel",
        required: false,
        role: "RESPONSAVEL",
        source: "GUARDIAN",
      },
    ],
  },
  [OfficialDocumentType.TRANSPORT_REFUND_REQUEST]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Formaliza a solicitacao de reembolso de transporte universitario do academico.",
    scope: "STUDENT",
    templateKey: "transport-refund-request",
    templateVersion: 1,
    title: "Solicitação de Reembolso Transporte Universitário",
    type: OfficialDocumentType.TRANSPORT_REFUND_REQUEST,
    version: 1,
    signers: [
      {
        label: "Associado",
        required: true,
        role: "ACADEMICO",
        source: "STUDENT",
      },
    ],
  },
  [OfficialDocumentType.TERMINATION_LETTER]: {
    blockedReason: "Disponivel apos o desligamento do academico.",
    canIssue: (student) => student.status === StudentStatus.TERMINATED,
    description:
      "Formaliza a solicitacao de exclusao do quadro de socios da ATRETU.",
    scope: "STUDENT",
    templateKey: "termination-letter",
    templateVersion: 1,
    title: "Carta de Desligamento",
    type: OfficialDocumentType.TERMINATION_LETTER,
    version: 1,
    signers: [
      {
        label: "Associado",
        required: true,
        role: "ACADEMICO",
        source: "STUDENT",
      },
    ],
  },
  [OfficialDocumentType.TERMINATION_TERM]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Notifica o associado sobre desligamento por inadimplencia e prazo para regularizacao.",
    scope: "STUDENT",
    templateKey: "termination-term",
    templateVersion: 1,
    title: "Termo de Desligamento da Associação ATRETU",
    type: OfficialDocumentType.TERMINATION_TERM,
    version: 1,
    signers: [
      {
        label: "Presidente da ATRETU",
        required: true,
        role: BoardMemberRole.PRESIDENT,
        source: "BOARD_ROLE",
      },
    ],
  },
  [OfficialDocumentType.INTERNAL_REGULATION]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Regimento institucional geral da ATRETU, com diretrizes administrativas, direitos, deveres e disposicoes finais.",
    scope: "INSTITUTIONAL",
    templateKey: "internal-regulation",
    templateVersion: 1,
    title: "Regimento Interno da ATRETU",
    type: OfficialDocumentType.INTERNAL_REGULATION,
    version: 1,
    signers: [
      {
        label: "Presidente da ATRETU",
        required: true,
        role: BoardMemberRole.PRESIDENT,
        source: "BOARD_ROLE",
      },
    ],
  },
} as const;

export function listOfficialDocumentDefinitions() {
  return Object.values(OFFICIAL_DOCUMENT_DEFINITIONS);
}

export function getOfficialDocumentDefinition(type: OfficialDocumentType) {
  const definition = OFFICIAL_DOCUMENT_DEFINITIONS[type];
  if (!definition) {
    throw new Error(`Documento oficial sem definicao estatica: ${type}`);
  }
  return definition;
}
