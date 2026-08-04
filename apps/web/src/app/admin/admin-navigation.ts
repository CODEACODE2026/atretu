"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  Database,
  FileBarChart2,
  LayoutDashboard,
  RefreshCw,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type AdminArea =
  | "dashboard"
  | "students"
  | "reenrollments"
  | "student-cards"
  | "finance"
  | "reports"
  | "jobs"
  | "pre-registrations"
  | "years"
  | "base";

export type AdminNavItem = {
  description: string;
  icon: LucideIcon;
  key: AdminArea;
  label: string;
  restricted?: boolean;
};

export const ADMIN_NAV_ITEMS = [
  {
    description: "Visao geral",
    icon: LayoutDashboard,
    key: "dashboard",
    label: "Dashboard",
  },
  {
    description: "Academicos e matriculas",
    icon: Users,
    key: "students",
    label: "Academicos",
  },
  {
    description: "Renovacoes",
    icon: RefreshCw,
    key: "reenrollments",
    label: "Rematriculas",
  },
  {
    description: "Emissoes pendentes",
    icon: CreditCard,
    key: "student-cards",
    label: "Carteirinhas",
  },
  {
    description: "Faturas e cobranca",
    icon: WalletCards,
    key: "finance",
    label: "Financeiro",
  },
  {
    description: "Exportacoes operacionais",
    icon: FileBarChart2,
    key: "reports",
    label: "Relatórios",
  },
  {
    description: "Execucoes internas",
    icon: BriefcaseBusiness,
    key: "jobs",
    label: "Monitor de Jobs",
    restricted: true,
  },
  {
    description: "Solicitacoes publicas",
    icon: BadgeCheck,
    key: "pre-registrations",
    label: "Pre-cadastros",
  },
  {
    description: "Períodos letivos",
    icon: CalendarDays,
    key: "years",
    label: "Anos letivos",
  },
  {
    description: "Instituições, turnos e ônibus",
    icon: Database,
    key: "base",
    label: "Cadastros base",
  },
] as const satisfies readonly AdminNavItem[];
