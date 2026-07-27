"use client";

import { ArrowRight, BookOpen, CircleDollarSign, FileText, IdCard } from "lucide-react";
import type { StudentDetail } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import type { StudentProfileTab } from "./student-profile-tabs";

export function StudentProfileOverview({
  onOpenTab,
  student,
}: {
  onOpenTab: (tab: StudentProfileTab) => void;
  student: StudentDetail;
}) {
  const enrollment = student.enrollments[0];
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className={cx(adminTheme.card, "p-5")}>
        <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
          Matricula atual
        </p>
        {enrollment ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Ano letivo" value={String(enrollment.academicYear.year)} />
            <Info label="Instituicao" value={enrollment.institution.name} />
            <Info label="Curso" value={enrollment.course} />
            <Info label="Serie" value={enrollment.grade} />
            <Info label="Turno" value={enrollment.shift.name} />
            <Info label="Atualizado" value={new Date(enrollment.updatedAt).toLocaleDateString("pt-BR")} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Sem matricula registrada.</p>
        )}
      </section>

      <section className={cx(adminTheme.card, "p-5")}>
        <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
          Atalhos operacionais
        </p>
        <div className="mt-4 grid gap-2">
          <Shortcut icon={BookOpen} label="Dados academicos" onClick={() => onOpenTab("academic")} />
          <Shortcut icon={CircleDollarSign} label="Faturas e boletos" onClick={() => onOpenTab("finance")} />
          <Shortcut icon={FileText} label="Documentos oficiais" onClick={() => onOpenTab("documents")} />
          <Shortcut icon={IdCard} label="Carteirinhas" onClick={() => onOpenTab("cards")} />
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={cx(adminTheme.softPanel, "min-w-0 p-4")}>
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Shortcut({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E]"
      onClick={onClick}
      type="button"
    >
      <span className="inline-flex items-center gap-2">
        <Icon size={16} strokeWidth={2.2} />
        {label}
      </span>
      <ArrowRight size={15} strokeWidth={2.2} />
    </button>
  );
}
