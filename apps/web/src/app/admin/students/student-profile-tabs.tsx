"use client";

import {
  BookOpen,
  Bus,
  CircleDollarSign,
  FileClock,
  FileText,
  IdCard,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import { adminTheme, cx } from "../admin-theme";

export type StudentProfileTab =
  | "overview"
  | "academic"
  | "finance"
  | "documents"
  | "transport"
  | "cards"
  | "history"
  | "personal";

export const studentProfileTabs: Array<{
  icon: typeof LayoutDashboard;
  key: StudentProfileTab;
  label: string;
}> = [
  { icon: LayoutDashboard, key: "overview", label: "Visao geral" },
  { icon: BookOpen, key: "academic", label: "Academico" },
  { icon: CircleDollarSign, key: "finance", label: "Financeiro" },
  { icon: FileText, key: "documents", label: "Documentos" },
  { icon: Bus, key: "transport", label: "Transporte" },
  { icon: IdCard, key: "cards", label: "Carteirinhas" },
  { icon: FileClock, key: "history", label: "Historico" },
  { icon: UserRound, key: "personal", label: "Dados pessoais" },
];

export function StudentProfileTabs({
  activeTab,
  loadedTabs,
  onChange,
  tabs = studentProfileTabs.map((tab) => tab.key),
}: {
  activeTab: StudentProfileTab;
  loadedTabs: Set<StudentProfileTab>;
  onChange: (tab: StudentProfileTab) => void;
  tabs?: StudentProfileTab[];
}) {
  return (
    <nav aria-label="Navegacao do perfil" className={cx(adminTheme.card, "p-2")}>
      <div className="flex flex-wrap gap-1">
        {studentProfileTabs.filter((tab) => tabs.includes(tab.key)).map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <button
              className={cx(
                "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition duration-150 motion-reduce:transition-none",
                active
                  ? "bg-[#0F2E2E] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#F2F8F6] hover:text-[#0F2E2E]",
              )}
              key={tab.key}
              onClick={() => onChange(tab.key)}
              type="button"
            >
              <Icon size={16} strokeWidth={2.2} />
              {tab.label}
              {loadedTabs.has(tab.key) && !active ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#1F6F5F]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
