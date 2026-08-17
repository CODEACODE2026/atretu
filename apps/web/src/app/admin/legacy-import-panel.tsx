"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  api,
  type LegacyAcademicImportPayload,
  type LegacyAcademicImportResponse,
  type LegacyAcademicPreviewItem,
  type LegacyAcademicPreviewResponse,
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

const statusTone: Record<LegacyImportStatus, "green" | "orange" | "red" | "blue"> = {
  PRONTO: "green",
  PENDENCIA: "orange",
  BLOQUEADO: "red",
  JA_IMPORTADO: "blue",
};

export function LegacyImportPanel() {
  const [payload, setPayload] = useState<LegacyAcademicImportPayload | null>(null);
  const [preview, setPreview] = useState<LegacyAcademicPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [destinationAcademicYear, setDestinationAcademicYear] = useState(
    new Date().getFullYear(),
  );
  const [confirmReview, setConfirmReview] = useState(false);
  const [createMissingBaseRecords, setCreateMissingBaseRecords] = useState(false);
  const [result, setResult] = useState<LegacyAcademicImportResponse | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "green" | "orange" | "red"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectable = useMemo(
    () =>
      preview?.items.filter((item) => item.legacyId !== null && item.canImport) ??
      [],
    [preview],
  );

  async function handleFile(file: File | null) {
    setFeedback(null);
    setPreview(null);
    setResult(null);
    setSelected(new Set());
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
      setFeedback({ tone: "green", text: "Pre-validacao concluida sem salvar registros." });
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
    if (!payload || selected.size === 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.importLegacyAcademics({
        ...payload,
        destinationAcademicYear,
        selectedLegacyIds: [...selected],
        confirmReviewRequired: confirmReview,
        createMissingBaseRecords,
      });
      setResult(response);
      setFeedback({ tone: "green", text: "Importacao piloto finalizada." });
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
    if (!result?.batch.id) return;
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.rollbackLegacyImportBatch(result.batch.id);
      setFeedback({
        tone: "orange",
        text: `Rollback concluido: ${response.removed} academico(s), residuos QA ${response.residuals}.`,
      });
      setResult(null);
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

  function toggleItem(item: LegacyAcademicPreviewItem) {
    if (item.legacyId === null) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.legacyId!)) next.delete(item.legacyId!);
      else next.add(item.legacyId!);
      return next;
    });
  }

  return (
    <>
      <AdminModuleHeader
        description="Fluxo SUPER_ADMIN para arquivo JSON de academicos legado, com preview idempotente e importacao piloto limitada."
        eyebrow="SUPER ADMIN"
        icon={FileJson}
        title="Importacao legado"
      />

      <section className={adminTheme.card}>
        {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback> : null}
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="flex min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center transition hover:border-[#8DB7AD] hover:bg-[#F2F8F6]">
            <Upload aria-hidden="true" className="h-8 w-8 text-[#0F2E2E]" />
            <span className="mt-3 text-sm font-semibold text-slate-900">
              Selecionar JSON
            </span>
            <span className="mt-1 text-xs text-slate-500">
              Ate 10 registros e 512 KB
            </span>
            <input
              accept="application/json,.json"
              className="sr-only"
              type="file"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="grid gap-2 text-sm text-slate-600">
            <p>Arquivo: {preview?.file.fileName ?? "nenhum selecionado"}</p>
            <p>Nenhum registro e salvo durante a pre-validacao.</p>
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
              disabled={!payload || loading}
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(["PRONTO", "PENDENCIA", "BLOQUEADO", "JA_IMPORTADO"] as LegacyImportStatus[]).map((status) => (
              <AdminSummaryCard
                key={status}
                icon={status === "BLOQUEADO" ? AlertTriangle : CheckCircle2}
                label={status.replace("_", " ")}
                tone={statusTone[status] === "blue" ? "slate" : statusTone[status]}
                value={preview.summary[status]}
              />
            ))}
          </section>

          <section className={adminTheme.card}>
            <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Previa do lote</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selecione explicitamente ate 10 academicos para confirmar.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                <button
                  className={adminTheme.primaryButton}
                  disabled={loading || selected.size === 0}
                  type="button"
                  onClick={() => void importSelected()}
                >
                  Importar selecionados ({selected.size})
                </button>
              </div>
            </div>
            {preview.items.length === 0 ? (
              <div className="p-4">
                <AdminEmptyState title="Nenhum registro encontrado" />
              </div>
            ) : (
              <div className="grid gap-3 p-4">
                {preview.items.map((item) => (
                  <article
                    key={`${item.index}-${item.legacyId ?? "sem-id"}`}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          checked={item.legacyId !== null && selected.has(item.legacyId)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          disabled={!selectable.includes(item)}
                          type="checkbox"
                          onChange={() => toggleItem(item)}
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
                      <Info label="Onibus" value={formatBusRelation(item.relations.bus)} />
                      <Info label="Carteirinha legado" value={item.legacyCardNumber ?? "-"} />
                      <Info label="Carteirinha ATRETU" value={item.card.needsAtretuNumber ? "gerar numero ATRETU" : "preservar"} />
                      <Info label="Observacao" value={item.observation ?? "-"} />
                      <Info label="Ano cadastro legado" value={item.legacyCreatedYear ? String(item.legacyCreatedYear) : "-"} />
                      <Info label="Ano letivo destino" value={formatRelation(item.relations.academicYear)} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-600">
                      {item.reasons.join("; ")}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {result ? (
        <section className={cx(adminTheme.card, "p-4")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Resultado do lote</h2>
              <p className="mt-1 text-sm text-slate-600">
                Batch {result.batch.id} · importados {result.summary.imported} · falhas {result.summary.failed}
              </p>
            </div>
            <button className={adminTheme.secondaryButton} disabled={loading} type="button" onClick={() => void rollback()}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Rollback do batch
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {result.results.map((item) => (
              <div key={item.legacyId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-800">{value}</p>
    </div>
  );
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
