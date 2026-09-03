import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("src/lib/api.ts", "utf8");
const auth = readFileSync("src/lib/auth.ts", "utf8");
const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");
const tab = readFileSync("src/app/admin/students/student-documents.tsx", "utf8");
const profile = readFileSync(
  "src/app/admin/students/student-profile-view.tsx",
  "utf8",
);
const official = readFileSync(
  "src/app/admin/students/student-official-documents.tsx",
  "utf8",
);
const institutional = readFileSync(
  "src/app/admin/official-documents-panel.tsx",
  "utf8",
);
const associationSettings = readFileSync(
  "src/app/admin/settings/association-settings-panel.tsx",
  "utf8",
);
const navigation = readFileSync("src/app/admin/admin-navigation.ts", "utf8");
const profileSummary = readFileSync(
  "src/app/admin/students/student-profile-summary.tsx",
  "utf8",
);
const actionDialogs = readFileSync(
  "src/app/admin/students/student-action-dialogs.tsx",
  "utf8",
);

for (const fragment of [
  "export type OfficialDocumentType",
  "OfficialDocumentCatalogItem",
  "templateKey",
  "templateVersion",
  "listStudentOfficialDocuments",
  "issueOfficialDocument",
  "reissueOfficialDocument",
  "downloadOfficialDocument",
  "formatApiErrorBody",
  "requestId",
  "signerDetails",
  "ADHESION_TERM",
  "ANNUAL_CLEARANCE_DECLARATION",
  "TRANSPORT_REGULATION",
  "TRANSPORT_REFUND_REQUEST",
  "adhesionDetails",
  "refundDetails",
  "annualClearanceDetails",
  "totalAmountCents",
  "finalClearanceDate",
  "year",
  "firstInstallmentDate",
  "installmentAmountCents",
  "installmentCount",
  "installmentDueDay",
  "totalContractAmountCents",
  "signerRoleLabel",
  "signerStudentId",
  "resolvedAt",
  "TERMINATION_LETTER",
  "TERMINATION_TERM",
  "INTERNAL_REGULATION",
  "DYNAMIC_TEMPLATE",
  "OfficialDocumentModel",
  "OfficialDocumentVariable",
  "IssueDynamicOfficialDocumentBody",
  "IssueOfficialDocumentBody",
  "refundAmountCents",
  "paymentMethod",
  "IssueInstitutionalOfficialDocumentBody",
  "OfficialDocumentIssueStatus",
  "OfficialDocumentIssuesResponse",
  "/official-documents",
  "listInstitutionalOfficialDocuments",
  "issueInstitutionalOfficialDocument",
  "reissueInstitutionalOfficialDocument",
  "downloadInstitutionalOfficialDocument",
  "listOfficialDocumentIssues",
  "invalidateOfficialDocument",
  "listOfficialDocumentModels",
  "createOfficialDocumentModel",
  "updateOfficialDocumentModel",
  "updateOfficialDocumentModelStatus",
  "duplicateOfficialDocumentModel",
  "listOfficialDocumentModelIssues",
  "previewDynamicOfficialDocument",
  "issueDynamicOfficialDocument",
  "listStudentOfficialDocumentModelIssues",
  "AssociationSettings",
  "getAssociationSettings",
  "updateAssociationSettings",
  "updateAssociationLogo",
  "downloadAssociationLogo",
]) {
  assert.ok(api.includes(fragment), `api client must include ${fragment}`);
}

for (const fragment of [
  '"officialDocuments.view"',
  '"officialDocuments.issue"',
  'area === "official-documents"',
  'return hasCapability(user, "officialDocuments.view")',
]) {
  assert.ok(auth.includes(fragment), `auth helpers must include ${fragment}`);
}

for (const fragment of [
  'nextArea === "official-documents"',
  "canAccessMigratedArea(user, nextArea)",
  "const effectiveArea = canAccessArea(area) ? area : fallbackArea",
]) {
  assert.ok(shell.includes(fragment), `admin shell must include ${fragment}`);
}

assert.ok(
  tab.includes("studentName={studentName}"),
  "Student documents tab must render official documents",
);
assert.ok(
  tab.includes("showOfficialDocuments ? ("),
  "Student documents tab must gate official documents separately",
);

for (const fragment of [
  'const canViewOfficialDocuments = hasCapability(user, "officialDocuments.view")',
  '...(canViewOfficialDocuments ? (["documents"] as const) : [])',
  "showOfficialDocuments={canViewOfficialDocuments}",
]) {
  assert.ok(profile.includes(fragment), `student profile must include ${fragment}`);
}

for (const fragment of [
  "Documentos Oficiais",
  "official-documents",
  "Configurações",
  "settings",
]) {
  assert.ok(navigation.includes(fragment), `navigation must include ${fragment}`);
}

for (const fragment of [
  "Configurações Institucionais",
  "Identificação",
  "Endereço",
  "Contato",
  "Identidade visual",
  "Salvar alterações",
  "Cancelar",
  "Alterar logo",
  "getAssociationSettings",
  "updateAssociationSettings",
  "updateAssociationLogo",
]) {
  assert.ok(
    associationSettings.includes(fragment),
    `association settings UI must include ${fragment}`,
  );
}

for (const fragment of [
  "Institucionais",
  "Modelos",
  "Emissão",
  "Emissão estudantil",
  "Documentos emitidos",
  "Todos",
  "Válidos",
  "Invalidados",
  "Novo modelo",
  "Inserir variável",
  "Assinaturas no documento",
  "Nenhuma",
  "Acadêmico + Diretoria",
  "Campos manuais",
  "Matrícula",
  "Instituição",
  "Associação",
  "Prévia",
  "Duplicar",
  "Inativar",
  "Regimento",
  "Emitir",
  "Visualizar",
  "Reemitir",
  "Baixar",
  "Histórico",
  "Histórico de versões",
  "Versão vigente",
  "Protocolo da versão",
  "Assinado por",
  "Emitir Regimento Interno",
  "Data de aprovação",
  "Observações",
  "signerPreview",
  'const canAccessInstitutionalDocuments = hasCapability(user, "officialDocuments.view")',
  'hasCapability(user, "officialDocuments.issue")',
  "canIssue={canIssueOfficialDocuments}",
  "canManageGlobalOfficialDocumentModels",
  "canManageModels",
  "StudentOfficialDocuments",
]) {
  assert.ok(
    institutional.includes(fragment),
    `institutional official documents UI must include ${fragment}`,
  );
}

for (const fragment of [
  "Documentos Oficiais",
  "Emitir documento",
  "Documentos emitidos por modelo",
  "Invalidar documento",
  "Documento invalidado",
  "DynamicModelIssueDialog",
  "Emitir",
  "Visualizar",
  "Reemitir",
  "Baixar PDF",
  "Protocolo",
  "Assinado por",
  "Emitir Termo de Desligamento",
  "Emitir Termo de Adesão e Filiação",
  "Emitir Declaração de Quitação Anual",
  "Ano de referência",
  "Valor total quitado",
  "Data da quitação final",
  "Emitir Solicitação de Reembolso",
  "Valor do reembolso",
  "Forma de recebimento",
  "Chave PIX",
  "Conta bancária",
  "Primeira mensalidade",
  "Valor da parcela",
  "Quantidade de parcelas",
  "Data do vencimento",
  "Data da notificacao",
  "Inadimplência",
  'hasCapability(user, "officialDocuments.issue")',
  "const canUseDynamicModels = canIssueOfficialDocuments",
  "canIssue={canIssueOfficialDocuments}",
]) {
  assert.ok(official.includes(fragment), `official documents UI must include ${fragment}`);
}

for (const fragment of [
  "Signatário de documentos: Presidente",
  "Alterar cargo da diretoria",
  "updateBoardMembershipRole",
]) {
  assert.ok(
    `${profileSummary}\n${actionDialogs}`.includes(fragment),
    `board signers UI must include ${fragment}`,
  );
}

for (const forbidden of ["window.confirm", "window.prompt", "window.alert"]) {
  assert.equal(
    `${official}\n${institutional}`.includes(forbidden),
    false,
    `official documents UI must not use ${forbidden}`,
  );
}

console.log("Official documents frontend guard OK");
