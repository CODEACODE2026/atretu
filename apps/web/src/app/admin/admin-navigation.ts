"use client";

import {
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardList,
  FileJson,
  CreditCard,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  Settings,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type AdminArea =
  | "account"
  | "dashboard"
  | "students"
  | "reenrollments"
  | "student-cards"
  | "finance"
  | "official-documents"
  | "reports"
  | "settings"
  | "jobs"
  | "legacy-import"
  | "users"
  | "permission-profiles"
  | "pre-registrations"
  | "years"
  | "base";

export type AdminNavGroupKey =
  "academic" | "administration" | "management" | "overview";

export type AdminNavItem = {
  description: string;
  group: AdminNavGroupKey;
  icon: LucideIcon;
  key: AdminArea;
  label: string;
  restricted?: boolean;
};

export type AdminNavGroup = {
  key: AdminNavGroupKey;
  label: string;
  items: readonly AdminNavItem[];
};

export const ADMIN_NAV_ITEMS = [
  {
    description: "Visao geral",
    group: "overview",
    icon: LayoutDashboard,
    key: "dashboard",
    label: "Dashboard",
  },
  {
    description: "Academicos e matriculas",
    group: "academic",
    icon: Users,
    key: "students",
    label: "Academicos",
  },
  {
    description: "Cadastros recebidos para análise",
    group: "academic",
    icon: ClipboardCheck,
    key: "pre-registrations",
    label: "Pré-cadastros",
  },
  {
    description: "Renovacoes",
    group: "academic",
    icon: RefreshCw,
    key: "reenrollments",
    label: "Rematriculas",
  },
  {
    description: "Emissoes pendentes",
    group: "academic",
    icon: CreditCard,
    key: "student-cards",
    label: "Carteirinhas",
  },
  {
    description: "Faturas e cobranca",
    group: "management",
    icon: WalletCards,
    key: "finance",
    label: "Financeiro",
  },
  {
    description: "Institucionais e historico",
    group: "management",
    icon: FileText,
    key: "official-documents",
    label: "Documentos Oficiais",
  },
  {
    description: "Exportacoes operacionais",
    group: "management",
    icon: FileBarChart2,
    key: "reports",
    label: "Relatórios",
  },
  {
    description: "Instituições, turnos, ônibus e anos letivos",
    group: "administration",
    icon: ClipboardList,
    key: "base",
    label: "Cadastros Base",
  },
  {
    description: "Importação piloto JSON",
    group: "administration",
    icon: FileJson,
    key: "legacy-import",
    label: "Importação legado",
    restricted: true,
  },
  {
    description: "Dados oficiais da associacao",
    group: "administration",
    icon: Settings,
    key: "settings",
    label: "Configurações",
    restricted: true,
  },
  {
    description: "Contas e perfis",
    group: "administration",
    icon: UserCog,
    key: "users",
    label: "Usuários",
    restricted: true,
  },
  {
    description: "Perfis e permissões",
    group: "administration",
    icon: ShieldCheck,
    key: "permission-profiles",
    label: "Perfis",
    restricted: true,
  },
  {
    description: "Execucoes internas",
    group: "administration",
    icon: BriefcaseBusiness,
    key: "jobs",
    label: "Monitor de Jobs",
    restricted: true,
  },
] as const satisfies readonly AdminNavItem[];

export const ADMIN_NAV_GROUPS = [
  {
    key: "overview",
    label: "VISÃO GERAL",
  },
  {
    key: "academic",
    label: "ACADÊMICO",
  },
  {
    key: "management",
    label: "GESTÃO",
  },
  {
    key: "administration",
    label: "ADMINISTRAÇÃO",
  },
] as const satisfies ReadonlyArray<Pick<AdminNavGroup, "key" | "label">>;

export function groupAdminNavItems(
  items: readonly AdminNavItem[],
): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.key),
  })).filter((group) => group.items.length > 0);
}
