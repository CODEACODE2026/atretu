import {
  BoardMemberRole,
  OfficialDocumentType,
  StudentStatus,
} from "@prisma/client";

export type OfficialDocumentSignerSource =
  | "BOARD_ROLE"
  | "EMISSOR"
  | "STUDENT";

export type OfficialDocumentSignerRole =
  | BoardMemberRole
  | "ACADEMICO"
  | "EMISSOR";

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

export const OFFICIAL_DOCUMENT_DEFINITIONS = {
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
} as const satisfies Record<OfficialDocumentType, OfficialDocumentDefinition>;

export function listOfficialDocumentDefinitions() {
  return Object.values(OFFICIAL_DOCUMENT_DEFINITIONS);
}

export function getOfficialDocumentDefinition(type: OfficialDocumentType) {
  return OFFICIAL_DOCUMENT_DEFINITIONS[type];
}
