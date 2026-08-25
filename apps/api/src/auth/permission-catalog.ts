export const PERMISSION_CATALOG = [
  {
    key: "dashboard.view",
    label: "Visualizar dashboard",
    module: "dashboard",
  },
  {
    key: "students.view",
    label: "Visualizar academicos",
    module: "students",
  },
  {
    key: "students.create",
    label: "Criar academicos",
    module: "students",
  },
  {
    key: "students.update",
    label: "Editar academicos",
    module: "students",
  },
  {
    key: "students.changeStatus",
    label: "Alterar status de academicos",
    module: "students",
  },
  {
    key: "students.reenroll",
    label: "Executar rematriculas",
    module: "students",
  },
  {
    key: "students.board.view",
    label: "Visualizar diretoria",
    module: "students",
  },
  {
    key: "students.board.manage",
    label: "Gerenciar diretoria",
    module: "students",
  },
  {
    key: "preRegistrations.view",
    label: "Visualizar pre-cadastros",
    module: "preRegistrations",
  },
  {
    key: "preRegistrations.review",
    label: "Revisar pre-cadastros",
    module: "preRegistrations",
  },
  {
    key: "preRegistrations.documents.view",
    label: "Visualizar documentos de pre-cadastro",
    module: "preRegistrations",
  },
  {
    key: "studentCards.view",
    label: "Visualizar carteirinhas",
    module: "studentCards",
  },
  {
    key: "studentCards.issue",
    label: "Emitir carteirinhas",
    module: "studentCards",
  },
  {
    key: "studentCards.invalidate",
    label: "Invalidar carteirinhas",
    module: "studentCards",
  },
  {
    key: "finance.invoices.view",
    label: "Visualizar faturas",
    module: "finance",
  },
  {
    key: "finance.invoices.manage",
    label: "Gerenciar faturas",
    module: "finance",
  },
  {
    key: "finance.bankSlips.manage",
    label: "Gerenciar boletos",
    module: "finance",
  },
  {
    key: "collections.view",
    label: "Visualizar cobranca",
    module: "collections",
  },
  {
    key: "collections.manage",
    label: "Gerenciar cobranca",
    module: "collections",
  },
  {
    key: "manualMovements.view",
    label: "Visualizar movimentos manuais",
    module: "manualMovements",
  },
  {
    key: "manualMovements.manage",
    label: "Gerenciar movimentos manuais",
    module: "manualMovements",
  },
  {
    key: "officialDocuments.view",
    label: "Visualizar documentos oficiais",
    module: "officialDocuments",
  },
  {
    key: "officialDocuments.issue",
    label: "Emitir documentos oficiais",
    module: "officialDocuments",
  },
  {
    key: "officialDocuments.models.manage",
    label: "Gerenciar modelos de documentos oficiais",
    module: "officialDocuments",
  },
  {
    key: "reports.view",
    label: "Visualizar relatorios",
    module: "reports",
  },
  {
    key: "reports.export",
    label: "Exportar relatorios",
    module: "reports",
  },
  {
    key: "baseRecords.view",
    label: "Visualizar cadastros base",
    module: "baseRecords",
  },
  {
    key: "baseRecords.manage",
    label: "Gerenciar cadastros base",
    module: "baseRecords",
  },
  {
    key: "academicYears.manage",
    label: "Gerenciar anos letivos",
    module: "academicYears",
  },
  {
    key: "settings.view",
    label: "Visualizar configuracoes",
    module: "settings",
  },
  {
    key: "settings.manage",
    label: "Gerenciar configuracoes",
    module: "settings",
  },
  {
    key: "users.view",
    label: "Visualizar usuarios",
    module: "users",
  },
  {
    key: "users.manage",
    label: "Gerenciar usuarios",
    module: "users",
  },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];

export const ACTIVE_DELEGATABLE_PERMISSION_KEYS = [
  "dashboard.view",
  "students.view",
  "students.create",
  "students.update",
  "students.changeStatus",
  "students.reenroll",
  "students.board.view",
  "students.board.manage",
  "preRegistrations.view",
  "preRegistrations.review",
  "preRegistrations.documents.view",
  "studentCards.view",
  "studentCards.issue",
  "studentCards.invalidate",
  "finance.invoices.view",
  "finance.invoices.manage",
  "collections.view",
  "collections.manage",
  "officialDocuments.view",
  "officialDocuments.issue",
  "baseRecords.view",
  "reports.view",
  "reports.export",
] as const satisfies readonly PermissionKey[];

export const RESERVED_PERMISSION_KEYS = [
  "settings.view",
  "settings.manage",
  "users.view",
  "users.manage",
] as const satisfies readonly PermissionKey[];

const RESERVED_PERMISSIONS = new Set<PermissionKey>(RESERVED_PERMISSION_KEYS);

export const PERMISSION_DEPENDENCIES: Partial<
  Record<PermissionKey, readonly PermissionKey[]>
> = {
  "academicYears.manage": ["baseRecords.view"],
  "baseRecords.manage": ["baseRecords.view"],
  "collections.manage": ["collections.view"],
  "finance.invoices.manage": ["finance.invoices.view"],
  "manualMovements.manage": ["manualMovements.view"],
  "officialDocuments.issue": ["officialDocuments.view"],
  "officialDocuments.models.manage": ["officialDocuments.view"],
  "preRegistrations.documents.view": ["preRegistrations.view"],
  "preRegistrations.review": ["preRegistrations.view"],
  "reports.export": ["reports.view"],
  "studentCards.invalidate": ["studentCards.view"],
  "studentCards.issue": ["studentCards.view"],
  "students.board.manage": ["students.board.view"],
  "students.update": ["students.view"],
};

export const DELEGATABLE_PERMISSION_CATALOG = PERMISSION_CATALOG.filter(
  (permission) => !RESERVED_PERMISSIONS.has(permission.key),
).map((permission) => ({
  ...permission,
  dependencies: [...(PERMISSION_DEPENDENCIES[permission.key] ?? [])],
}));

export type DelegatablePermissionKey =
  (typeof DELEGATABLE_PERMISSION_CATALOG)[number]["key"];

const PERMISSION_KEYS = new Set<string>(
  PERMISSION_CATALOG.map((permission) => permission.key),
);
const DELEGATABLE_PERMISSION_KEYS = new Set<string>(
  DELEGATABLE_PERMISSION_CATALOG.map((permission) => permission.key),
);
const ACTIVE_DELEGATABLE_PERMISSIONS = new Set<string>(
  ACTIVE_DELEGATABLE_PERMISSION_KEYS,
);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEYS.has(value);
}

export function isDelegatablePermissionKey(
  value: string,
): value is DelegatablePermissionKey {
  return DELEGATABLE_PERMISSION_KEYS.has(value);
}

export function isActiveDelegatablePermissionKey(
  value: string,
): value is (typeof ACTIVE_DELEGATABLE_PERMISSION_KEYS)[number] {
  return ACTIVE_DELEGATABLE_PERMISSIONS.has(value);
}
