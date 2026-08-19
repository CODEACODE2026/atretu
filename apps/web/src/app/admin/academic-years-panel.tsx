"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { api, type AcademicYear, type ApiUser } from "../../lib/api";
import { canAccessRestrictedAdmin } from "../../lib/auth";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminConfirmDialog,
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
  AdminSummaryCard,
} from "./components/admin-ui";

type YearStatusFilter = "active" | "archived" | "all";
type YearAction = "set-current" | "archive" | "reactivate" | "delete";
type PendingYearAction = {
  action: YearAction;
  item: AcademicYear;
} | null;

const yearStatusLabels: Record<YearStatusFilter, string> = {
  active: "Ativos",
  archived: "Arquivados",
  all: "Todos",
};

export function AcademicYearsPanel({
  embedded = false,
  user,
}: {
  embedded?: boolean;
  user: ApiUser;
}) {
  const canWrite = canAccessRestrictedAdmin(user);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [summaryYears, setSummaryYears] = useState<AcademicYear[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isCurrent, setIsCurrent] = useState(false);
  const [status, setStatus] = useState<YearStatusFilter>("active");
  const [editingId, setEditingId] = useState("");
  const [editingYear, setEditingYear] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingYearAction>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const current = summaryYears.find((item) => item.isCurrent);
    return {
      active: summaryYears.filter((item) => item.status === "ACTIVE").length,
      archived: summaryYears.filter((item) => item.status === "ARCHIVED")
        .length,
      current,
    };
  }, [summaryYears]);

  useEffect(() => {
    void loadYears();
  }, [status]);

  async function loadYears() {
    setLoading(true);
    setError("");
    try {
      const [response, summaryResponse] = await Promise.all([
        api.listAcademicYears({ status }),
        api.listAcademicYears({ status: "all" }),
      ]);
      setYears(response.data);
      setSummaryYears(summaryResponse.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.createAcademicYear({ year: Number(year), isCurrent });
      setMessage("Ano letivo salvo");
      setIsCurrent(false);
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: AcademicYear) {
    setEditingId(item.id);
    setEditingYear(String(item.year));
    setMessage("");
    setError("");
  }

  async function saveEdit(item: AcademicYear) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.updateAcademicYear(item.id, { year: Number(editingYear) });
      setMessage("Ano letivo atualizado");
      setEditingId("");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmYearAction() {
    if (!pendingAction) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { action, item } = pendingAction;
      if (action === "set-current") {
        await api.setCurrentAcademicYear(item.id);
        setMessage("Ano letivo atual atualizado");
      } else if (action === "archive") {
        await api.archiveAcademicYear(item.id);
        setMessage("Ano letivo arquivado");
      } else if (action === "reactivate") {
        await api.reactivateAcademicYear(item.id);
        setMessage("Ano letivo reativado");
      } else {
        await api.deleteAcademicYear(item.id);
        setMessage("Ano letivo excluído");
      }
      setPendingAction(null);
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  const dialog = pendingAction ? getYearDialog(pendingAction) : null;

  return (
    <div className="grid min-w-0 gap-5">
      {!embedded ? (
        <AdminModuleHeader
          description="Organize os períodos letivos disponíveis para matrículas, rematrículas, carteirinhas e consultas operacionais."
          eyebrow="Configuração acadêmica"
          icon={CalendarDays}
          title="Anos letivos"
        />
      ) : null}

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <AdminSummaryCard
          description="Referência principal dos fluxos atuais."
          icon={Star}
          label="Ano atual"
          tone="blue"
          value={summary.current?.year ?? "-"}
        />
        <AdminSummaryCard
          description="Disponíveis para novos fluxos."
          icon={CheckCircle2}
          label="Anos ativos"
          tone="green"
          value={summary.active}
        />
        <AdminSummaryCard
          description="Mantidos para histórico e auditoria."
          icon={Archive}
          label="Arquivados"
          tone="slate"
          value={summary.archived}
        />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.36fr)_minmax(0,1fr)]">
        <form
          className={cx(adminTheme.card, "min-w-0 p-4")}
          onSubmit={handleSubmit}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <Plus aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">
                Novo ano letivo
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Cadastre o período e marque como atual quando ele deve assumir
                os fluxos principais.
              </p>
            </div>
          </div>

          {!canWrite ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Secretaria pode consultar e selecionar anos letivos.
            </p>
          ) : null}

          <label className="mt-5 block text-sm font-medium text-slate-700">
            Ano
            <input
              className={cx(adminTheme.control, "mt-1 w-full")}
              disabled={!canWrite}
              max={2100}
              min={2000}
              onChange={(event) => setYear(event.target.value)}
              required
              type="number"
              value={year}
            />
          </label>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm font-medium text-slate-700">
            <input
              checked={isCurrent}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              disabled={!canWrite}
              onChange={(event) => setIsCurrent(event.target.checked)}
              type="checkbox"
            />
            Definir como atual
          </label>

          <button
            className={cx(
              adminTheme.primaryButton,
              "mt-5 w-full justify-center",
            )}
            disabled={!canWrite || saving}
            type="submit"
          >
            {saving ? "Salvando..." : "Salvar ano letivo"}
          </button>
        </form>

        <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
          <AdminSectionHeader
            action={
              <select
                className={cx(adminTheme.control, "w-full md:w-auto")}
                onChange={(event) =>
                  setStatus(event.target.value as YearStatusFilter)
                }
                value={status}
              >
                <option value="active">Ativos</option>
                <option value="archived">Arquivados</option>
                <option value="all">Todos</option>
              </select>
            }
            description={`Mostrando: ${yearStatusLabels[status].toLowerCase()}.`}
            title="Anos cadastrados"
          />

          {message ? (
            <AdminFeedback tone="green">{message}</AdminFeedback>
          ) : null}
          {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}

          <div className="hidden max-w-full overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ano</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Atual</th>
                  <th className="px-4 py-3 font-semibold">Arquivado em</th>
                  <th className="px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={5}>
                      <AdminEmptyState
                        loading
                        title="Carregando anos letivos"
                      />
                    </td>
                  </tr>
                ) : years.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={5}>
                      <AdminEmptyState
                        description="Ajuste o filtro ou cadastre um novo ano letivo."
                        title="Nenhum ano letivo encontrado"
                      />
                    </td>
                  </tr>
                ) : (
                  years.map((item) => (
                    <YearDesktopRow
                      canWrite={canWrite}
                      editingId={editingId}
                      editingYear={editingYear}
                      item={item}
                      key={item.id}
                      onBeginEdit={beginEdit}
                      onCancelEdit={() => setEditingId("")}
                      onEditYearChange={setEditingYear}
                      onRequestAction={(action) =>
                        setPendingAction({ action, item })
                      }
                      onSaveEdit={saveEdit}
                      saving={saving}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {loading ? (
              <AdminEmptyState loading title="Carregando anos letivos" />
            ) : years.length === 0 ? (
              <AdminEmptyState
                description="Ajuste o filtro ou cadastre um novo ano letivo."
                title="Nenhum ano letivo encontrado"
              />
            ) : (
              years.map((item) => (
                <YearMobileCard
                  canWrite={canWrite}
                  editingId={editingId}
                  editingYear={editingYear}
                  item={item}
                  key={item.id}
                  onBeginEdit={beginEdit}
                  onCancelEdit={() => setEditingId("")}
                  onEditYearChange={setEditingYear}
                  onRequestAction={(action) =>
                    setPendingAction({ action, item })
                  }
                  onSaveEdit={saveEdit}
                  saving={saving}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {dialog ? (
        <AdminConfirmDialog
          confirmLabel={dialog.confirmLabel}
          description={dialog.description}
          disabled={saving}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmYearAction()}
          title={dialog.title}
          tone={dialog.tone}
        />
      ) : null}
    </div>
  );
}

function YearDesktopRow({
  canWrite,
  editingId,
  editingYear,
  item,
  onBeginEdit,
  onCancelEdit,
  onEditYearChange,
  onRequestAction,
  onSaveEdit,
  saving,
}: YearRowProps) {
  return (
    <tr className="align-top transition-colors hover:bg-slate-50/70">
      <td className="px-4 py-3 font-medium text-slate-950">
        {editingId === item.id ? (
          <input
            className={cx(adminTheme.control, "w-28")}
            max={2100}
            min={2000}
            onChange={(event) => onEditYearChange(event.target.value)}
            type="number"
            value={editingYear}
          />
        ) : (
          item.year
        )}
      </td>
      <td className="px-4 py-3">
        <YearStatusBadge item={item} />
      </td>
      <td className="px-4 py-3">
        <AdminStatusBadge tone={item.isCurrent ? "blue" : "slate"}>
          {item.isCurrent ? "Atual" : "Não"}
        </AdminStatusBadge>
      </td>
      <td className="px-4 py-3 text-slate-600">{formatArchivedAt(item)}</td>
      <td className="px-4 py-3">
        <YearActions
          canWrite={canWrite}
          editing={editingId === item.id}
          item={item}
          onBeginEdit={onBeginEdit}
          onCancelEdit={onCancelEdit}
          onRequestAction={onRequestAction}
          onSaveEdit={onSaveEdit}
          saving={saving}
        />
      </td>
    </tr>
  );
}

function YearMobileCard(props: YearRowProps) {
  const { editingId, editingYear, item, onEditYearChange } = props;

  return (
    <article className="grid min-w-0 gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Ano letivo
          </p>
          <div className="mt-1 font-semibold text-slate-950">
            {editingId === item.id ? (
              <input
                className={cx(adminTheme.control, "w-28")}
                max={2100}
                min={2000}
                onChange={(event) => onEditYearChange(event.target.value)}
                type="number"
                value={editingYear}
              />
            ) : (
              item.year
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Arquivado em: {formatArchivedAt(item)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <YearStatusBadge item={item} />
          <AdminStatusBadge tone={item.isCurrent ? "blue" : "slate"}>
            {item.isCurrent ? "Atual" : "Não"}
          </AdminStatusBadge>
        </div>
      </div>
      <YearActions {...props} editing={editingId === item.id} />
    </article>
  );
}

type YearRowProps = {
  canWrite: boolean;
  editingId: string;
  editingYear: string;
  item: AcademicYear;
  onBeginEdit: (item: AcademicYear) => void;
  onCancelEdit: () => void;
  onEditYearChange: (value: string) => void;
  onRequestAction: (action: YearAction) => void;
  onSaveEdit: (item: AcademicYear) => Promise<void>;
  saving: boolean;
};

function YearActions({
  canWrite,
  editing,
  item,
  onBeginEdit,
  onCancelEdit,
  onRequestAction,
  onSaveEdit,
  saving,
}: Omit<YearRowProps, "editingId" | "editingYear" | "onEditYearChange"> & {
  editing: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {editing ? (
        <>
          <button
            className={adminTheme.secondaryButton}
            disabled={!canWrite || saving}
            onClick={() => void onSaveEdit(item)}
            type="button"
          >
            Salvar
          </button>
          <button
            className={adminTheme.secondaryButton}
            onClick={onCancelEdit}
            type="button"
          >
            Cancelar
          </button>
        </>
      ) : (
        <button
          className={adminTheme.secondaryButton}
          disabled={!canWrite || saving || !item.canEditYear}
          onClick={() => onBeginEdit(item)}
          type="button"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Editar
        </button>
      )}
      <button
        className={adminTheme.secondaryButton}
        disabled={!canWrite || saving || !item.canSetCurrent}
        onClick={() => onRequestAction("set-current")}
        type="button"
      >
        <Star aria-hidden="true" className="h-4 w-4" />
        Definir atual
      </button>
      {item.status === "ACTIVE" ? (
        <button
          className={adminTheme.secondaryButton}
          disabled={!canWrite || saving || !item.canArchive}
          onClick={() => onRequestAction("archive")}
          type="button"
        >
          <Archive aria-hidden="true" className="h-4 w-4" />
          Arquivar
        </button>
      ) : (
        <button
          className={adminTheme.secondaryButton}
          disabled={!canWrite || saving || !item.canReactivate}
          onClick={() => onRequestAction("reactivate")}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Reativar
        </button>
      )}
      <button
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canWrite || saving || !item.canDelete}
        onClick={() => onRequestAction("delete")}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Excluir
      </button>
    </div>
  );
}

function YearStatusBadge({ item }: { item: AcademicYear }) {
  return (
    <AdminStatusBadge tone={item.status === "ACTIVE" ? "green" : "slate"}>
      {item.status === "ACTIVE" ? "Ativo" : "Arquivado"}
    </AdminStatusBadge>
  );
}

function formatArchivedAt(item: AcademicYear) {
  return item.archivedAt
    ? new Date(item.archivedAt).toLocaleDateString("pt-BR")
    : "-";
}

function getYearDialog({ action, item }: Exclude<PendingYearAction, null>) {
  if (action === "set-current") {
    return {
      confirmLabel: "Definir atual",
      description: `Definir ${item.year} como ano letivo atual? Os demais deixam de ser atuais.`,
      title: "Definir ano atual",
      tone: "blue" as const,
    };
  }
  if (action === "archive") {
    return {
      confirmLabel: "Arquivar",
      description: `Arquivar ${item.year}? Ele continuará nos históricos, mas não aparecerá em novos fluxos.`,
      title: "Arquivar ano letivo",
      tone: "orange" as const,
    };
  }
  if (action === "reactivate") {
    return {
      confirmLabel: "Reativar",
      description: `Reativar ${item.year}? Ele voltará a aparecer em novos fluxos, mas não será marcado como atual automaticamente.`,
      title: "Reativar ano letivo",
      tone: "green" as const,
    };
  }
  return {
    confirmLabel: "Excluir",
    description: `Excluir definitivamente ${item.year}? Esta ação só é permitida para ano letivo vazio e não atual.`,
    title: "Excluir ano letivo",
    tone: "red" as const,
  };
}
