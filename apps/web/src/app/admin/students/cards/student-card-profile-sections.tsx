"use client";

import {
  Download,
  Eye,
  IdCard,
  Printer,
  ShieldCheck,
} from "lucide-react";
import type { StudentCardRecord, StudentDetail } from "../../../../lib/api";
import { formatDate, formatDateTime } from "../../../../lib/formatters/date";
import { adminTheme, cx } from "../../admin-theme";
import {
  cardStatusBadgeClass,
  cardStatusLabel,
  cardTypeLabel,
  invalidationReasonLabel,
  type StudentCardRequirement,
  usabilityLabel,
} from "./student-card-display-utils";

type PdfAction = "view" | "download" | "print";

type CardActionProps = {
  busyAction: string;
  card: StudentCardRecord;
  onPdf: (card: StudentCardRecord, action: PdfAction) => void;
};

export function StudentCardCurrentSummary({
  activeCard,
  pendingRequirement,
  student,
  totalCards,
}: {
  activeCard: StudentCardRecord | null;
  pendingRequirement?: StudentCardRequirement | null;
  student: StudentDetail;
  totalCards: number;
}) {
  const currentEnrollment = student.enrollments[0];
  return (
    <section className={cx(adminTheme.softPanel, "grid gap-4 p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
            Resumo da carteirinha atual
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {activeCard
              ? `Carteirinha ${activeCard.cardNumber}`
              : pendingRequirement
                ? `Carteirinha de ${cardTypeLabel(
                    pendingRequirement.cardType,
                  )} pendente`
                : "Sem carteirinha ativa"}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {activeCard
              ? "Carteirinha ativa, válida e vinculada ao contexto acadêmico atual."
              : pendingRequirement
                ? `O acadêmico precisa emitir a carteirinha de ${cardTypeLabel(
                    pendingRequirement.cardType,
                  )} para a matrícula atual.`
              : totalCards > 0
                ? "Há carteirinhas no histórico, mas nenhuma está ativa para a matrícula atual."
                : "Nenhuma carteirinha foi emitida para este acadêmico."}
          </p>
        </div>
        <span
          className={cx(
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            activeCard
              ? "bg-emerald-50 text-emerald-700"
              : pendingRequirement
                ? "bg-amber-50 text-amber-700"
              : totalCards > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {activeCard
            ? "Emitida"
            : pendingRequirement
              ? "Pendente de emissão"
              : totalCards > 0
                ? "Sem carteirinha ativa"
                : "Não emitida"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StudentCardDetail label="Número" value={activeCard?.cardNumber ?? "-"} />
        <StudentCardDetail
          label="Tipo"
          value={
            activeCard
              ? cardTypeLabel(activeCard.cardType)
              : pendingRequirement
                ? cardTypeLabel(pendingRequirement.cardType)
                : "-"
          }
        />
        <StudentCardDetail label="Situação" value={activeCard ? cardStatusLabel(activeCard) : "-"} />
        <StudentCardDetail
          label="Ano"
          value={String(activeCard?.academicYear.year ?? currentEnrollment?.academicYear.year ?? "-")}
        />
        <StudentCardDetail
          label="Emissão"
          value={activeCard ? formatDateTime(activeCard.issuedAt) : "-"}
        />
        <StudentCardDetail label="Validade" value={activeCard ? usabilityLabel(activeCard) : "-"} />
        <StudentCardDetail
          label="Foto"
          value="Foto opcional ou imagem padrão"
        />
        <StudentCardDetail
          label="Instituição"
          value={activeCard?.enrollment.institution.name ?? currentEnrollment?.institution.name ?? "-"}
        />
        <StudentCardDetail
          label="Curso"
          value={activeCard?.enrollment.course ?? currentEnrollment?.course ?? "-"}
        />
        <StudentCardDetail
          label="Série"
          value={activeCard?.enrollment.grade ?? currentEnrollment?.grade ?? "-"}
        />
        <StudentCardDetail
          label="Turno"
          value={activeCard?.enrollment.shift.name ?? currentEnrollment?.shift.name ?? "-"}
        />
      </div>
    </section>
  );
}

export function StudentActiveCard({
  busyAction,
  card,
  onPdf,
}: CardActionProps) {
  return (
    <article className={cx(adminTheme.card, "grid gap-4 p-4 ring-1 ring-[#B8D6CF]")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
            Carteirinha ativa
          </p>
          <h4 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-950">
            {card.cardNumber}
            <span className={cardStatusBadgeClass(card)}>Ativa</span>
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Utilizável
            </span>
          </h4>
          <p className="mt-1 text-sm text-slate-500">Ano {card.academicYear.year}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#EEF7F4] text-[#14534D] ring-1 ring-[#D8E9E4]">
          <IdCard size={24} strokeWidth={2.2} />
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StudentCardDetail label="Tipo" value={cardTypeLabel(card.cardType)} />
        <StudentCardDetail label="Instituição" value={card.enrollment.institution.name} />
        <StudentCardDetail label="Curso" value={card.enrollment.course} />
        <StudentCardDetail label="Série" value={card.enrollment.grade} />
        <StudentCardDetail label="Turno" value={card.enrollment.shift.name} />
        <StudentCardDetail label="Emissão" value={formatDateTime(card.issuedAt)} />
        <StudentCardDetail label="Validade" value={usabilityLabel(card)} />
        <StudentCardDetail label="Foto" value="Foto opcional ou imagem padrão" />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className={adminTheme.primaryButton}
          disabled={Boolean(busyAction)}
          onClick={() => onPdf(card, "view")}
          type="button"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {busyAction === `${card.id}:view` ? "Abrindo..." : "Visualizar carteirinha"}
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            className={adminTheme.secondaryButton}
            disabled={Boolean(busyAction)}
            onClick={() => onPdf(card, "download")}
            type="button"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busyAction === `${card.id}:download` ? "Baixando..." : "Baixar PDF"}
          </button>
          <button
            className={adminTheme.secondaryButton}
            disabled={Boolean(busyAction)}
            onClick={() => onPdf(card, "print")}
            type="button"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            {busyAction === `${card.id}:print` ? "Abrindo..." : "Imprimir"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function StudentCardHistory({
  busyAction,
  cards,
  onPdf,
}: {
  busyAction: string;
  cards: StudentCardRecord[];
  onPdf: (card: StudentCardRecord, action: PdfAction) => void;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-950">Histórico de carteirinhas</h4>
        <p className="mt-1 text-xs text-slate-500">
          Carteirinhas antigas, substituídas ou invalidadas não competem com a ativa.
        </p>
      </div>
      {cards.length === 0 ? (
        <div className={cx(adminTheme.softPanel, "p-4 text-sm text-slate-600")}>
          Nenhuma carteirinha no histórico.
        </div>
      ) : (
        cards.map((card) => (
          <article className={cx(adminTheme.card, "grid gap-3 p-4 text-sm")} key={card.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{card.cardNumber}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {cardTypeLabel(card.cardType)} · Ano {card.academicYear.year}
                </p>
              </div>
              <span className={cardStatusBadgeClass(card)}>{cardStatusLabel(card)}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StudentCardDetail label="Emissão" value={formatDateTime(card.issuedAt)} />
              <StudentCardDetail
                label="Invalidação"
                value={card.invalidatedAt ? formatDateTime(card.invalidatedAt) : "-"}
              />
              <StudentCardDetail
                label="Motivo"
                value={card.status === "INVALIDATED" ? invalidationReasonLabel(card.invalidationReason) : usabilityLabel(card)}
              />
              <StudentCardDetail label="Instituição" value={card.enrollment.institution.name} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={adminTheme.secondaryButton}
                disabled={Boolean(busyAction)}
                onClick={() => onPdf(card, "view")}
                type="button"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {busyAction === `${card.id}:view` ? "Abrindo..." : "Visualizar histórico"}
              </button>
              <button
                className={adminTheme.secondaryButton}
                disabled={Boolean(busyAction)}
                onClick={() => onPdf(card, "download")}
                type="button"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {busyAction === `${card.id}:download` ? "Baixando..." : "Baixar PDF"}
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

export function StudentCardNoActiveState({
  onIssue,
  onPreview,
  pendingRequirement,
  saving,
  totalCards,
}: {
  onIssue?: () => void;
  onPreview?: () => void;
  pendingRequirement?: StudentCardRequirement | null;
  saving?: boolean;
  totalCards: number;
}) {
  return (
    <div className={cx(adminTheme.card, "grid gap-3 p-5 text-sm text-slate-600")}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">
        <ShieldCheck size={22} strokeWidth={2.2} />
      </span>
      <div>
        <p className="font-semibold text-slate-950">
          {pendingRequirement
            ? `Carteirinha de ${cardTypeLabel(
                pendingRequirement.cardType,
              )} pendente de emissão`
            : totalCards > 0
              ? "Sem carteirinha ativa"
              : "Não emitida"}
        </p>
        <p className="mt-1 text-slate-500">
          {pendingRequirement
            ? `O acadêmico está elegível para emitir a carteirinha de ${cardTypeLabel(
                pendingRequirement.cardType,
              )} no fluxo atual.`
            : totalCards > 0
              ? "Existe histórico de carteirinhas, mas nenhuma está ativa e utilizável para a matrícula atual."
              : "A carteirinha será exibida aqui quando for gerada pelo fluxo atual."}
        </p>
      </div>
      {pendingRequirement && (onPreview || onIssue) ? (
        <div className="flex flex-wrap gap-2">
          {onPreview ? (
            <button
              className={cx(adminTheme.secondaryButton, "w-fit")}
              disabled={saving}
              onClick={onPreview}
              type="button"
            >
              Visualizar prévia
            </button>
          ) : null}
          {onIssue ? (
            <button
              className={cx(adminTheme.primaryButton, "w-fit")}
              disabled={saving}
              onClick={onIssue}
              type="button"
            >
              <IdCard className="h-4 w-4" aria-hidden="true" />
              {saving ? "Emitindo..." : "Emitir carteirinha"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StudentCardDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-white px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
