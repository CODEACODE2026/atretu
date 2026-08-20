"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FileJson,
  GraduationCap,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  api,
  type LegacyAcademicImportJob,
  type LegacyAcademicImportPayload,
  type LegacyAcademicPreviewItem,
  type LegacyAcademicPreviewResponse,
  type LegacyFinancialImportPayload,
  type LegacyFinancialImportResponse,
  type LegacyFinancialPreviewItem,
  type LegacyFinancialPreviewResponse,
  type LegacyFinancialPreviewStatus,
  type LegacyImportStatus,
} from "../../lib/api";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminStatusBadge,
  AdminSummaryCard,
} from "./components/admin-ui";

type LegacyImportTab = "academics" | "financial";
type Feedback = { tone: "green" | "orange" | "red"; text: string };
type SummaryStatus = LegacyImportStatus;

const statusTone: Record<SummaryStatus, "green" | "orange" | "red" | "blue"> = {
  PRONTO: "green",
  PENDENCIA: "orange",
  BLOQUEADO: "red",
  JA_IMPORTADO: "blue",
};
const financialStatusTone: Record<LegacyFinancialPreviewStatus, "green" | "red" | "blue"> = {
  PRONTO: "green",
  BLOQUEADO: "red",
  JA_IMPORTADO: "blue",
};
const PREVIEW_PAGE_SIZE = 25;
const FINANCIAL_HISTORY_CONFIRMATION =
  "Importar somente como histórico financeiro legado";

export function LegacyImportPanel() {
  const [activeTab, setActiveTab] = useState<LegacyImportTab>("academics");

  return (
    <>
      <AdminModuleHeader
        description="Fluxos SUPER_ADMIN para JSON legado academico e historico financeiro, com preview idempotente antes de salvar."
        eyebrow="SUPER ADMIN"
        icon={FileJson}
        title="Importacao legado"
      />

      <section className={cx(adminTheme.card, "p-2")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <TabButton
            active={activeTab === "academics"}
            icon={GraduationCap}
            label="Academicos"
            onClick={() => setActiveTab("academics")}
          />
          <TabButton
            active={activeTab === "financial"}
            icon={CircleDollarSign}
            label="Historico financeiro"
            onClick={() => setActiveTab("financial")}
          />
        </div>
      </section>

      {activeTab === "academics" ? <AcademicImportTab /> : <FinancialImportTab />}
    </>
  );
}

function AcademicImportTab() {
  const [payload, setPayload] = useState<LegacyAcademicImportPayload | null>(null);
  const [preview, setPreview] = useState<LegacyAcademicPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewPage, setPreviewPage] = useState(1);
  const [destinationAcademicYear, setDestinationAcademicYear] = useState(
    new Date().getFullYear(),
  );
  const [confirmReview, setConfirmReview] = useState(false);
  const [createMissingBaseRecords, setCreateMissingBaseRecords] = useState(false);
  const [job, setJob] = useState<LegacyAcademicImportJob | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectable = useMemo(
    () =>
      preview?.items.filter((item) => item.legacyId !== null && item.canImport) ??
      [],
    [preview],
  );
  const selectableIds = useMemo(
    () => new Set(selectable.map((item) => item.legacyId!)),
    [selectable],
  );
  const selectedImportableCount = useMemo(
    () => [...selected].filter((legacyId) => selectableIds.has(legacyId)).length,
    [selectableIds, selected],
  );
  const hasImportable = selectable.length > 0;
  const allImportableSelected =
    hasImportable && selectedImportableCount === selectable.length;
  const partiallySelected =
    selectedImportableCount > 0 && selectedImportableCount < selectable.length;
  const totalPages = Math.max(
    1,
    Math.ceil((preview?.items.length ?? 0) / PREVIEW_PAGE_SIZE),
  );
  const visibleItems = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return preview?.items.slice(start, start + PREVIEW_PAGE_SIZE) ?? [];
  }, [preview, previewPage]);
  const isImportRunning = job?.status === "QUEUED" || job?.status === "PROCESSING";

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  async function handleFile(file: File | null) {
    setFeedback(null);
    setPreview(null);
    setJob(null);
    setSelected(new Set());
    setPreviewPage(1);
    setConfirmReview(false);
    setCreateMissingBaseRecords(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setFeedback({ tone: "red", text: "Selecione um arquivo .json." });
      return;
    }
    if (file.type && !["application/json", "text/json"].includes(file.type)) {
      setFeedback({ tone: "red", text: "MIME do arquivo JSON invalido." });
      return;
    }
    if (file.size > 512 * 1024) {
      setFeedback({ tone: "red", text: "Arquivo acima do limite de 512 KB." });
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const nextPayload = {
        destinationAcademicYear,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        records: records as LegacyAcademicImportPayload["records"],
      };
      setPayload(nextPayload);
      await analyze(nextPayload);
    } catch {
      setFeedback({ tone: "red", text: "JSON invalido ou mal formado." });
    }
  }

  async function analyze(nextPayload = payload) {
    if (!nextPayload) return;
    if (!Number.isInteger(destinationAcademicYear)) {
      setFeedback({ tone: "red", text: "Informe o ano letivo destino." });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.analyzeLegacyAcademicImport({
        ...nextPayload,
        destinationAcademicYear,
      });
      setPreview(response);
      setPreviewPage(1);
      setSelected((current) => {
        const nextImportable = new Set(
          response.items
            .filter((item) => item.legacyId !== null && item.canImport)
            .map((item) => item.legacyId!),
        );
        return new Set([...current].filter((legacyId) => nextImportable.has(legacyId)));
      });
      setFeedback({ tone: "green", text: "Pre-validacao academica concluida sem salvar registros." });
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Falha ao analisar JSON.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    const selectedImportableIds = [...selected].filter((legacyId) =>
      selectableIds.has(legacyId),
    );
    if (!payload || selectedImportableIds.length === 0) return;
    setLoading(true);
    setFeedback(null);
    setJob(null);
    try {
      const started = await api.startLegacyAcademicImportJob({
        ...payload,
        destinationAcademicYear,
        selectedLegacyIds: selectedImportableIds,
        confirmReviewRequired: confirmReview,
        createMissingBaseRecords,
      });
      setJob(started);
      const completed = await pollImportJob(started.id);
      setJob(completed);
      setFeedback({
        tone: completed.status === "FAILED" ? "red" : "green",
        text:
          completed.status === "FAILED"
            ? completed.message
            : "Importacao academica concluida com progresso real.",
      });
      await analyze(payload);
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Falha ao importar lote.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function rollback() {
    if (!job?.batchId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.rollbackLegacyImportBatch(job.batchId);
      setFeedback({
        tone: "orange",
        text: `Rollback concluido: ${response.removed} academico(s), residuos QA ${response.residuals}.`,
      });
      setJob(null);
      if (payload) await analyze(payload);
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Falha no rollback.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function pollImportJob(jobId: string) {
    let current = await api.getLegacyAcademicImportJob(jobId);
    setJob(current);
    while (current.status === "QUEUED" || current.status === "PROCESSING") {
      await wait(1000);
      current = await api.getLegacyAcademicImportJob(jobId);
      setJob(current);
    }
    return current;
  }

  function toggleItem(item: LegacyAcademicPreviewItem) {
    if (item.legacyId === null || !item.canImport) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.legacyId!)) next.delete(item.legacyId!);
      else next.add(item.legacyId!);
      return next;
    });
  }

  function toggleAllImportable() {
    setSelected((current) => {
      if (allImportableSelected) return new Set();
      return new Set([...current, ...selectable.map((item) => item.legacyId!)]);
    });
  }

  return (
    <>
      <section className={adminTheme.card}>
        {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback> : null}
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <UploadBox
            hint="Ate 500 registros e 512 KB"
            label="Selecionar JSON academico"
            onFile={(file) => void handleFile(file)}
          />
          <div className="grid gap-2 text-sm text-slate-600">
            <p>Arquivo: {preview?.file.fileName ?? "nenhum selecionado"}</p>
            <p>Nenhum registro e salvo durante a pre-validacao academica.</p>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-slate-500">
                Ano letivo destino
              </span>
              <input
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0F2E2E] focus:ring-2 focus:ring-[#8DB7AD]/30"
                max={2100}
                min={2000}
                type="number"
                value={destinationAcademicYear}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDestinationAcademicYear(Number.isInteger(value) ? value : 0);
                }}
              />
            </label>
            <button
              className={adminTheme.secondaryButton}
              disabled={!payload || loading || isImportRunning}
              type="button"
              onClick={() => void analyze()}
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Analisar
            </button>
          </div>
        </div>
      </section>

      {preview ? (
        <>
          <SummaryGrid summary={preview.summary} />
          <section className={adminTheme.card}>
            <PreviewHeader
              allSelected={allImportableSelected}
              description="Selecione explicitamente os importaveis. Preview em paginas de 25 registros."
              disabled={!hasImportable}
              importLabel={`Importar selecionados (${selectedImportableCount})`}
              importDisabled={loading || selectedImportableCount === 0}
              partial={partiallySelected}
              selectAllLabel={`Selecionar todos os importaveis (${selectable.length})`}
              selectAllRef={selectAllRef}
              title="Previa academica do lote"
              onImport={() => void importSelected()}
              onToggleAll={toggleAllImportable}
            >
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={confirmReview}
                  className="h-4 w-4 rounded border-slate-300"
                  type="checkbox"
                  onChange={(event) => setConfirmReview(event.target.checked)}
                />
                Confirmar pendencias revisadas
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={createMissingBaseRecords}
                  className="h-4 w-4 rounded border-slate-300"
                  type="checkbox"
                  onChange={(event) =>
                    setCreateMissingBaseRecords(event.target.checked)
                  }
                />
                Criar cadastro-base ao importar
              </label>
            </PreviewHeader>
            {preview.items.length === 0 ? (
              <div className="p-4">
                <AdminEmptyState title="Nenhum registro encontrado" />
              </div>
            ) : (
              <PaginatedList
                count={preview.items.length}
                page={previewPage}
                totalPages={totalPages}
                visibleCount={visibleItems.length}
                selectedCount={selectedImportableCount}
                onNext={() => setPreviewPage((page) => Math.min(totalPages, page + 1))}
                onPrevious={() => setPreviewPage((page) => Math.max(1, page - 1))}
              >
                {visibleItems.map((item) => (
                  <AcademicPreviewCard
                    key={`${item.index}-${item.legacyId ?? "sem-id"}`}
                    item={item}
                    selected={item.legacyId !== null && selected.has(item.legacyId)}
                    onToggle={() => toggleItem(item)}
                  />
                ))}
              </PaginatedList>
            )}
          </section>
        </>
      ) : null}

      {job ? (
        <section className={cx(adminTheme.card, "p-4")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Resultado do lote academico</h2>
              <p className="mt-1 text-sm text-slate-600">
                Batch {job.batchId ?? "-"} · importados {job.imported} · falhas {job.failed} · ignorados {job.ignored}
              </p>
            </div>
            <button className={adminTheme.secondaryButton} disabled={loading || isImportRunning || !job.batchId} type="button" onClick={() => void rollback()}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Rollback do batch
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-1 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <span>Processando {job.processed} de {job.total}</span>
              <span className="font-semibold text-slate-950">{job.percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#0F2E2E] transition-[width]"
                style={{ width: `${Math.min(100, Math.max(0, job.percent))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Importados {job.imported} · falhas {job.failed} · ignorados/ja importados {job.ignored} · chunk {job.chunkSize}
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            {job.results.map((item, index) => (
              <div key={`${item.legacyId ?? "sem-id"}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                legacy_id {item.legacyId}: {item.status}
                {item.studentId ? ` · studentId ${item.studentId}` : ""}
                {item.reason ? ` · ${item.reason}` : ""}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function FinancialImportTab() {
  const [payload, setPayload] = useState<LegacyFinancialImportPayload | null>(null);
  const [preview, setPreview] = useState<LegacyFinancialPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewPage, setPreviewPage] = useState(1);
  const [confirmHistoryOnly, setConfirmHistoryOnly] = useState(false);
  const [result, setResult] = useState<LegacyFinancialImportResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectable = useMemo(
    () =>
      preview?.items.filter(
        (item) => item.legacyFinancialId !== null && item.canImport,
      ) ?? [],
    [preview],
  );
  const selectableIds = useMemo(
    () => new Set(selectable.map((item) => item.legacyFinancialId!)),
    [selectable],
  );
  const selectedImportableItems = useMemo(
    () =>
      selectable.filter(
        (item) =>
          item.legacyFinancialId !== null && selected.has(item.legacyFinancialId),
      ),
    [selectable, selected],
  );
  const selectedImportableCount = selectedImportableItems.length;
  const hasImportable = selectable.length > 0;
  const allImportableSelected =
    hasImportable && selectedImportableCount === selectable.length;
  const partiallySelected =
    selectedImportableCount > 0 && selectedImportableCount < selectable.length;
  const totalPages = Math.max(
    1,
    Math.ceil((preview?.items.length ?? 0) / PREVIEW_PAGE_SIZE),
  );
  const visibleItems = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return preview?.items.slice(start, start + PREVIEW_PAGE_SIZE) ?? [];
  }, [preview, previewPage]);
  const summary = useMemo(() => buildFinancialSummary(preview), [preview]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  async function handleFile(file: File | null) {
    setFeedback(null);
    setPreview(null);
    setResult(null);
    setSelected(new Set());
    setPreviewPage(1);
    setConfirmHistoryOnly(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setFeedback({ tone: "red", text: "Selecione um arquivo .json." });
      return;
    }
    if (file.type && !["application/json", "text/json"].includes(file.type)) {
      setFeedback({ tone: "red", text: "MIME do arquivo JSON invalido." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFeedback({ tone: "red", text: "Arquivo acima do limite de 20 MB." });
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const nextPayload = {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        records: records as LegacyFinancialImportPayload["records"],
      };
      setPayload(nextPayload);
      await analyze(nextPayload);
    } catch {
      setFeedback({ tone: "red", text: "JSON invalido ou mal formado." });
    }
  }

  async function analyze(nextPayload = payload) {
    if (!nextPayload) return;
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.analyzeLegacyFinancialImport(nextPayload);
      setPreview(response);
      setPreviewPage(1);
      setSelected((current) => {
        const nextImportable = new Set(
          response.items
            .filter((item) => item.legacyFinancialId !== null && item.canImport)
            .map((item) => item.legacyFinancialId!),
        );
        return new Set([...current].filter((legacyId) => nextImportable.has(legacyId)));
      });
      setFeedback({
        tone: "green",
        text: "Pre-validacao financeira concluida sem gerar cobrancas.",
      });
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Falha ao analisar JSON financeiro.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    if (!payload || selectedImportableItems.length === 0 || !confirmHistoryOnly) return;
    const selectedLegacyFinancialIds = selectedImportableItems
      .map((item) => item.legacyFinancialId)
      .filter((legacyId): legacyId is number => legacyId !== null);
    const selectedLegacyStudentIds = [
      ...new Set(
        selectedImportableItems
          .map((item) => item.legacyStudentId)
          .filter((legacyId): legacyId is number => legacyId !== null),
      ),
    ];
    setLoading(true);
    setFeedback(null);
    setResult(null);
    try {
      const response = await api.importLegacyFinancialHistory({
        ...payload,
        selectedLegacyStudentIds,
        selectedLegacyFinancialIds,
        confirmReadOnlyHistoryOnly: confirmHistoryOnly,
      });
      setResult(response);
      setFeedback({
        tone: "green",
        text: "Historico financeiro legado importado sem efeitos operacionais.",
      });
      await analyze(payload);
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Falha ao importar historico financeiro.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function rollback() {
    if (!result?.batch.id) return;
    const typed = window.prompt("Digite SUPER_ADMIN para confirmar rollback do batch financeiro");
    if (typed !== "SUPER_ADMIN") {
      setFeedback({ tone: "orange", text: "Rollback financeiro cancelado." });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.rollbackLegacyImportBatch(result.batch.id);
      setFeedback({
        tone: "orange",
        text: `Rollback concluido pelo endpoint existente: removidos ${response.removed}, residuos QA ${response.residuals}.`,
      });
      setResult(null);
      if (payload) await analyze(payload);
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Falha no rollback financeiro.",
      });
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(item: LegacyFinancialPreviewItem) {
    if (item.legacyFinancialId === null || !item.canImport) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.legacyFinancialId!)) next.delete(item.legacyFinancialId!);
      else next.add(item.legacyFinancialId!);
      return next;
    });
  }

  function toggleAllImportable() {
    setSelected((current) => {
      if (allImportableSelected) return new Set();
      return new Set([
        ...current,
        ...selectable.map((item) => item.legacyFinancialId!),
      ]);
    });
  }

  return (
    <>
      <section className={adminTheme.card}>
        {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback> : null}
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <UploadBox
            hint="Ate 5000 registros e 20 MB"
            label="Selecionar JSON financeiro"
            onFile={(file) => void handleFile(file)}
          />
          <div className="grid gap-2 text-sm text-slate-600">
            <p>Arquivo: {preview?.file.fileName ?? "nenhum selecionado"}</p>
            <p>Origem Sistema legado. Importacao somente como historico financeiro legado.</p>
            <p className="font-medium text-slate-800">
              NAO gera Invoice, BankSlip, Sicredi, cobranca, inadimplencia operacional ou CollectionAction.
            </p>
            <button
              className={adminTheme.secondaryButton}
              disabled={!payload || loading}
              type="button"
              onClick={() => void analyze()}
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Reanalisar
            </button>
          </div>
        </div>
      </section>

      {preview ? (
        <>
          <SummaryGrid summary={summary} />
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(["PAGO", "BAIXADO", "PENDENTE", "VENCIDO"] as const).map((status) => (
              <AdminSummaryCard
                key={status}
                icon={CircleDollarSign}
                label={legacyFinancialStatusLabel(status)}
                tone={status === "VENCIDO" ? "red" : status === "PENDENTE" ? "orange" : "green"}
                value={preview.summary.byStatus[status] ?? 0}
              />
            ))}
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard
              icon={CircleDollarSign}
              label="Valor original"
              tone="slate"
              value={formatCents(preview.summary.nominalAmountCents)}
            />
            <AdminSummaryCard
              icon={CircleDollarSign}
              label="Multa"
              tone="orange"
              value={formatCents(preview.summary.fineAmountCents)}
            />
            <AdminSummaryCard
              icon={CircleDollarSign}
              label="Juros"
              tone="orange"
              value={formatCents(preview.summary.interestAmountCents)}
            />
            <AdminSummaryCard
              icon={CircleDollarSign}
              label="Valor pago"
              tone="green"
              value={formatCents(preview.summary.paidAmountCents)}
            />
          </section>
          <section className={adminTheme.card}>
            <PreviewHeader
              allSelected={allImportableSelected}
              description="Selecione lancamentos financeiros importaveis. O envio preserva PAGO, BAIXADO, PENDENTE e VENCIDO como historico legado."
              disabled={!hasImportable}
              importLabel={`Importar historico (${selectedImportableCount})`}
              importDisabled={
                loading || selectedImportableCount === 0 || !confirmHistoryOnly
              }
              partial={partiallySelected}
              selectAllLabel={`Selecionar todos os importaveis (${selectable.length})`}
              selectAllRef={selectAllRef}
              title="Preview financeiro do lote"
              onImport={() => void importSelected()}
              onToggleAll={toggleAllImportable}
            >
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  checked={confirmHistoryOnly}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  type="checkbox"
                  onChange={(event) => setConfirmHistoryOnly(event.target.checked)}
                />
                <span>{FINANCIAL_HISTORY_CONFIRMATION}</span>
              </label>
            </PreviewHeader>
            {preview.items.length === 0 ? (
              <div className="p-4">
                <AdminEmptyState title="Nenhum lançamento financeiro encontrado" />
              </div>
            ) : (
              <PaginatedList
                count={preview.items.length}
                page={previewPage}
                totalPages={totalPages}
                visibleCount={visibleItems.length}
                selectedCount={selectedImportableCount}
                onNext={() => setPreviewPage((page) => Math.min(totalPages, page + 1))}
                onPrevious={() => setPreviewPage((page) => Math.max(1, page - 1))}
              >
                {visibleItems.map((item) => (
                  <FinancialPreviewCard
                    key={`${item.index}-${item.legacyFinancialId ?? "sem-id"}`}
                    item={item}
                    selected={
                      item.legacyFinancialId !== null &&
                      selected.has(item.legacyFinancialId)
                    }
                    onToggle={() => toggleItem(item)}
                  />
                ))}
              </PaginatedList>
            )}
          </section>
        </>
      ) : null}

      {result ? (
        <section className={cx(adminTheme.card, "p-4")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Resultado financeiro</h2>
              <p className="mt-1 text-sm text-slate-600">
                Batch ID {result.batch.id} · importados {result.summary.imported} · ignorados {result.summary.ignored} · bloqueados {summary.BLOQUEADO} · falhas {result.batch.failedCount}
              </p>
            </div>
            <button
              className={adminTheme.secondaryButton}
              disabled={loading}
              type="button"
              onClick={() => void rollback()}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Rollback financeiro
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {result.results.map((item, index) => (
              <div key={`${item.legacyFinancialId ?? "sem-id"}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                legacy_financial_id {item.legacyFinancialId ?? "-"} · legacy_student_id {item.legacyStudentId ?? "-"}: {item.status}
                {item.reason ? ` · ${item.reason}` : ""}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof FileJson;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition",
        active
          ? "border-[#0F2E2E] bg-[#0F2E2E] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#8DB7AD]",
      )}
      type="button"
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </button>
  );
}

function UploadBox({
  hint,
  label,
  onFile,
}: {
  hint: string;
  label: string;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center transition hover:border-[#8DB7AD] hover:bg-[#F2F8F6]">
      <Upload aria-hidden="true" className="h-8 w-8 text-[#0F2E2E]" />
      <span className="mt-3 text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-1 text-xs text-slate-500">{hint}</span>
      <input
        accept="application/json,.json"
        className="sr-only"
        type="file"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function SummaryGrid({ summary }: { summary: Record<SummaryStatus, number> }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {(["PRONTO", "PENDENCIA", "BLOQUEADO", "JA_IMPORTADO"] as SummaryStatus[]).map((status) => (
        <AdminSummaryCard
          key={status}
          icon={status === "BLOQUEADO" ? AlertTriangle : CheckCircle2}
          label={status.replace("_", " ")}
          tone={statusTone[status] === "blue" ? "slate" : statusTone[status]}
          value={summary[status]}
        />
      ))}
    </section>
  );
}

function PreviewHeader({
  allSelected,
  children,
  description,
  disabled,
  importDisabled,
  importLabel,
  partial,
  selectAllLabel,
  selectAllRef,
  title,
  onImport,
  onToggleAll,
}: {
  allSelected: boolean;
  children?: React.ReactNode;
  description: string;
  disabled: boolean;
  importDisabled: boolean;
  importLabel: string;
  partial: boolean;
  selectAllLabel: string;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  onImport: () => void;
  onToggleAll: () => void;
}) {
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partial;
    }
  }, [partial, selectAllRef]);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        <label
          className={cx(
            "mt-3 flex items-center gap-2 text-sm font-medium",
            disabled ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-800",
          )}
        >
          <input
            ref={selectAllRef}
            checked={allSelected}
            className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled}
            type="checkbox"
            onChange={onToggleAll}
          />
          {selectAllLabel}
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {children}
        <button
          className={adminTheme.primaryButton}
          disabled={importDisabled}
          type="button"
          onClick={onImport}
        >
          {importLabel}
        </button>
      </div>
    </div>
  );
}

function PaginatedList({
  children,
  count,
  page,
  selectedCount,
  totalPages,
  visibleCount,
  onNext,
  onPrevious,
}: {
  children: React.ReactNode;
  count: number;
  page: number;
  selectedCount: number;
  totalPages: number;
  visibleCount: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 p-4">
      <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
        <span className="min-w-0 break-words">
          Pagina {page} de {totalPages} · exibindo {visibleCount} de {count} registros · selecionados {selectedCount}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            className={adminTheme.secondaryButton}
            disabled={page <= 1}
            type="button"
            onClick={onPrevious}
          >
            Anterior
          </button>
          <button
            className={adminTheme.secondaryButton}
            disabled={page >= totalPages}
            type="button"
            onClick={onNext}
          >
            Proxima
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function AcademicPreviewCard({
  item,
  selected,
  onToggle,
}: {
  item: LegacyAcademicPreviewItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const canSelect = item.legacyId !== null && item.canImport;
  const pendingReenrollment = item.legacyStatus.code === 3;
  const legacyTerminated = item.legacyStatus.code === 0;
  const legacyBoardMember = item.legacyBoardMembership.isBoardMember;
  return (
    <article
      className={cx(
        "min-w-0 rounded-xl border p-4",
        canSelect ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/80 opacity-75",
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <label
          className={cx(
            "flex min-w-0 items-start gap-3",
            canSelect ? "cursor-pointer" : "cursor-not-allowed",
          )}
        >
          <input
            checked={selected}
            className="mt-1 h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canSelect}
            type="checkbox"
            onChange={onToggle}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-950">
              {item.name || "Nome ausente"}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              legacy_id {item.legacyId ?? "-"} · CPF {item.cpfMasked || "-"}
            </span>
          </span>
        </label>
        <AdminStatusBadge tone={statusTone[item.status] === "blue" ? "slate" : statusTone[item.status]}>
          {item.status.replace("_", " ")}
        </AdminStatusBadge>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <Info label="Instituicao" value={formatRelation(item.relations.institution)} />
        <Info label="Curso / serie" value={`${item.course || "-"} / ${item.grade || "-"}`} />
        <Info label="Turno" value={formatRelation(item.relations.shift)} />
        <Info label={pendingReenrollment ? "Onibus legado" : "Onibus"} value={formatBusRelation(item.relations.bus)} />
        <Info label="Status legado" value={formatLegacyStudentStatus(item)} />
        <Info label="Status destino" value={formatDestinationStudentStatus(item.destinationStatus)} />
        <Info label="Diretoria" value={legacyBoardMember ? "Sim" : "Nao"} />
        <Info
          label="Vinculo destino"
          value={legacyBoardMember ? "Integrante da Diretoria" : "Academico"}
        />
        {legacyBoardMember ? (
          <Info label="Cargo" value={item.legacyBoardMembership.roleLabel} />
        ) : null}
        {pendingReenrollment || legacyTerminated ? (
          <>
            <Info
              label="Situacao destino"
              value={
                legacyTerminated
                  ? "Academico desligado - preservacao historica"
                  : "Academico cadastrado - aguardando renovacao"
              }
            />
            <Info
              label="Ultima matricula legado"
              value={item.legacyCreatedYear ? String(item.legacyCreatedYear) : "-"}
            />
            <Info
              label="Matricula preservada"
              value={formatRelation(item.relations.academicYear)}
            />
            <Info
              label="Rematricula destino"
              value={legacyTerminated ? "Nao se aplica" : `${item.destinationAcademicYear} - pendente`}
            />
            {legacyTerminated ? (
              <>
                <Info label="Motivo legado" value={formatLegacyTerminationReason(item)} />
                <Info label="Motivo destino" value={formatDestinationTerminationReason(item)} />
              </>
            ) : null}
            <Info
              label="Carteirinha ATRETU"
              value={
                legacyTerminated
                  ? item.card.reason
                  : "Nao sera emitida enquanto nao houver renovacao"
              }
            />
            <Info
              label="Onibus destino"
              value={legacyTerminated ? "Nao sera vinculado" : "Nao sera vinculado enquanto nao houver renovacao"}
            />
          </>
        ) : null}
        <Info label="Carteirinha legado" value={item.legacyCardNumber ?? "-"} />
        {!pendingReenrollment && !legacyTerminated ? (
          <Info label="Carteirinha ATRETU" value={item.card.reason} />
        ) : null}
        <Info label="Observacao" value={item.observation ?? "-"} />
        {!pendingReenrollment && !legacyTerminated ? (
          <>
            <Info label="Ano cadastro legado" value={item.legacyCreatedYear ? String(item.legacyCreatedYear) : "-"} />
            <Info label="Ano letivo destino" value={formatRelation(item.relations.academicYear)} />
          </>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {item.reasons.join("; ")}
      </p>
    </article>
  );
}

function FinancialPreviewCard({
  item,
  selected,
  onToggle,
}: {
  item: LegacyFinancialPreviewItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const canSelect = item.legacyFinancialId !== null && item.canImport;
  const studentName = resolvedLegacyStudentName(item);
  const cardNumber = item.legacyStudentImport?.atretuCardNumber;
  return (
    <article
      className={cx(
        "min-w-0 rounded-xl border p-4",
        canSelect ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/80 opacity-75",
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <label
          className={cx(
            "flex min-w-0 items-start gap-3",
            canSelect ? "cursor-pointer" : "cursor-not-allowed",
          )}
        >
          <input
            checked={selected}
            className="mt-1 h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canSelect}
            type="checkbox"
            onChange={onToggle}
          />
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold leading-5 text-slate-950">
              {studentName}
            </span>
            <span className="mt-1 block break-words text-xs text-slate-500">
              Carteirinha ATRETU: {cardNumber || "nao disponivel"} · Legado: {item.legacyStudentId ?? "-"}
            </span>
            <span className="mt-1 block break-words text-xs text-slate-500">
              legacy_financial_id {item.legacyFinancialId ?? "-"} · origem Sistema legado
            </span>
          </span>
        </label>
        <AdminStatusBadge tone={financialStatusTone[item.status] === "blue" ? "slate" : financialStatusTone[item.status]}>
          {item.status.replace("_", " ")}
        </AdminStatusBadge>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <Info label="Status" value={legacyFinancialStatusLabel(item.statusBoleto)} />
        <Info label="Vencimento" value={formatDate(item.dueDate)} />
        <Info label="Valor original" value={formatOptionalCents(item.nominalAmountCents)} />
        <Info label="Multa" value={formatOptionalCents(item.fineAmountCents)} />
        <Info label="Juros" value={formatOptionalCents(item.interestAmountCents)} />
        <Info label="Valor pago" value={formatOptionalCents(item.paidAmountCents)} />
        <Info label="Data pagamento" value={formatDate(item.paidAt)} />
        <Info label="Nosso numero" value={item.nossoNumero ?? "-"} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {item.reasons.length > 0 ? item.reasons.join("; ") : "Pronto para importar como historico financeiro legado somente leitura."}
      </p>
    </article>
  );
}

function resolvedLegacyStudentName(item: LegacyFinancialPreviewItem) {
  const name = item.legacyStudentImport?.studentName?.trim();
  if (name) return name;
  if (item.legacyStudentId !== null) return `Academico legado ${item.legacyStudentId}`;
  return "Academico legado sem vinculo";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-800">{value}</p>
    </div>
  );
}

function buildFinancialSummary(
  preview: LegacyFinancialPreviewResponse | null,
): Record<SummaryStatus, number> {
  return {
    PRONTO: preview?.summary.importable ?? 0,
    PENDENCIA: 0,
    BLOQUEADO: preview?.summary.blocked ?? 0,
    JA_IMPORTADO: preview?.summary.alreadyImported ?? 0,
  };
}

function formatRelation(
  relation: LegacyAcademicPreviewItem["relations"]["institution"],
) {
  const legacy = relation.legacyName ?? "-";
  if (relation.resolved) return `${legacy} -> ${relation.resolved.name}`;
  return `${legacy} -> ${relation.message}`;
}

function formatBusRelation(
  relation: LegacyAcademicPreviewItem["relations"]["bus"],
) {
  const base = formatRelation(relation);
  if (relation.status === "WILL_CREATE" && relation.legacyCapacity !== null) {
    return `${base} (${relation.legacyCapacity} lugares)`;
  }
  if (
    relation.status === "DIVERGENCE" &&
    relation.legacyCapacity !== null &&
    relation.resolvedCapacity !== null
  ) {
    return `${base} (${relation.legacyCapacity} legado / ${relation.resolvedCapacity} ATRETU)`;
  }
  return base;
}

function formatLegacyStudentStatus(item: LegacyAcademicPreviewItem) {
  const code = item.legacyStatus.code ?? "-";
  return `${item.legacyStatus.label} (${code})`;
}

function formatDestinationStudentStatus(status: LegacyAcademicPreviewItem["destinationStatus"]) {
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    SUSPENDED: "Suspenso",
    TERMINATED: "Desligado",
  };
  return status ? labels[status] ?? status : "-";
}

function formatLegacyTerminationReason(item: LegacyAcademicPreviewItem) {
  const reason = item.legacyTerminationReason;
  if (!reason) return "-";
  return reason.code === null ? reason.legacyLabel : `${reason.legacyLabel} (${reason.code})`;
}

function formatDestinationTerminationReason(item: LegacyAcademicPreviewItem) {
  const reason = item.legacyTerminationReason?.destination;
  if (!reason) return "Nao informado";
  if (reason === "WITHDRAWAL") return "Desistencia";
  if (reason === "COURSE_COMPLETION") return "Termino do curso";
  if (reason === "UNSPECIFIED") return "Nao informado no legado";
  return "Inadimplencia";
}

function legacyFinancialStatusLabel(status: string) {
  const labels: Record<string, string> = {
    BAIXADO: "Baixado",
    PAGO: "Pago",
    PENDENTE: "Pendente",
    VENCIDO: "Vencido",
  };
  return labels[status] ?? (status || "-");
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);
}

function formatOptionalCents(value?: number | null) {
  return value === null || value === undefined ? "-" : formatCents(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(value),
  );
}
