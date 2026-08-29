"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Eye,
  FileUp,
  Pencil,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";
import {
  api,
  type ApiUser,
  type BaseRecord,
  type ManualFinancialMovement,
  type ManualFinancialMovementCategory,
  type ManualFinancialMovementPayload,
  type ManualFinancialMovementStatus,
  type ManualFinancialMovementSummary,
  type ManualFinancialMovementType,
  type ManualMovementStudentOption,
} from "../../../lib/api";
import { mapApiErrorMessage } from "../../../lib/formatters";
import { adminTheme, cx } from "../admin-theme";
import { centsToInput, formatMoneyInput, parseMoneyToCents } from "./manual-movement-money";

const incomeCategories: ManualFinancialMovementCategory[] = [
  "SECOND_CARD_COPY",
  "XEROX",
  "ADMINISTRATIVE_FEE",
  "EXTRA_CONTRIBUTION",
  "DONATION",
  "OTHER",
];

const expenseCategories: ManualFinancialMovementCategory[] = [
  "FUEL",
  "MAINTENANCE",
  "ACCOUNTING",
  "OFFICE_SUPPLIES",
  "SERVICES",
  "TAXES",
  "PURCHASES",
  "OTHER",
];

const categoryLabels: Record<ManualFinancialMovementCategory, string> = {
  SECOND_CARD_COPY: "Segunda via de carteirinha",
  XEROX: "Xerox",
  ADMINISTRATIVE_FEE: "Taxa administrativa",
  EXTRA_CONTRIBUTION: "Contribuição extra",
  DONATION: "Doação",
  FUEL: "Combustível",
  MAINTENANCE: "Manutenção",
  ACCOUNTING: "Contabilidade",
  OFFICE_SUPPLIES: "Material administrativo",
  SERVICES: "Serviços",
  TAXES: "Impostos/taxas",
  PURCHASES: "Compras",
  OTHER: "Outros",
};

const statusLabels: Record<ManualFinancialMovementStatus, string> = {
  PENDING: "Pendente",
  RECEIVED: "Recebida",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

type MovementDialog =
  | { mode: "create"; type: ManualFinancialMovementType }
  | { mode: "edit"; movement: ManualFinancialMovement };

const emptySummary: ManualFinancialMovementSummary = {
  incomeReceivedCents: 0,
  expensePaidCents: 0,
  pendingExpenseCents: 0,
  cancelledCents: 0,
  totalCount: 0,
  netCents: 0,
  incomeReceivedFormatted: "R$ 0,00",
  expensePaidFormatted: "R$ 0,00",
  pendingExpenseFormatted: "R$ 0,00",
  netFormatted: "R$ 0,00",
};

export function ManualMovementsPanel({
  canManage = true,
  institutions,
  user,
}: {
  canManage?: boolean;
  institutions: BaseRecord[];
  user: ApiUser;
}) {
  const [movements, setMovements] = useState<ManualFinancialMovement[]>([]);
  const [summary, setSummary] = useState<ManualFinancialMovementSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const defaultMonth = useMemo(() => currentMonthRange(), []);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ManualFinancialMovementType | "">("");
  const [category, setCategory] = useState<ManualFinancialMovementCategory | "">("");
  const [status, setStatus] = useState<ManualFinancialMovementStatus | "">("");
  const [transactionDateFrom, setTransactionDateFrom] = useState(defaultMonth.from);
  const [transactionDateTo, setTransactionDateTo] = useState(defaultMonth.to);
  const [institutionFilterId, setInstitutionFilterId] = useState(() =>
    defaultInstitutionId(user),
  );
  const [studentFilterId, setStudentFilterId] = useState("");
  const [dialog, setDialog] = useState<MovementDialog | null>(null);
  const [detail, setDetail] = useState<ManualFinancialMovement | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    void loadMovements();
  }, [page, type, category, status, transactionDateFrom, transactionDateTo, institutionFilterId, studentFilterId]);

  async function loadMovements(nextSearch = search) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setPageError("");
    try {
      const response = await api.listManualFinancialMovements({
        page,
        limit: 10,
        search: nextSearch,
        type: type || undefined,
        category: category || undefined,
        status: status || undefined,
        transactionDateFrom,
        transactionDateTo,
        institutionId: institutionFilterId || undefined,
        studentId: studentFilterId || undefined,
      });
      if (requestId !== requestIdRef.current) {
        return;
      }
      setMovements(response.data);
      setSummary(response.summary ?? emptySummary);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (caught) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setMovements([]);
      setSummary(emptySummary);
      setTotalPages(1);
      setPageError(caught instanceof Error ? caught.message : "Erro ao carregar movimentações");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  function clearFilters() {
    setSearch("");
    setType("");
    setCategory("");
    setStatus("");
    setTransactionDateFrom(defaultMonth.from);
    setTransactionDateTo(defaultMonth.to);
    setInstitutionFilterId(defaultInstitutionId(user));
    setStudentFilterId("");
    setPage(1);
    window.setTimeout(() => void loadMovements(""), 0);
  }

  async function handleSubmitMovement(payload: ManualFinancialMovementPayload, file?: File | null) {
    setSaving(true);
    setMessage("");
    setFormError("");
    try {
      if (dialog?.mode === "edit") {
        const { file: _file, type: _type, ...update } = payload;
        await api.updateManualFinancialMovement(dialog.movement.id, update);
        if (file) {
          await api.attachManualFinancialMovementDocument(dialog.movement.id, file);
        }
        setMessage("Movimentação atualizada");
      } else {
        await api.createManualFinancialMovement({ ...payload, file });
        setMessage(payload.type === "INCOME" ? "Entrada registrada" : "Despesa registrada");
      }
      setFormError("");
      setDialog(null);
      await loadMovements();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Erro ao salvar movimentação");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(movement: ManualFinancialMovement) {
    setSaving(true);
    setPageError("");
    setMessage("");
    try {
      await api.markManualFinancialMovementPaid(movement.id, {
        paidAt: todayDate(),
      });
      setMessage("Despesa marcada como paga");
      await loadMovements();
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Erro ao marcar como paga");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(movement: ManualFinancialMovement) {
    const reason = window.prompt("Motivo do cancelamento") ?? undefined;
    if (reason === undefined) {
      return;
    }
    setSaving(true);
    setPageError("");
    setMessage("");
    try {
      await api.cancelManualFinancialMovement(movement.id, {
        reason: reason.trim() || undefined,
      });
      setMessage("Movimentação cancelada");
      await loadMovements();
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDocument(movement: ManualFinancialMovement, mode: "download" | "view") {
    if (!movement.activeAttachment) {
      return;
    }
    setPageError("");
    try {
      const result =
        mode === "download"
          ? await api.downloadManualFinancialMovementAttachment(
              movement.id,
              movement.activeAttachment.id,
            )
          : await api.viewManualFinancialMovementAttachment(
              movement.id,
              movement.activeAttachment.id,
            );
      const url = URL.createObjectURL(result.blob);
      if (mode === "download") {
        const link = document.createElement("a");
        link.href = url;
        link.download = result.fileName || movement.activeAttachment.originalFileName;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Erro ao abrir documento");
    }
  }

  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Entradas recebidas" tone="success" value={summary.incomeReceivedFormatted} />
        <SummaryCard label="Despesas pagas" tone="danger" value={summary.expensePaidFormatted} />
        <SummaryCard label="Despesas pendentes" tone="warning" value={summary.pendingExpenseFormatted} />
        <SummaryCard label="Resultado filtrado" tone={summary.netCents >= 0 ? "success" : "danger"} value={summary.netFormatted} />
      </div>

      <section className={cx(adminTheme.card, "min-w-0 p-5")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className={cx(adminTheme.titleText, "text-base")}>Movimentações</h2>
            <p className="mt-1 text-sm text-slate-600">
              Registre entradas manuais e despesas sem misturar com faturas de mensalidade.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button className={adminTheme.primaryButton} onClick={() => {
                setFormError("");
                setDialog({ mode: "create", type: "INCOME" });
              }} type="button">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nova entrada
              </button>
              <button className={adminTheme.secondaryButton} onClick={() => {
                setFormError("");
                setDialog({ mode: "create", type: "EXPENSE" });
              }} type="button">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nova despesa
              </button>
            </div>
          ) : null}
        </div>

        {message ? <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
        {pageError ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mapApiErrorMessage(pageError)}</p> : null}

        <form className="mt-4 grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void loadMovements();
        }}>
          <div className="grid min-w-0 gap-3 rounded-xl border border-slate-200/80 bg-[#F8FAFA]/80 p-3 md:grid-cols-2 xl:grid-cols-6">
            <input className={cx(adminTheme.control, "xl:col-span-2")} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição, fornecedor, aluno ou documento" type="search" value={search} />
            <select className={adminTheme.control} onChange={(event) => {
              setType(event.target.value as ManualFinancialMovementType | "");
              setCategory("");
            }} value={type}>
              <option value="">Todas</option>
              <option value="INCOME">Entradas</option>
              <option value="EXPENSE">Despesas</option>
            </select>
            <select className={adminTheme.control} onChange={(event) => setCategory(event.target.value as ManualFinancialMovementCategory | "")} value={category}>
              <option value="">Categorias</option>
              {(type === "EXPENSE" ? expenseCategories : type === "INCOME" ? incomeCategories : allCategories()).map((item) => (
                <option key={item} value={item}>{categoryLabels[item]}</option>
              ))}
            </select>
            <select className={adminTheme.control} onChange={(event) => setStatus(event.target.value as ManualFinancialMovementStatus | "")} value={status}>
              <option value="">Status</option>
              <option value="RECEIVED">Recebida</option>
              <option value="PENDING">Pendente</option>
              <option value="PAID">Paga</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <button className={adminTheme.primaryButton} disabled={loading} type="submit">
              <Search aria-hidden="true" className="h-4 w-4" />
              Buscar
            </button>
          </div>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              De
              <input className={adminTheme.control} onChange={(event) => setTransactionDateFrom(event.target.value)} type="date" value={transactionDateFrom} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Até
              <input className={adminTheme.control} onChange={(event) => setTransactionDateTo(event.target.value)} type="date" value={transactionDateTo} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Instituição
              <InstitutionSelect
                institutions={institutions}
                onChange={(value) => {
                  setInstitutionFilterId(value);
                  setStudentFilterId("");
                }}
                placeholder="Todas permitidas"
                value={institutionFilterId}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Acadêmico específico
              <StudentPicker institutionId={institutionFilterId} onSelect={(student) => setStudentFilterId(student?.id ?? "")} selectedId={studentFilterId} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={adminTheme.secondaryButton} onClick={clearFilters} type="button">
              <XCircle aria-hidden="true" className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-3">
        {loading ? (
          <p className={cx(adminTheme.card, "p-4 text-sm text-slate-600")}>Carregando movimentações...</p>
        ) : movements.length === 0 ? (
          <p className={cx(adminTheme.card, "p-4 text-sm text-slate-600")}>Nenhuma movimentação encontrada.</p>
        ) : (
          movements.map((movement) => (
            <MovementRow
              busy={saving}
              key={movement.id}
              movement={movement}
              onCancel={handleCancel}
              onDocument={handleDocument}
              onEdit={(item) => {
                setFormError("");
                setDialog({ mode: "edit", movement: item });
              }}
              onMarkPaid={handleMarkPaid}
              onView={setDetail}
              canManage={canManage}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
        <div className="flex gap-2">
          <button className={adminTheme.secondaryButton} disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Anterior</button>
          <button className={adminTheme.secondaryButton} disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Próxima</button>
        </div>
      </div>

      {dialog ? (
        <MovementDialog
          dialog={dialog}
          error={formError}
          onClearError={() => setFormError("")}
          onClose={() => {
            if (!saving) {
              setFormError("");
              setDialog(null);
            }
          }}
          onSubmit={handleSubmitMovement}
          institutions={institutions}
          saving={saving}
          user={user}
        />
      ) : null}
      {detail ? <MovementDetails movement={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}

function MovementRow({
  busy,
  movement,
  onCancel,
  canManage,
  onDocument,
  onEdit,
  onMarkPaid,
  onView,
}: {
  busy: boolean;
  canManage: boolean;
  movement: ManualFinancialMovement;
  onCancel: (movement: ManualFinancialMovement) => void;
  onDocument: (movement: ManualFinancialMovement, mode: "download" | "view") => void;
  onEdit: (movement: ManualFinancialMovement) => void;
  onMarkPaid: (movement: ManualFinancialMovement) => void;
  onView: (movement: ManualFinancialMovement) => void;
}) {
  const income = movement.type === "INCOME";
  return (
    <article className={cx(adminTheme.card, "min-w-0 p-4")}>
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", income ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
              {income ? <ArrowUpCircle aria-hidden className="h-3.5 w-3.5" /> : <ArrowDownCircle aria-hidden className="h-3.5 w-3.5" />}
              {income ? "Entrada" : "Despesa"}
            </span>
            <span className={cx("rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone(movement.status))}>{statusLabels[movement.status]}</span>
            {movement.activeAttachment ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">Com documento</span> : null}
          </div>
          <h3 className="mt-2 truncate text-base font-bold text-slate-950">{movement.description}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {movement.student?.name ?? movement.supplierName ?? "Sem vínculo"} · {categoryLabels[movement.category]}
          </p>
        </div>
        <div className="grid gap-1 text-sm text-slate-600">
          <p><span className="font-semibold text-slate-700">Data:</span> {formatDate(movement.transactionDate)}</p>
          {movement.competenceDate ? <p><span className="font-semibold text-slate-700">Competência:</span> {formatCompetence(movement.competenceDate)}</p> : null}
          <p className={cx("font-bold", income ? "text-emerald-700" : "text-red-700")}>
            {income ? "+" : "-"} {movement.amountFormatted}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button className={adminTheme.secondaryButton} onClick={() => onView(movement)} type="button"><Eye aria-hidden className="h-4 w-4" />Detalhes</button>
          {canManage ? (
            <button className={adminTheme.secondaryButton} disabled={busy || movement.status === "CANCELLED"} onClick={() => onEdit(movement)} type="button"><Pencil aria-hidden className="h-4 w-4" />Editar</button>
          ) : null}
          {movement.activeAttachment ? (
            <>
              {canManage ? (
                <>
                  <button className={adminTheme.secondaryButton} onClick={() => onDocument(movement, "view")} type="button"><Eye aria-hidden className="h-4 w-4" />Documento</button>
                  <button className={adminTheme.secondaryButton} onClick={() => onDocument(movement, "download")} type="button"><Download aria-hidden className="h-4 w-4" />Baixar</button>
                </>
              ) : null}
            </>
          ) : null}
          {canManage && movement.type === "EXPENSE" && movement.status === "PENDING" ? (
            <button className={adminTheme.primaryButton} disabled={busy} onClick={() => onMarkPaid(movement)} type="button">Marcar paga</button>
          ) : null}
          {canManage && movement.status !== "CANCELLED" ? (
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60" disabled={busy} onClick={() => onCancel(movement)} type="button">
              <XCircle aria-hidden className="h-4 w-4" />
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MovementDialog({
  dialog,
  error,
  institutions,
  onClearError,
  onClose,
  onSubmit,
  saving,
  user,
}: {
  dialog: MovementDialog;
  error: string;
  institutions: BaseRecord[];
  onClearError: () => void;
  onClose: () => void;
  onSubmit: (payload: ManualFinancialMovementPayload, file?: File | null) => void;
  saving: boolean;
  user: ApiUser;
}) {
  const movement = dialog.mode === "edit" ? dialog.movement : null;
  const movementType = dialog.mode === "edit" ? dialog.movement.type : dialog.type;
  const [institutionId, setInstitutionId] = useState(
    movement?.institutionId ?? defaultInstitutionId(user),
  );
  const [description, setDescription] = useState(movement?.description ?? "");
  const [amount, setAmount] = useState(movement ? centsToInput(movement.amountCents) : "");
  const [transactionDate, setTransactionDate] = useState(movement?.transactionDate ?? todayDate());
  const [category, setCategory] = useState<ManualFinancialMovementCategory>(
    movement?.category ?? (movementType === "INCOME" ? "SECOND_CARD_COPY" : "FUEL"),
  );
  const [student, setStudent] = useState<{ id: string; name: string } | null>(
    movement?.student ? { id: movement.student.id, name: movement.student.name } : null,
  );
  const [supplierName, setSupplierName] = useState(movement?.supplierName ?? "");
  const [supplierDocument, setSupplierDocument] = useState(movement?.supplierDocument ?? "");
  const [documentNumber, setDocumentNumber] = useState(movement?.documentNumber ?? "");
  const [competenceDate, setCompetenceDate] = useState(movement?.competenceDate?.slice(0, 7) ?? monthValue(todayDate()));
  const [dueDate, setDueDate] = useState(movement?.dueDate ?? "");
  const [paidAt, setPaidAt] = useState(movement?.paidAt ?? (movementType === "EXPENSE" ? "" : transactionDate));
  const [notes, setNotes] = useState(movement?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const visibleError = validationError || error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onClearError();
    setValidationError("");
    let amountCents = 0;
    try {
      amountCents = parseMoneyToCents(amount);
    } catch (caught) {
      setValidationError(caught instanceof Error ? caught.message : "Valor invalido.");
      return;
    }
    if (!institutionId) {
      setValidationError("Instituição obrigatória.");
      return;
    }
    onSubmit(
      {
        type: movementType,
        category,
        description,
        amountCents,
        transactionDate,
        competenceDate: competenceDate ? `${competenceDate}-01` : undefined,
        dueDate: movementType === "EXPENSE" ? emptyToUndefined(dueDate) : undefined,
        paidAt: movementType === "EXPENSE" ? emptyToUndefined(paidAt) : undefined,
        institutionId,
        studentId: movementType === "INCOME" ? student?.id : undefined,
        supplierName: movementType === "EXPENSE" ? supplierName : undefined,
        supplierDocument: movementType === "EXPENSE" ? supplierDocument : undefined,
        documentNumber: movementType === "EXPENSE" ? documentNumber : undefined,
        notes: emptyToUndefined(notes),
      },
      file,
    );
  }

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" role="dialog">
      <form className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-[920px] sm:rounded-2xl" onSubmit={submit}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">Movimentações</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
              {movement ? "Editar movimentação" : movementType === "INCOME" ? "Nova entrada" : "Nova despesa"}
            </h2>
          </div>
          <button aria-label="Fechar" className={adminTheme.iconButton} disabled={saving} onClick={onClose} type="button">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {visibleError ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {mapApiErrorMessage(visibleError)}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Instituição
              <InstitutionSelect
                disabled={isSingleInstitutionUser(user)}
                institutions={institutions}
                onChange={(value) => {
                  setInstitutionId(value);
                  setStudent(null);
                  setValidationError("");
                  onClearError();
                }}
                placeholder="Selecione a instituição"
                required
                value={institutionId}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Descrição
              <input className={adminTheme.control} maxLength={300} onChange={(event) => setDescription(event.target.value)} required value={description} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Categoria
              <select className={adminTheme.control} onChange={(event) => setCategory(event.target.value as ManualFinancialMovementCategory)} value={category}>
                {(movementType === "INCOME" ? incomeCategories : expenseCategories).map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Valor
              <input
                className={adminTheme.control}
                inputMode="decimal"
                onBlur={() => setAmount(formatMoneyInput(amount))}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setValidationError("");
                  onClearError();
                }}
                placeholder="R$ 25,00"
                value={amount}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Data
              <input className={adminTheme.control} onChange={(event) => setTransactionDate(event.target.value)} required type="date" value={transactionDate} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Competência
              <input className={adminTheme.control} onChange={(event) => setCompetenceDate(event.target.value)} type="month" value={competenceDate} />
            </label>
            {movementType === "INCOME" ? (
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Acadêmico opcional
                <StudentPicker institutionId={institutionId} onSelect={setStudent} selectedId={student?.id ?? ""} />
              </label>
            ) : null}
            {movementType === "EXPENSE" ? (
              <>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Fornecedor
                  <input className={adminTheme.control} maxLength={180} onChange={(event) => setSupplierName(event.target.value)} required value={supplierName} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  CPF/CNPJ opcional
                  <input className={adminTheme.control} inputMode="numeric" onChange={(event) => setSupplierDocument(event.target.value)} value={supplierDocument} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Vencimento
                  <input className={adminTheme.control} onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Pagamento
                  <input className={adminTheme.control} onChange={(event) => setPaidAt(event.target.value)} type="date" value={paidAt} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Número do documento
                  <input className={adminTheme.control} maxLength={80} onChange={(event) => setDocumentNumber(event.target.value)} value={documentNumber} />
                </label>
              </>
            ) : null}
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Observação
              <textarea className={cx(adminTheme.control, "min-h-24 py-2")} maxLength={1000} onChange={(event) => setNotes(event.target.value)} value={notes} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Documento/comprovante opcional
              <input accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" className={adminTheme.control} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
              <span className="text-xs text-slate-500">PDF, PNG, JPEG ou WebP.</span>
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button className={adminTheme.secondaryButton} disabled={saving} onClick={onClose} type="button">Cancelar</button>
          <button className={adminTheme.primaryButton} disabled={saving} type="submit">
            <FileUp aria-hidden="true" className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StudentPicker({
  institutionId,
  onSelect,
  selectedId,
}: {
  institutionId?: string;
  onSelect: (student: { id: string; name: string } | null) => void;
  selectedId: string;
}) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<ManualMovementStudentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ManualMovementStudentOption | null>(null);
  const [lookupError, setLookupError] = useState("");

  async function searchStudents() {
    if (query.trim().length < 2) {
      return;
    }
    setLoading(true);
    setLookupError("");
    try {
      const response = await api.listManualMovementStudentOptions({
        institutionId,
        search: query.trim(),
        limit: 10,
      });
      setStudents(response.data);
    } catch (caught) {
      setStudents([]);
      setLookupError(
        caught instanceof Error ? caught.message : "Erro ao buscar academico",
      );
    } finally {
      setLoading(false);
    }
  }

  function selectStudent(student: ManualMovementStudentOption) {
    setSelected(student);
    onSelect({ id: student.studentId, name: student.name });
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input className={cx(adminTheme.control, "min-w-0 flex-1")} onChange={(event) => {
          setQuery(event.target.value);
          setLookupError("");
        }} disabled={!institutionId} placeholder="Nome, CPF ou carteirinha" type="search" value={query} />
        <button className={adminTheme.secondaryButton} disabled={loading || !institutionId || query.trim().length < 2} onClick={() => void searchStudents()} type="button">Buscar</button>
      </div>
      {selected || selectedId ? (
        <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-800" onClick={() => {
          setSelected(null);
          setLookupError("");
          onSelect(null);
        }} type="button">
          Selecionado: {selected?.name ?? selectedId} · remover
        </button>
      ) : null}
      {lookupError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {mapApiErrorMessage(lookupError)}
        </p>
      ) : null}
      {students.length > 0 ? (
        <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
          {students.map((student) => (
            <button className="rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50" key={student.studentId} onClick={() => selectStudent(student)} type="button">
              <span className="block font-semibold text-slate-800">{student.name}</span>
              <span className="text-slate-500">CPF {student.cpfMasked} · Carteirinha {student.cardNumber ?? "sem número ativo"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InstitutionSelect({
  disabled,
  institutions,
  onChange,
  placeholder,
  required,
  value,
}: {
  disabled?: boolean;
  institutions: BaseRecord[];
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  value: string;
}) {
  return (
    <select
      className={adminTheme.control}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      value={value}
    >
      <option value="">{placeholder}</option>
      {institutions.map((institution) => (
        <option key={institution.id} value={institution.id}>
          {institution.name}
        </option>
      ))}
    </select>
  );
}

function MovementDetails({ movement, onClose }: { movement: ManualFinancialMovement; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6">
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#1F6F5F]">Detalhes</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{movement.description}</h2>
          </div>
          <button className={adminTheme.iconButton} onClick={onClose} type="button"><X aria-hidden className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <Detail label="Tipo" value={movement.type === "INCOME" ? "Entrada" : "Despesa"} />
          <Detail label="Status" value={statusLabels[movement.status]} />
          <Detail label="Categoria" value={categoryLabels[movement.category]} />
          <Detail label="Valor" value={`${movement.type === "INCOME" ? "+" : "-"} ${movement.amountFormatted}`} />
          <Detail label="Data" value={formatDate(movement.transactionDate)} />
          <Detail label="Competência" value={movement.competenceDate ? formatCompetence(movement.competenceDate) : "Nao informada"} />
          <Detail label="Fornecedor/aluno" value={movement.student?.name ?? movement.supplierName ?? "Nao informado"} />
          <Detail label="Documento" value={movement.documentNumber ?? movement.activeAttachment?.originalFileName ?? "Nao informado"} />
          <Detail label="Observação" value={movement.notes ?? "Sem observação"} wide />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, tone, value }: { label: string; tone: "danger" | "success" | "warning"; value: string }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-700" : "text-amber-700";
  return (
    <article className={cx(adminTheme.card, "p-4")}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={cx("mt-2 text-xl font-bold", color)}>{value}</p>
    </article>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <p className={cx("rounded-lg border border-slate-200 bg-slate-50 px-3 py-2", wide && "sm:col-span-2")}>
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="mt-1 block text-slate-800">{value}</span>
    </p>
  );
}

function allCategories() {
  return Array.from(new Set([...incomeCategories, ...expenseCategories]));
}

function defaultInstitutionId(user: ApiUser) {
  return isSingleInstitutionUser(user) ? user.institutionIds?.[0] ?? "" : "";
}

function isSingleInstitutionUser(user: ApiUser) {
  return isScopedOperationalUser(user) && (user.institutionIds?.length ?? 0) === 1;
}

function isScopedOperationalUser(user: ApiUser) {
  return user.roles.includes("USER") || user.roles.includes("SECRETARIA");
}

function statusTone(status: ManualFinancialMovementStatus) {
  if (status === "RECEIVED" || status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function currentMonthRange() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: todayDate(first), to: todayDate(last) };
}

function todayDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function monthValue(value: string) {
  return value.slice(0, 7);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatCompetence(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function emptyToUndefined(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
}
