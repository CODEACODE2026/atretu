"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BankSlipRecord,
  type BaseRecord,
  type CollectionAction,
  type CollectionAgingBucket,
  type CollectionCase,
  type CollectionCaseDetail,
  type CollectionOperationalStatus,
  type CollectionSummary,
} from "../../lib/api";
import { formatDate, formatDateTime } from "../../lib/formatters/date";
import { mapApiErrorMessage } from "../../lib/formatters";
import {
  collectionActionTypeLabel,
  collectionAgingBucketLabel,
  collectionChannelLabel,
  collectionActionTypes,
  collectionOperationalStatusLabel,
  collectionPriorityClass,
  collectionPriorityLabel,
} from "./collection-formatters";
import { CollectionActionForm } from "./collection-action-form";

const AGING_BUCKETS: CollectionAgingBucket[] = [
  "DAYS_1_30",
  "DAYS_31_60",
  "DAYS_61_90",
  "DAYS_90_PLUS",
];
const OPERATIONAL_STATUSES: CollectionOperationalStatus[] = [
  "OVERDUE_NO_ACTION",
  "CONTACTED",
  "PROMISE_ACTIVE",
  "PROMISE_BROKEN",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW",
];
type CollectionFilters = {
  institutionId: string;
  academicYearId: string;
  search: string;
  dueDateFrom: string;
  dueDateTo: string;
  agingBucket: CollectionAgingBucket | "";
  operationalStatus: CollectionOperationalStatus | "";
  actionType: CollectionAction["actionType"] | "";
  followUpFrom: string;
  followUpTo: string;
};

const emptyFilters: CollectionFilters = {
  institutionId: "",
  academicYearId: "",
  search: "",
  dueDateFrom: "",
  dueDateTo: "",
  agingBucket: "",
  operationalStatus: "",
  actionType: "",
  followUpFrom: "",
  followUpTo: "",
};

export function CollectionsPanel({ user }: { user: ApiUser }) {
  const canUseCollections =
    user.roles.includes("SUPER_ADMIN") || user.roles.includes("SECRETARIA");
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [cases, setCases] = useState<CollectionCase[]>([]);
  const [followUps, setFollowUps] = useState<CollectionCase[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [filters, setFilters] = useState<CollectionFilters>(emptyFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detailInvoiceId, setDetailInvoiceId] = useState("");
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!canUseCollections) {
      return;
    }
    void loadReferences();
  }, [canUseCollections]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      setFilters((current) =>
        current.search === nextSearch ? current : { ...current, search: nextSearch },
      );
      setPage((current) => (current === 1 ? current : 1));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!canUseCollections) {
      return;
    }
    void loadCollections();
  }, [filters, page, canUseCollections]);

  async function loadReferences() {
    try {
      const [yearsResponse, institutionsResponse] = await Promise.all([
        api.listAcademicYears({ status: "all" }),
        api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
      ]);
      setYears(yearsResponse.data);
      setInstitutions(institutionsResponse.data);
    } catch (caught) {
      setError(readError(caught, "Erro ao carregar filtros"));
    }
  }

  async function loadCollections() {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError("");
    try {
      const params = cleanParams({ ...filters, page, limit: 10 });
      const [summaryResponse, casesResponse, followUpsResponse] =
        await Promise.all([
          api.getCollectionSummary(cleanParams(filters)),
          api.listCollectionCases(params),
          api.listCollectionFollowUps(cleanParams(filters)),
        ]);
      if (requestSeq.current !== seq) {
        return;
      }
      setSummary(summaryResponse);
      setCases(casesResponse.data);
      setFollowUps(followUpsResponse.data);
      setTotal(casesResponse.pagination.total);
      setTotalPages(Math.max(casesResponse.pagination.totalPages, 1));
    } catch (caught) {
      if (requestSeq.current === seq) {
        setError(readError(caught, "Erro ao carregar cobranca"));
      }
    } finally {
      if (requestSeq.current === seq) {
        setLoading(false);
      }
    }
  }

  function updateFilter<K extends keyof CollectionFilters>(
    key: K,
    value: CollectionFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  if (!canUseCollections) {
    return (
      <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Sem permissao para acessar Cobranca e Inadimplencia.
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Cobranca e Inadimplencia
            </h2>
            <p className="text-xs text-slate-500">
              Faturas vencidas e acompanhamento operacional
            </p>
          </div>
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadCollections()}
            type="button"
          >
            Atualizar
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        <CollectionSummaryCards summary={summary} />
        <CollectionFiltersBar
          filters={filters}
          institutions={institutions}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          updateFilter={updateFilter}
          years={years}
        />
      </section>

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-950">Fila de cobranca</h3>
          <p className="text-xs text-slate-500">{total} caso(s)</p>
        </div>
        <CollectionCasesTable
          cases={cases}
          loading={loading}
          onOpenDetail={setDetailInvoiceId}
        />
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </section>

      <CollectionFollowUps cases={followUps} />

      {detailInvoiceId ? (
        <CollectionCaseDetailModal
          canRegisterActions={canUseCollections}
          invoiceId={detailInvoiceId}
          onClose={() => setDetailInvoiceId("")}
          onCollectionsChanged={() => void loadCollections()}
          onMessage={setMessage}
        />
      ) : null}
    </div>
  );
}

function CollectionSummaryCards({ summary }: { summary: CollectionSummary | null }) {
  const cards = [
    ["Valor total vencido", formatCents(summary?.totalOverdueCents)],
    ["Faturas", String(summary?.invoiceCount ?? 0)],
    ["Alunos inadimplentes", String(summary?.studentCount ?? 0)],
    ["Ticket medio vencido", formatCents(summary?.averageOverdueAmountCents)],
    ["Promessas ativas", String(summary?.promisesActiveCount ?? 0)],
    ["Promessas quebradas", String(summary?.promisesBrokenCount ?? 0)],
    ["Retornos de hoje", String(summary?.followUpsTodayCount ?? 0)],
    ["Pagamentos parciais", String(summary?.partialPaymentReviewCount ?? 0)],
  ];
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div className="rounded border border-slate-200 bg-slate-50 p-3" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {AGING_BUCKETS.map((bucket) => (
          <div className="rounded border border-slate-200 p-3 text-sm" key={bucket}>
            <p className="font-medium text-slate-950">
              {collectionAgingBucketLabel(bucket)}
            </p>
            <p className="text-slate-600">
              {summary?.agingBuckets[bucket] ?? 0} fatura(s)
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function CollectionFiltersBar({
  filters,
  institutions,
  searchInput,
  setSearchInput,
  updateFilter,
  years,
}: {
  filters: CollectionFilters;
  institutions: BaseRecord[];
  searchInput: string;
  setSearchInput: (value: string) => void;
  updateFilter: <K extends keyof CollectionFilters>(
    key: K,
    value: CollectionFilters[K],
  ) => void;
  years: AcademicYear[];
}) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
      <input
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder="Buscar aluno"
        type="search"
        value={searchInput}
      />
      <select
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => updateFilter("institutionId", event.target.value)}
        value={filters.institutionId}
      >
        <option value="">Instituicao</option>
        {institutions.map((institution) => (
          <option key={institution.id} value={institution.id}>
            {institution.name}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => updateFilter("academicYearId", event.target.value)}
        value={filters.academicYearId}
      >
        <option value="">Ano letivo</option>
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.year}
          </option>
        ))}
      </select>
      <input
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => updateFilter("dueDateFrom", event.target.value)}
        type="date"
        value={filters.dueDateFrom}
      />
      <input
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => updateFilter("dueDateTo", event.target.value)}
        type="date"
        value={filters.dueDateTo}
      />
      <select
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) =>
          updateFilter("agingBucket", event.target.value as CollectionAgingBucket | "")
        }
        value={filters.agingBucket}
      >
        <option value="">Faixa de atraso</option>
        {AGING_BUCKETS.map((bucket) => (
          <option key={bucket} value={bucket}>
            {collectionAgingBucketLabel(bucket)}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) =>
          updateFilter(
            "operationalStatus",
            event.target.value as CollectionOperationalStatus | "",
          )
        }
        value={filters.operationalStatus}
      >
        <option value="">Status operacional</option>
        {OPERATIONAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {collectionOperationalStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) =>
          updateFilter(
            "actionType",
            event.target.value as CollectionAction["actionType"] | "",
          )
        }
        value={filters.actionType}
      >
        <option value="">Tipo da acao</option>
        {collectionActionTypes.map((type) => (
          <option key={type} value={type}>
            {collectionActionTypeLabel(type)}
          </option>
        ))}
      </select>
      <input
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => updateFilter("followUpFrom", event.target.value)}
        type="date"
        value={filters.followUpFrom}
      />
      <input
        className="rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => updateFilter("followUpTo", event.target.value)}
        type="date"
        value={filters.followUpTo}
      />
    </div>
  );
}

function CollectionCasesTable({
  cases,
  loading,
  onOpenDetail,
}: {
  cases: CollectionCase[];
  loading: boolean;
  onOpenDetail: (invoiceId: string) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Aluno</th>
            <th className="px-4 py-3">Contato</th>
            <th className="px-4 py-3">Instituicao</th>
            <th className="px-4 py-3">Valores</th>
            <th className="px-4 py-3">Atraso</th>
            <th className="px-4 py-3">Prioridade</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Ultima acao</th>
            <th className="px-4 py-3">Boleto</th>
            <th className="px-4 py-3">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td className="px-4 py-6 text-slate-500" colSpan={10}>
                Carregando...
              </td>
            </tr>
          ) : cases.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-slate-500" colSpan={10}>
                Nenhuma fatura vencida encontrada
              </td>
            </tr>
          ) : (
            cases.map((item) => (
              <tr key={item.invoiceId}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-950">
                    {item.student.person.fullName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.enrollment.course} / {item.enrollment.grade}
                  </p>
                  {item.student.guardian?.fullName ? (
                    <p className="text-xs text-slate-500">
                      Resp.: {item.student.guardian.fullName}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{item.student.person.phone ?? "Sem telefone"}</p>
                  <p className="text-xs text-slate-500">
                    {item.student.person.email ?? "Sem e-mail"}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{item.enrollment.institution.name}</p>
                  <p className="text-xs text-slate-500">
                    Ano {item.enrollment.academicYear.year}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{item.amountFormatted}</p>
                  <p className="text-xs text-slate-500">
                    Pendente: {item.outstandingAmountFormatted ?? formatCents(item.outstandingAmountCents)}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{formatDate(item.dueDate)}</p>
                  <p className="text-xs text-slate-500">
                    {item.daysOverdue} dia(s), {collectionAgingBucketLabel(item.agingBucket)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-2 py-1 text-xs ${collectionPriorityClass(item.priority)}`}>
                    {collectionPriorityLabel(item.priority)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {collectionOperationalStatusLabel(item.operationalStatus)}
                  {item.partialPaymentReview ? (
                    <span className="mt-1 block text-xs text-amber-700">
                      Pagamento parcial em revisao
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.lastAction ? (
                    <>
                      <p>{collectionActionTypeLabel(item.lastAction.actionType)}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(item.lastAction.createdAt)}
                      </p>
                    </>
                  ) : (
                    "Sem historico"
                  )}
                  {item.nextFollowUpAt ? (
                    <p className="text-xs text-slate-500">
                      Retorno: {formatDateTime(item.nextFollowUpAt)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.bankSlip ? (
                    <>
                      <p>{item.bankSlip.status}</p>
                      <p className="text-xs text-slate-500">
                        {item.bankSlip.pdfStoredAt ? "PDF arquivado" : "Sem PDF"}
                      </p>
                    </>
                  ) : (
                    "Sem boleto"
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                    onClick={() => onOpenDetail(item.invoiceId)}
                    type="button"
                  >
                    Abrir
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CollectionFollowUps({ cases }: { cases: CollectionCase[] }) {
  const grouped = useMemo(() => groupFollowUps(cases), [cases]);
  return (
    <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">Retornos agendados</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map((group) => (
          <div className="rounded border border-slate-200 p-3" key={group.label}>
            <p className="text-xs font-medium uppercase text-slate-500">
              {group.label}
            </p>
            <div className="mt-2 grid gap-2">
              {group.items.length === 0 ? (
                <p className="text-sm text-slate-500">Sem retornos</p>
              ) : (
                group.items.slice(0, 5).map((item) => (
                  <div className="text-sm" key={`${group.label}-${item.invoiceId}`}>
                    <p className="font-medium text-slate-950">
                      {item.student.person.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(item.nextFollowUpAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CollectionCaseDetailModal({
  canRegisterActions,
  invoiceId,
  onClose,
  onCollectionsChanged,
  onMessage,
}: {
  canRegisterActions: boolean;
  invoiceId: string;
  onClose: () => void;
  onCollectionsChanged: () => Promise<void> | void;
  onMessage: (message: string) => void;
}) {
  const [detail, setDetail] = useState<CollectionCaseDetail | null>(null);
  const [actions, setActions] = useState<CollectionAction[]>([]);
  const [bankSlip, setBankSlip] = useState<BankSlipRecord | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showActionForm, setShowActionForm] = useState(false);
  const detailRequestSeq = useRef(0);

  useEffect(() => {
    void refreshDetail();
    return () => {
      detailRequestSeq.current += 1;
    };
  }, [invoiceId]);

  function refreshDetail() {
    const seq = detailRequestSeq.current + 1;
    detailRequestSeq.current = seq;
    return loadDetail(seq);
  }

  async function loadDetail(seq: number) {
    setLoading(true);
    setError("");
    try {
      const [caseResponse, actionsResponse] = await Promise.all([
        api.getCollectionCase(invoiceId),
        api.listCollectionActions(invoiceId),
      ]);
      if (detailRequestSeq.current !== seq) {
        return;
      }
      setDetail(caseResponse);
      setActions(actionsResponse.data);
      if (caseResponse.bankSlip) {
        const bankSlipResponse = await api.getInvoiceBankSlip(invoiceId).catch(() => null);
        if (detailRequestSeq.current !== seq) {
          return;
        }
        setBankSlip(bankSlipResponse);
      } else {
        setBankSlip(null);
      }
    } catch (caught) {
      if (detailRequestSeq.current === seq) {
        setError(readError(caught, "Nao foi possivel abrir a cobranca"));
      }
    } finally {
      if (detailRequestSeq.current === seq) {
        setLoading(false);
      }
    }
  }

  async function handleCopyLine() {
    if (!bankSlip?.linhaDigitavel) {
      return;
    }
    try {
      await navigator.clipboard.writeText(bankSlip.linhaDigitavel);
      onMessage("Linha digitavel copiada");
    } catch {
      setError("Nao foi possivel copiar a linha digitavel");
    }
  }

  async function handleDownloadPdf() {
    setBusy(true);
    setError("");
    try {
      const result = await api.downloadInvoiceBankSlipPdf(invoiceId);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName || `boleto-${invoiceId.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      onMessage("PDF do boleto baixado");
    } catch (caught) {
      setError(readError(caught, "PDF indisponivel"));
    } finally {
      setBusy(false);
    }
  }

  async function handleActionCreated() {
    setShowActionForm(false);
    onMessage("Acao de cobranca registrada");
    await Promise.all([refreshDetail(), onCollectionsChanged()]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40">
      <div className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Detalhe da cobranca
            </h2>
            <p className="text-sm text-slate-500">{invoiceId.slice(0, 8)}</p>
          </div>
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : error ? (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : detail ? (
            <div className="grid gap-4">
              <CollectionCaseDetailView caseDetail={detail} bankSlip={bankSlip} />
              <div className="rounded border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      Acoes de cobranca
                    </h3>
                    <p className="text-xs text-slate-500">
                      Registros manuais ficam no historico operacional.
                    </p>
                  </div>
                  <button
                    className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={
                      !canRegisterActions ||
                      detail.invoiceStatus === "PAID" ||
                      detail.invoiceStatus === "CANCELLED"
                    }
                    onClick={() => setShowActionForm(true)}
                    type="button"
                  >
                    Registrar acao
                  </button>
                </div>
                {detail.invoiceStatus === "PAID" ||
                detail.invoiceStatus === "CANCELLED" ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Faturas pagas ou canceladas nao aceitam novas acoes, mas o
                    historico permanece disponivel.
                  </p>
                ) : null}
                {showActionForm ? (
                  <div className="mt-3">
                    <CollectionActionForm
                      caseDetail={detail}
                      onCancel={() => setShowActionForm(false)}
                      onCreated={handleActionCreated}
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded border border-slate-200 p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    disabled={!bankSlip?.linhaDigitavel || busy}
                    onClick={() => void handleCopyLine()}
                    type="button"
                  >
                    Copiar linha digitavel
                  </button>
                  <button
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    disabled={!detail.bankSlip?.pdfStoredAt || busy}
                    onClick={() => void handleDownloadPdf()}
                    type="button"
                  >
                    Baixar PDF
                  </button>
                </div>
                {!detail.bankSlip ? (
                  <p className="mt-2 text-sm text-slate-500">Fatura sem boleto.</p>
                ) : null}
                {detail.bankSlip && !detail.bankSlip.pdfStoredAt ? (
                  <p className="mt-2 text-sm text-slate-500">
                    PDF ainda nao arquivado.
                  </p>
                ) : null}
              </div>
              <CollectionActionsTimeline actions={actions} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Cobranca nao encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionCaseDetailView({
  bankSlip,
  caseDetail,
}: {
  bankSlip: BankSlipRecord | null | undefined;
  caseDetail: CollectionCaseDetail;
}) {
  return (
    <div className="grid gap-3 rounded border border-slate-200 p-4 text-sm md:grid-cols-2">
      <Info label="Aluno" value={caseDetail.student.person.fullName} />
      <Info label="Responsavel" value={caseDetail.student.guardian?.fullName ?? "Nao informado"} />
      <Info label="Telefone" value={caseDetail.student.person.phone ?? "Sem telefone"} />
      <Info label="E-mail" value={caseDetail.student.person.email ?? "Sem e-mail"} />
      <Info label="Instituicao" value={caseDetail.enrollment.institution.name} />
      <Info label="Ano letivo" value={String(caseDetail.enrollment.academicYear.year)} />
      <Info label="Matricula" value={`${caseDetail.enrollment.course} / ${caseDetail.enrollment.grade}`} />
      <Info label="Status financeiro" value={caseDetail.invoiceStatus} />
      <Info label="Status bancario" value={bankSlip?.status ?? caseDetail.bankSlip?.status ?? "Sem boleto"} />
      <Info label="Valor original" value={caseDetail.amountFormatted} />
      <Info label="Valor pago" value={formatCents(bankSlip?.paidAmountCents ?? caseDetail.bankSlip?.paidAmountCents)} />
      <Info label="Valor pendente" value={caseDetail.outstandingAmountFormatted ?? formatCents(caseDetail.outstandingAmountCents)} />
      <Info label="Vencimento" value={formatDate(caseDetail.dueDate)} />
      <Info label="Dias em atraso" value={`${caseDetail.daysOverdue} dia(s)`} />
      <Info label="Prioridade" value={collectionPriorityLabel(caseDetail.priority)} />
      <Info label="Status operacional" value={collectionOperationalStatusLabel(caseDetail.operationalStatus)} />
      <Info label="Linha digitavel" value={bankSlip?.linhaDigitavel ?? "Nao disponivel"} />
      <Info label="PDF arquivado" value={caseDetail.bankSlip?.pdfStoredAt ? formatDateTime(caseDetail.bankSlip.pdfStoredAt) : "Nao"} />
    </div>
  );
}

function CollectionActionsTimeline({ actions }: { actions: CollectionAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">
        Nenhuma acao registrada.
      </div>
    );
  }
  return (
    <div className="rounded border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">Historico de acoes</h3>
      <div className="mt-3 grid gap-3">
        {actions.map((action) => (
          <div className="border-l-2 border-slate-200 pl-3 text-sm" key={action.id}>
            <p className="font-medium text-slate-950">
              {collectionActionTypeLabel(action.actionType)}
            </p>
            <p className="text-xs text-slate-500">
              {formatDateTime(action.createdAt)} - {action.createdByUser?.name ?? "Sistema"}
            </p>
            <p className="mt-1 text-slate-700">{action.note}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>Canal: {collectionChannelLabel(action.channel)}</span>
              {action.contactedName ? <span>Contato: {action.contactedName}</span> : null}
              {action.contactedDocumentMasked ? (
                <span>Documento: {action.contactedDocumentMasked}</span>
              ) : null}
              {action.promisedAmountCents ? (
                <span>Promessa: {formatCents(action.promisedAmountCents)}</span>
              ) : null}
              {action.promiseDueDate ? (
                <span>Data promessa: {formatDate(action.promiseDueDate)}</span>
              ) : null}
              {action.nextFollowUpAt ? (
                <span>Retorno: {formatDateTime(action.nextFollowUpAt)}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-950">{value}</p>
    </div>
  );
}

function Pagination({
  page,
  setPage,
  totalPages,
}: {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button
        className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        type="button"
      >
        Anterior
      </button>
      <span className="text-sm text-slate-600">
        Pagina {page} de {totalPages}
      </span>
      <button
        className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
        type="button"
      >
        Proxima
      </button>
    </div>
  );
}

function groupFollowUps(cases: CollectionCase[]) {
  const now = new Date();
  const startToday = startOfDay(now);
  const startTomorrow = addDays(startToday, 1);
  const startAfterTomorrow = addDays(startToday, 2);
  const sevenDays = addDays(startToday, 8);
  return [
    {
      label: "Atrasados",
      items: cases.filter((item) => dateOf(item.nextFollowUpAt) < startToday),
    },
    {
      label: "Hoje",
      items: cases.filter((item) => sameRange(item.nextFollowUpAt, startToday, startTomorrow)),
    },
    {
      label: "Amanha",
      items: cases.filter((item) => sameRange(item.nextFollowUpAt, startTomorrow, startAfterTomorrow)),
    },
    {
      label: "Proximos sete dias",
      items: cases.filter((item) => sameRange(item.nextFollowUpAt, startAfterTomorrow, sevenDays)),
    },
  ];
}

function cleanParams<T extends Record<string, unknown>>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
  );
}

function dateOf(value?: string | null) {
  return value ? new Date(value) : new Date(Number.NaN);
}

function sameRange(value: string | null | undefined, start: Date, end: Date) {
  const date = dateOf(value);
  return date >= start && date < end;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatCents(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value ?? 0) / 100);
}

function readError(caught: unknown, fallback: string) {
  return caught instanceof Error ? mapApiErrorMessage(caught.message) : fallback;
}
