"use client";

import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Edit3,
  PauseCircle,
  PlayCircle,
  UserRound,
} from "lucide-react";
import type { StudentCardRecord, StudentDetail } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { maskCpf } from "../../../lib/formatters";
import { statusLabel } from "./student-profile-utils";
import type { StudentCardRequirement } from "./cards/student-card-display-utils";
import { cardTypeLabel } from "./cards/student-card-display-utils";

export type StudentProfileAction =
  | "edit"
  | "suspend"
  | "reactivate"
  | "terminate"
  | "reinstate"
  | "start-board"
  | "update-board-role"
  | "end-board";

export function StudentProfileHeader({
  activeCard,
  canBoardManage,
  canChangeStatus,
  canUpdate,
  canUpdateBoardRole,
  menuOpen,
  onAction,
  onBack,
  onToggleMenu,
  pendingRequirement,
  student,
}: {
  activeCard?: StudentCardRecord | null;
  canBoardManage: boolean;
  canChangeStatus: boolean;
  canUpdate: boolean;
  canUpdateBoardRole: boolean;
  menuOpen: boolean;
  onAction: (action: StudentProfileAction) => void;
  onBack: () => void;
  onToggleMenu: () => void;
  pendingRequirement?: StudentCardRequirement | null;
  student: StudentDetail;
}) {
  const enrollment = student.enrollments[0];
  const canSuspend = student.status === "ACTIVE";
  const canReactivate = student.status === "SUSPENDED";

  return (
    <section className={cx(adminTheme.card, "relative min-w-0 p-5 sm:p-6")}>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#1F6F5F]"
      />
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            className={cx(adminTheme.secondaryButton, "mb-5 w-fit")}
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={17} strokeWidth={2.2} />
            Acadêmicos
          </button>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#EEF7F4] text-[#14534D] ring-1 ring-[#D8E9E4]">
              <UserRound size={25} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
                Perfil acadêmico
              </p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
                {student.person.fullName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {activeCard
                  ? `Carteirinha ${activeCard.cardNumber}`
                  : pendingRequirement
                    ? `Carteirinha de ${cardTypeLabel(
                        pendingRequirement.cardType,
                      )} pendente`
                    : "Sem carteirinha ativa"}{" "}
                ·{" "}
                {maskCpf(student.person.cpf)}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                {enrollment
                  ? `${enrollment.institution.name} · ${enrollment.course} · Série ${enrollment.grade} · ${enrollment.shift.name}`
                  : "Sem matrícula atual"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <HeaderBadge status={student.status} />
            {student.activeBoardMembership ? (
              <NeutralBadge
                label={
                  student.activeBoardMembership.role === "PRESIDENT"
                    ? "Diretoria ativa · Signatário: Presidente"
                    : "Diretoria ativa"
                }
              />
            ) : null}
            {student.canReceiveFutureInvoices ? (
              <NeutralBadge label="Financeiro elegível" />
            ) : (
              <WarningBadge label="Financeiro bloqueado" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {canUpdate ? (
            <button
              className={adminTheme.secondaryButton}
              onClick={() => onAction("edit")}
              type="button"
            >
              <Edit3 size={16} strokeWidth={2.2} />
              Editar
            </button>
          ) : null}
          {canChangeStatus && canSuspend ? (
            <button
              className={adminTheme.secondaryButton}
              onClick={() => onAction("suspend")}
              type="button"
            >
              <PauseCircle size={16} strokeWidth={2.2} />
              Suspender
            </button>
          ) : null}
          {canChangeStatus && canReactivate ? (
            <button
              className={adminTheme.secondaryButton}
              onClick={() => onAction("reactivate")}
              type="button"
            >
              <PlayCircle size={16} strokeWidth={2.2} />
              Reativar
            </button>
          ) : null}
          {canChangeStatus || canBoardManage || canUpdateBoardRole ? (
          <div className="relative">
            <button
              className={adminTheme.secondaryButton}
              onClick={onToggleMenu}
              type="button"
            >
              Mais ações
              <ChevronDown size={16} strokeWidth={2.2} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                {canChangeStatus ? (
                  <>
                    <MenuButton label="Desligar" onClick={() => onAction("terminate")} />
                    <MenuButton label="Religar" onClick={() => onAction("reinstate")} />
                  </>
                ) : null}
                {student.activeBoardMembership ? (
                  <>
                    {canUpdateBoardRole ? (
                      <MenuButton
                        label="Alterar cargo da diretoria"
                        onClick={() => onAction("update-board-role")}
                      />
                    ) : null}
                    {canBoardManage ? (
                      <MenuButton
                        label="Remover da diretoria"
                        onClick={() => onAction("end-board")}
                      />
                    ) : null}
                  </>
                ) : canBoardManage ? (
                  <MenuButton
                    label="Adicionar a diretoria"
                    onClick={() => onAction("start-board")}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="block w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-[#F2F8F6] hover:text-[#0F2E2E]"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function HeaderBadge({ status }: { status: StudentDetail["status"] }) {
  const tone =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "SUSPENDED"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800";
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", tone)}>
      <BadgeCheck size={14} strokeWidth={2.2} />
      {statusLabel(status)}
    </span>
  );
}

function NeutralBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#B8D6CF] bg-[#EEF7F4] px-2.5 py-1 text-xs font-semibold text-[#14534D]">
      {label}
    </span>
  );
}

function WarningBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      {label}
    </span>
  );
}
