import { OfficialDocumentType, StudentStatus } from "@prisma/client";

export type OfficialDocumentDefinition = {
  blockedReason: string;
  description: string;
  templateKey: string;
  templateVersion: number;
  title: string;
  type: OfficialDocumentType;
  version: number;
  canIssue: (student: { status: StudentStatus }) => boolean;
};

export const OFFICIAL_DOCUMENT_DEFINITIONS = {
  [OfficialDocumentType.TERMINATION_LETTER]: {
    blockedReason: "Disponivel apos o desligamento do academico.",
    canIssue: (student) => student.status === StudentStatus.TERMINATED,
    description:
      "Formaliza a solicitacao de exclusao do quadro de socios da ATRETU.",
    templateKey: "termination-letter",
    templateVersion: 1,
    title: "Carta de Desligamento",
    type: OfficialDocumentType.TERMINATION_LETTER,
    version: 1,
  },
  [OfficialDocumentType.TERMINATION_TERM]: {
    blockedReason: "",
    canIssue: () => true,
    description:
      "Notifica o associado sobre desligamento por inadimplencia e prazo para regularizacao.",
    templateKey: "termination-term",
    templateVersion: 1,
    title: "Termo de Desligamento da Associação ATRETU",
    type: OfficialDocumentType.TERMINATION_TERM,
    version: 1,
  },
} as const satisfies Record<OfficialDocumentType, OfficialDocumentDefinition>;

export function listOfficialDocumentDefinitions() {
  return Object.values(OFFICIAL_DOCUMENT_DEFINITIONS);
}

export function getOfficialDocumentDefinition(type: OfficialDocumentType) {
  return OFFICIAL_DOCUMENT_DEFINITIONS[type];
}
