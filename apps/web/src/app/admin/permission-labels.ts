import type { PermissionCatalogItem, PermissionKey } from "../../lib/api";

export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  academicYears: "CADASTROS BASE",
  baseRecords: "CADASTROS BASE",
  collections: "COBRANÇA",
  dashboard: "DASHBOARD",
  finance: "FINANCEIRO",
  manualMovements: "MOVIMENTOS MANUAIS",
  officialDocuments: "DOCUMENTOS OFICIAIS",
  preRegistrations: "PRÉ-CADASTROS",
  reports: "RELATÓRIOS",
  studentCards: "CARTEIRINHAS",
  students: "ACADÊMICOS",
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "academicYears.manage": "Gerenciar anos letivos",
  "baseRecords.manage": "Gerenciar cadastros base",
  "baseRecords.view": "Visualizar cadastros base",
  "collections.manage": "Gerenciar cobrança",
  "collections.view": "Visualizar cobrança",
  "dashboard.view": "Visualizar dashboard",
  "finance.bankSlips.manage": "Gerenciar boletos",
  "finance.invoices.manage": "Gerenciar faturas",
  "finance.invoices.view": "Visualizar faturas",
  "manualMovements.manage": "Gerenciar movimentos manuais",
  "manualMovements.view": "Visualizar movimentos manuais",
  "officialDocuments.issue": "Emitir documentos oficiais",
  "officialDocuments.models.manage": "Gerenciar modelos",
  "officialDocuments.view": "Visualizar documentos oficiais",
  "preRegistrations.documents.view": "Visualizar documentos",
  "preRegistrations.review": "Revisar pré-cadastros",
  "preRegistrations.view": "Visualizar pré-cadastros",
  "reports.export": "Exportar relatórios",
  "reports.view": "Visualizar relatórios",
  "studentCards.invalidate": "Invalidar carteirinhas",
  "studentCards.issue": "Emitir carteirinhas",
  "studentCards.view": "Visualizar carteirinhas",
  "students.board.manage": "Gerenciar diretoria",
  "students.board.view": "Visualizar diretoria",
  "students.changeStatus": "Alterar situação do acadêmico",
  "students.create": "Criar acadêmico",
  "students.reenroll": "Rematricular acadêmico",
  "students.update": "Editar acadêmico",
  "students.view": "Visualizar acadêmicos",
};

const HIDDEN_PERMISSION_MODULES = new Set(["settings", "users"]);

export function visiblePermissionCatalog(catalog: PermissionCatalogItem[]) {
  return catalog.filter((permission) => !HIDDEN_PERMISSION_MODULES.has(permission.module));
}

export function permissionLabel(permissionKey: PermissionKey) {
  return PERMISSION_LABELS[permissionKey] ?? "Permissão administrativa";
}

export function permissionModuleLabel(module: string) {
  return PERMISSION_MODULE_LABELS[module] ?? "OUTRAS PERMISSÕES";
}

