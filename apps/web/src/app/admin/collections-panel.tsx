"use client";

import { useEffect, useRef, useState } from "react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BankSlipRecord,
  type BaseRecord,
  type CollectionAction,
  type CollectionCase,
  type CollectionCaseDetail,
  type CollectionSummary,
} from "../../lib/api";
import { mapApiErrorMessage } from "../../lib/formatters";
import { adminTheme, cx } from "./admin-theme";
import { CollectionDetails } from "./finance/collections/collection-details";
import { CollectionFiltersBar } from "./finance/collections/collection-filters";
import { CollectionFollowUpList } from "./finance/collections/collection-follow-up-list";
import { CollectionList } from "./finance/collections/collection-list";
import { CollectionSummaryCards } from "./finance/collections/collection-summary";
import {
  emptyCollectionFilters,
  type CollectionFilters,
} from "./finance/collections/collection-display-utils";

export function CollectionsPanel({
  initialFilters,
  user,
}: {
  initialFilters?: Partial<CollectionFilters>;
  user: ApiUser;
}) {
  const canUseCollections =
    user.roles.includes("SUPER_ADMIN") || user.roles.includes("SECRETARIA");
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [cases, setCases] = useState<CollectionCase[]>([]);
  const [followUps, setFollowUps] = useState<CollectionCase[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [filters, setFilters] = useState<CollectionFilters>(emptyCollectionFilters);
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
    if (!initialFilters) {
      return;
    }
    setFilters({ ...emptyCollectionFilters, ...initialFilters });
    setSearchInput(initialFilters.search ?? "");
    setPage(1);
  }, [initialFilters]);

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

  function clearFilters() {
    setFilters(emptyCollectionFilters);
    setSearchInput("");
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
      <section className={cx(adminTheme.card, "min-w-0 p-4")}>
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
            className={adminTheme.secondaryButton}
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
          onClear={clearFilters}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          updateFilter={updateFilter}
          years={years}
        />
      </section>

      <CollectionList
        cases={cases}
        loading={loading}
        onOpenDetail={setDetailInvoiceId}
        page={page}
        setPage={setPage}
        total={total}
        totalPages={totalPages}
      />

      <CollectionFollowUpList
        cases={followUps}
        onOpenDetail={setDetailInvoiceId}
      />

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
    <div
      aria-label="Detalhe da cobranca"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/40"
      role="dialog"
    >
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
            <CollectionDetails
              actions={actions}
              bankSlip={bankSlip}
              busy={busy}
              canRegisterActions={canRegisterActions}
              caseDetail={detail}
              onActionCreated={handleActionCreated}
              onCopyLine={() => void handleCopyLine()}
              onDownloadPdf={() => void handleDownloadPdf()}
              onHideActionForm={() => setShowActionForm(false)}
              onShowActionForm={() => setShowActionForm(true)}
              showActionForm={showActionForm}
            />
          ) : (
            <p className="text-sm text-slate-500">Cobranca nao encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function cleanParams<T extends Record<string, unknown>>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
  );
}

function readError(caught: unknown, fallback: string) {
  return caught instanceof Error ? mapApiErrorMessage(caught.message) : fallback;
}
