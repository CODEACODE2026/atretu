export type OfficialDocumentVariableCategory =
  | "association"
  | "document"
  | "enrollment"
  | "input"
  | "institution"
  | "student";

export type OfficialDocumentVariableDefinition = {
  category: OfficialDocumentVariableCategory;
  label: string;
  manual?: boolean;
  token: string;
};

export const OFFICIAL_DOCUMENT_VARIABLES: OfficialDocumentVariableDefinition[] = [
  { category: "student", label: "Nome do acadêmico", token: "student.name" },
  { category: "student", label: "CPF do acadêmico", token: "student.cpf" },
  { category: "student", label: "Data de nascimento", token: "student.birthDate" },
  { category: "student", label: "Número da carteirinha", token: "student.cardNumber" },
  { category: "enrollment", label: "Ano letivo", token: "enrollment.academicYear" },
  { category: "enrollment", label: "Curso", token: "enrollment.course" },
  { category: "enrollment", label: "Série", token: "enrollment.series" },
  { category: "enrollment", label: "Turno", token: "enrollment.shift" },
  { category: "institution", label: "Instituição", token: "institution.name" },
  { category: "association", label: "Nome da associação", token: "association.name" },
  { category: "association", label: "CNPJ da associação", token: "association.cnpj" },
  { category: "document", label: "Data de emissão", token: "document.issueDate" },
  { category: "document", label: "Data de emissão por extenso", token: "document.issueDateLong" },
  { category: "input", label: "Nome do evento", manual: true, token: "input.eventName" },
  { category: "input", label: "Data do evento", manual: true, token: "input.eventDate" },
  { category: "input", label: "Responsável", manual: true, token: "input.responsibleName" },
] as const;

export const OFFICIAL_DOCUMENT_VARIABLE_TOKENS: Set<string> = new Set(
  OFFICIAL_DOCUMENT_VARIABLES.map((item) => item.token),
);

export function extractOfficialDocumentTemplateTokens(content: string) {
  const tokens = new Set<string>();
  for (const match of content.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+)\s*\}\}/g)) {
    if (match[1]) {
      tokens.add(match[1]);
    }
  }
  return [...tokens].sort();
}

export function invalidOfficialDocumentTemplateTokens(content: string) {
  return extractOfficialDocumentTemplateTokens(content).filter(
    (token) => !OFFICIAL_DOCUMENT_VARIABLE_TOKENS.has(token),
  );
}

export function manualOfficialDocumentTemplateTokens(content: string) {
  const manualTokens = new Set(
    OFFICIAL_DOCUMENT_VARIABLES.filter((item) => item.manual).map((item) => item.token),
  );
  return extractOfficialDocumentTemplateTokens(content).filter((token) =>
    manualTokens.has(token),
  );
}
