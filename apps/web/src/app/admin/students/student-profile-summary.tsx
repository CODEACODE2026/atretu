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
import type { StudentCardProfileSummary } from "./cards/student-card-display-utils";

export function StudentProfileSummary({
  cardSummary,
  documentSummary,
  student,
  transport,
}: {
  cardSummary: StudentCardProfileSummary;
  documentSummary?: { active: number; missing: number };
  student: StudentDetail;
  transport?: BusAssignmentRecord | null;
}) {
  const card = cardSummary.activeCard;
  const boardRole = student.activeBoardMembership?.role;
  const boardRoleLabel = boardRole ? boardMemberRoleLabel(boardRole) : null;
  const boardStartedAt = student.activeBoardMembership?.startedAt
    ? new Intl.DateTimeFormat("pt-BR").format(
        new Date(student.activeBoardMembership.startedAt),
      )
    : null;
  const items = [
    {
      icon: BadgeCheck,
      label: "Situação",
      tone: statusTone(student.status),
      value: statusLabel(student.status),
    },
    {
      icon: CircleDollarSign,
      label: "Financeiro",
      tone: student.canReceiveFutureInvoices ? "emerald" : "amber",
      value: student.canReceiveFutureInvoices ? "Elegível" : "Bloqueado",
    },
    {
      icon: Bus,
      label: "Transporte",
      tone: transport ? "emerald" : "slate",
      value: transport?.bus.name ?? "Sem vínculo",
    },
    {
      icon: IdCard,
      label: "Carteirinha",
      helper: card
        ? card.cardNumber
        : cardSummary.loading
          ? "Verificando..."
          : cardSummary.totalCards > 0
            ? `${cardSummary.historyCount} no histórico`
            : "Sem histórico",
      tone: card ? "emerald" : cardSummary.totalCards > 0 ? "amber" : "slate",
      value: card
        ? "Emitida"
        : cardSummary.loading
          ? "Carregando"
          : cardSummary.totalCards > 0
            ? "Sem ativa"
            : "Não emitida",
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
      helper: student.activeBoardMembership
        ? boardRole === "PRESIDENT"
          ? "Signatário de documentos: Presidente"
          : boardStartedAt
            ? `Início: ${boardStartedAt}`
            : "Cargo sem vigência informada"
        : undefined,
      tone: student.activeBoardMembership ? "emerald" : "slate",
      value: student.activeBoardMembership
        ? boardRoleLabel
          ? `Ativa · ${boardRoleLabel}`
          : "Ativa · Sem cargo definido"
        : "Inativa",
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
                {"helper" in item ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.helper}</p>
                ) : null}
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

function boardMemberRoleLabel(role: NonNullable<StudentDetail["activeBoardMembership"]>["role"]) {
  const labels = {
    MEMBER: "Membro",
    PRESIDENT: "Presidente",
    SECRETARY: "Secretário",
    TREASURER: "Tesoureiro",
    VICE_PRESIDENT: "Vice-presidente",
  } as const;
  return role ? labels[role] : null;
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
