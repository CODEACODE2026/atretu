"use client";

import {
  BadgeCheck,
  Bus,
  CircleDollarSign,
  FileText,
  IdCard,
  ShieldCheck,
} from "lucide-react";
import type { BusAssignmentRecord, StudentDetail } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { statusLabel } from "./student-profile-utils";

export function StudentProfileSummary({
  documentSummary,
  student,
  transport,
}: {
  documentSummary?: { active: number; missing: number };
  student: StudentDetail;
  transport?: BusAssignmentRecord | null;
}) {
  const card = student.currentStudentCard;
  const items = [
    {
      icon: BadgeCheck,
      label: "Situacao",
      tone: statusTone(student.status),
      value: statusLabel(student.status),
    },
    {
      icon: CircleDollarSign,
      label: "Financeiro",
      tone: student.canReceiveFutureInvoices ? "emerald" : "amber",
      value: student.canReceiveFutureInvoices ? "Elegivel" : "Bloqueado",
    },
    {
      icon: Bus,
      label: "Transporte",
      tone: transport ? "emerald" : "slate",
      value: transport?.bus.name ?? "Sem vinculo",
    },
    {
      icon: IdCard,
      label: "Carteirinha",
      tone: card ? "emerald" : "slate",
      value: card?.cardNumber ?? "Nao emitida",
    },
    {
      icon: FileText,
      label: "Documentos",
      tone: documentSummary?.missing ? "amber" : documentSummary ? "emerald" : "slate",
      value: documentSummary
        ? `${documentSummary.active} ativos / ${documentSummary.missing} pendentes`
        : "Abrir aba",
    },
    {
      icon: ShieldCheck,
      label: "Diretoria",
      tone: student.activeBoardMembership ? "emerald" : "slate",
      value: student.activeBoardMembership ? "Ativa" : "Inativa",
    },
  ] as const;

  return (
    <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className={cx(adminTheme.card, "min-w-0 p-4")} key={item.label}>
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                  toneClass(item.tone),
                )}
              >
                <Icon size={17} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                  {item.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function statusTone(status: StudentDetail["status"]) {
  return status === "ACTIVE" ? "emerald" : status === "SUSPENDED" ? "amber" : "red";
}

function toneClass(tone: "amber" | "emerald" | "red" | "slate") {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return tones[tone];
}
