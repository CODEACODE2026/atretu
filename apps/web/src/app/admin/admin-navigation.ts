"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  Database,
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
    description: "Periodos letivos",
    icon: CalendarDays,
    key: "years",
    label: "Anos Letivos",
  },
  {
    description: "Instituicoes, turnos e onibus",
    icon: Database,
    key: "base",
    label: "Cadastros Base",
  },
] as const satisfies readonly AdminNavItem[];
