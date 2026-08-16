"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileCheck2,
  History,
  Info,
  MoreHorizontal,
  RefreshCcw,
  Send,
} from "lucide-react";
import type {
  IssueOfficialDocumentBody,
  OfficialDocumentCatalogItem,
  OfficialDocumentIssue,
  OfficialDocumentModel,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import { onlyDigits } from "../../../lib/formatters";
import {
  AdminEmptyState,
  AdminFeedback,
  AdminSectionHeader,
  AdminStatusBadge,
} from "../components/admin-ui";
import { adminTheme, cx } from "../admin-theme";
import { formatBytes, formatDateTime } from "./student-profile-utils";

export function StudentOfficialDocuments({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [documents, setDocuments] = useState<OfficialDocumentCatalogItem[]>([]);
  const [models, setModels] = useState<OfficialDocumentModel[]>([]);
  const [modelIssues, setModelIssues] = useState<OfficialDocumentIssue[]>([]);
  const [modelDialog, setModelDialog] = useState(false);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [adhesionDialog, setAdhesionDialog] =
    useState<OfficialDocumentCatalogItem | null>(null);
  const [adhesionForm, setAdhesionForm] = useState(defaultAdhesionTermForm());
  const [annualClearanceDialog, setAnnualClearanceDialog] =
    useState<OfficialDocumentCatalogItem | null>(null);
  const [annualClearanceForm, setAnnualClearanceForm] = useState(
    defaultAnnualClearanceDeclarationForm(),
  );
  const [refundDialog, setRefundDialog] =
    useState<OfficialDocumentCatalogItem | null>(null);
  const [refundForm, setRefundForm] = useState(defaultRefundRequestForm());
  const [termDialog, setTermDialog] = useState<OfficialDocumentCatalogItem | null>(null);
  const [termForm, setTermForm] = useState(defaultTerminationTermForm());
  const [detailsDialog, setDetailsDialog] = useState<{
    issue: OfficialDocumentIssue;
    item: OfficialDocumentCatalogItem;
  } | null>(null);
  const [historyDialog, setHistoryDialog] =
    useState<OfficialDocumentCatalogItem | null>(null);

  useEffect(() => {
    void loadDocuments();
  }, [studentId]);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const [response, modelsResponse, modelIssuesResponse] = await Promise.all([
        api.listStudentOfficialDocuments(studentId),
        api.listOfficialDocumentModels("ACTIVE"),
        api.listStudentOfficialDocumentModelIssues(studentId),
      ]);
      setDocuments(response.data);
      setModels(modelsResponse.data);
      setModelIssues(modelIssuesResponse.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao carregar documentos oficiais",
      );
    } finally {
      setLoading(false);
    }
  }

  async function issueModelDocument(model: OfficialDocumentModel, inputs: Record<string, string>) {
    setBusy(`model:${model.id}:issue`);
    setMessage("");
    setError("");
    try {
      await api.issueDynamicOfficialDocument(studentId, model.id, { inputs });
      setMessage(`${model.name} emitido.`);
      setModelDialog(false);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao emitir modelo.");
    } finally {
      setBusy("");
    }
  }

  function requestIssueDocument(item: OfficialDocumentCatalogItem) {
    if (item.type === "ADHESION_TERM") {
      setAdhesionForm(defaultAdhesionTermForm());
      setAdhesionDialog(item);
      return;
    }
    if (item.type === "ANNUAL_CLEARANCE_DECLARATION") {
      setAnnualClearanceForm(defaultAnnualClearanceDeclarationForm());
      setAnnualClearanceDialog(item);
      return;
    }
    if (item.type === "TERMINATION_TERM") {
      setTermForm(defaultTerminationTermForm());
      setTermDialog(item);
      return;
    }
    if (item.type === "TRANSPORT_REFUND_REQUEST") {
      setRefundForm(defaultRefundRequestForm());
      setRefundDialog(item);
      return;
    }
    void issueDocument(item);
  }

  async function issueDocument(
    item: OfficialDocumentCatalogItem,
    body?: IssueOfficialDocumentBody,
  ) {
    setBusy(`${item.type}:issue`);
    setMessage("");
    setError("");
    try {
      await api.issueOfficialDocument(studentId, item.type, body);
      setMessage(`${item.title} emitida.`);
      setAdhesionDialog(null);
      setAnnualClearanceDialog(null);
      setRefundDialog(null);
      setTermDialog(null);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao emitir documento");
    } finally {
      setBusy("");
    }
  }

  async function submitTerminationTerm() {
    if (!termDialog) return;
    await issueDocument(termDialog, {
      dueDate: termForm.dueDate,
      notificationDate: termForm.notificationDate,
      notes: termForm.notes || undefined,
      reason: termForm.reason,
      regularizationDeadlineDays: Number(termForm.regularizationDeadlineDays),
    });
  }

  async function submitAdhesionTerm() {
    if (!adhesionDialog) return;
    await issueDocument(adhesionDialog, {
      firstInstallmentDate: adhesionForm.firstInstallmentDate,
      installmentAmountCents: moneyInputToCents(adhesionForm.installmentAmount),
      installmentCount: Number(adhesionForm.installmentCount),
      notes: adhesionForm.notes || undefined,
    });
  }

  async function submitAnnualClearanceDeclaration() {
    if (!annualClearanceDialog) return;
    await issueDocument(annualClearanceDialog, {
      finalClearanceDate: annualClearanceForm.finalClearanceDate,
      notes: annualClearanceForm.notes || undefined,
      totalAmountCents: moneyInputToCents(annualClearanceForm.totalAmount),
      year: Number(annualClearanceForm.year),
    });
  }

  async function submitRefundRequest() {
    if (!refundDialog) return;
    await issueDocument(refundDialog, {
      bankAccount:
        refundForm.paymentMethod === "BANK_ACCOUNT"
          ? refundForm.bankAccount
          : undefined,
      bankAccountType:
        refundForm.paymentMethod === "BANK_ACCOUNT" && refundForm.bankAccountType
          ? refundForm.bankAccountType
          : undefined,
      bankAgency:
        refundForm.paymentMethod === "BANK_ACCOUNT" ? refundForm.bankAgency : undefined,
      bankName:
        refundForm.paymentMethod === "BANK_ACCOUNT" ? refundForm.bankName : undefined,
      notes: refundForm.notes || undefined,
      paymentMethod: refundForm.paymentMethod,
      pixKey: refundForm.paymentMethod === "PIX" ? refundForm.pixKey : undefined,
      reason: refundForm.reason,
      refundAmountCents: moneyInputToCents(refundForm.refundAmount),
    });
  }

  async function reissueDocument(item: OfficialDocumentCatalogItem) {
    if (!item.latestIssue) return;
    setBusy(`${item.type}:reissue`);
    setMessage("");
    setError("");
    try {
      await api.reissueOfficialDocument(studentId, item.latestIssue.id);
      setMessage(`${item.title} reemitida.`);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao reemitir documento");
    } finally {
      setBusy("");
    }
  }

  async function openIssue(issue: OfficialDocumentIssue, disposition: "attachment" | "inline") {
    setBusy(`${issue.id}:${disposition}`);
    setMessage("");
    setError("");
    try {
      const { blob, fileName } = await api.downloadOfficialDocument(
        studentId,
        issue.id,
        disposition,
      );
      const objectUrl = URL.createObjectURL(blob);
      if (disposition === "inline") {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir documento");
    } finally {
      setBusy("");
    }
  }

  const sortedDocuments = [...documents].sort(compareOfficialDocuments);
  const issuedCount = documents.filter((item) => item.latestIssue).length;
  const pendingCount = documents.filter((item) => !item.latestIssue && item.canIssue).length;

  return (
    <section className={cx(adminTheme.card, "overflow-hidden")}>
      <AdminSectionHeader
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className={adminTheme.primaryButton}
              disabled={loading || busy !== "" || models.length === 0}
              onClick={() => setModelDialog(true)}
              type="button"
            >
              <Send aria-hidden="true" size={16} />
              Emitir documento
            </button>
            <button
              className={adminTheme.secondaryButton}
              disabled={loading || busy !== ""}
              onClick={() => void loadDocuments()}
              type="button"
            >
              <RefreshCcw aria-hidden="true" size={16} />
              Atualizar
            </button>
          </div>
        }
        description="Documentos emitidos pelo Atretu com protocolo, historico e PDF institucional."
        title="Documentos Oficiais"
      />
      {message ? <AdminFeedback tone="green">{message}</AdminFeedback> : null}
      {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}
      {!loading && documents.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">
            {issuedCount} emitidos · {pendingCount} pendentes
          </span>
        </div>
      ) : null}
      <div className="grid gap-3 p-4">
        {loading ? (
          <AdminEmptyState loading title="Carregando documentos oficiais..." />
        ) : documents.length === 0 ? (
          <AdminEmptyState
            description="Nenhum documento oficial esta configurado para este academico."
            title="Sem documentos oficiais"
          />
        ) : (
          sortedDocuments.map((item) => (
            <OfficialDocumentCard
              busy={busy}
              item={item}
              key={item.type}
              onDetails={(issue) => setDetailsDialog({ issue, item })}
              onDownload={(issue) => void openIssue(issue, "attachment")}
              onHistory={() => setHistoryDialog(item)}
              onIssue={() => requestIssueDocument(item)}
              onReissue={() => void reissueDocument(item)}
              onView={(issue) => void openIssue(issue, "inline")}
            />
          ))
        )}
        {!loading && modelIssues.length > 0 ? (
          <section className="mt-2 grid gap-3 border-t border-slate-200/70 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">
              Documentos emitidos por modelo
            </h3>
            {modelIssues.map((issue) => (
              <div
                className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 lg:grid-cols-[1fr_auto]"
                key={issue.id}
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {issue.model?.name ?? "Modelo removido"} · v{issue.templateVersion}
                  </p>
                  <p className="mt-1">
                    {issue.protocol} · {formatDateTime(issue.issuedAt)} · {issue.issuedBy?.name ?? "Usuario nao identificado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button className={adminTheme.secondaryButton} disabled={Boolean(busy)} onClick={() => void openIssue(issue, "inline")} type="button">
                    <Eye size={15} />
                    Visualizar
                  </button>
                  <button className={adminTheme.secondaryButton} disabled={Boolean(busy)} onClick={() => void openIssue(issue, "attachment")} type="button">
                    <Download size={15} />
                    Baixar
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
      {modelDialog ? (
        <DynamicModelIssueDialog
          busy={busy !== ""}
          models={models}
          onCancel={() => setModelDialog(false)}
          onSubmit={(model, inputs) => void issueModelDocument(model, inputs)}
          studentId={studentId}
          studentName={studentName}
        />
      ) : null}
      {termDialog ? (
        <TerminationTermDialog
          busy={busy !== ""}
          form={termForm}
          onCancel={() => setTermDialog(null)}
          onChange={setTermForm}
          onSubmit={() => void submitTerminationTerm()}
          studentName={studentName}
        />
      ) : null}
      {adhesionDialog ? (
        <AdhesionTermDialog
          busy={busy !== ""}
          form={adhesionForm}
          onCancel={() => setAdhesionDialog(null)}
          onChange={setAdhesionForm}
          onSubmit={() => void submitAdhesionTerm()}
          studentName={studentName}
        />
      ) : null}
      {annualClearanceDialog ? (
        <AnnualClearanceDeclarationDialog
          busy={busy !== ""}
          form={annualClearanceForm}
          onCancel={() => setAnnualClearanceDialog(null)}
          onChange={setAnnualClearanceForm}
          onSubmit={() => void submitAnnualClearanceDeclaration()}
          studentName={studentName}
        />
      ) : null}
      {refundDialog ? (
        <RefundRequestDialog
          busy={busy !== ""}
          form={refundForm}
          onCancel={() => setRefundDialog(null)}
          onChange={setRefundForm}
          onSubmit={() => void submitRefundRequest()}
          studentName={studentName}
        />
      ) : null}
      {historyDialog ? (
        <OfficialDocumentHistoryDialog
          busy={busy}
          item={historyDialog}
          onClose={() => setHistoryDialog(null)}
          onDownload={(issue) => void openIssue(issue, "attachment")}
          onReissue={() => void reissueDocument(historyDialog)}
          onView={(issue) => void openIssue(issue, "inline")}
        />
      ) : null}
      {detailsDialog ? (
        <OfficialDocumentDetailsDialog
          issue={detailsDialog.issue}
          item={detailsDialog.item}
          onClose={() => setDetailsDialog(null)}
        />
      ) : null}
    </section>
  );
}

function DynamicModelIssueDialog({
  busy,
  models,
  onCancel,
  onSubmit,
  studentId,
  studentName,
}: {
  busy: boolean;
  models: OfficialDocumentModel[];
  onCancel: () => void;
  onSubmit: (model: OfficialDocumentModel, inputs: Record<string, string>) => void;
  studentId: string;
  studentName: string;
}) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState<
    Array<{ label?: string; name: string }>
  >([]);
  const [error, setError] = useState("");
  const selected = models.find((model) => model.id === modelId) ?? null;

  useEffect(() => {
    setInputs({});
    setPreview("");
    setSignaturePreview([]);
    setError("");
  }, [modelId]);

  async function loadPreview() {
    if (!selected) return;
    setError("");
    try {
      const response = await api.previewDynamicOfficialDocument(studentId, selected.id, {
        inputs,
      });
      setPreview(response.resolvedContent);
      setSignaturePreview(response.signaturePreview);
    } catch (caught) {
      setPreview("");
      setSignaturePreview([]);
      setError(caught instanceof Error ? caught.message : "Erro ao gerar prévia.");
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4">
      <form
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:rounded-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected) onSubmit(selected, inputs);
        }}
        role="dialog"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Emitir documento
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {studentName}
            </h2>
          </div>
          <AdminStatusBadge tone="blue">Modelo dinâmico</AdminStatusBadge>
        </div>
        {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}
        <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
          Modelo
          <select className={adminTheme.control} onChange={(event) => setModelId(event.target.value)} value={modelId}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} · v{model.currentVersion}
              </option>
            ))}
          </select>
        </label>
        {selected?.manualInputTokens.length ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-950">Campos manuais</h3>
            {selected.manualInputTokens.map((token) => (
              <label className="grid gap-1 text-sm font-medium text-slate-700" key={token}>
                {token}
                <input
                  className={adminTheme.control}
                  onChange={(event) =>
                    setInputs((current) => ({ ...current, [token]: event.target.value }))
                  }
                  required
                  value={inputs[token] ?? ""}
                />
              </label>
            ))}
          </div>
        ) : null}
        <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">Prévia</h3>
            <button className={adminTheme.secondaryButton} disabled={busy || !selected} onClick={() => void loadPreview()} type="button">
              <Eye size={15} />
              Atualizar prévia
            </button>
          </div>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {preview || selected?.content || "Selecione um modelo."}
          </pre>
          {signaturePreview.length > 0 ? (
            <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              {signaturePreview.map((signature) => (
                <SignaturePreviewBlock
                  key={`${signature.name}-${signature.label ?? ""}`}
                  label={signature.label ?? ""}
                  name={signature.name}
                />
              ))}
            </div>
          ) : null}
        </section>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className={cx(adminTheme.secondaryButton, "justify-center")} disabled={busy} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className={cx(adminTheme.primaryButton, "justify-center")} disabled={busy || !selected} type="submit">
            <Send size={16} />
            Gerar PDF
          </button>
        </div>
      </form>
    </div>
  );
}

function SignaturePreviewBlock({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  return (
    <div className="min-w-0 text-center text-xs text-slate-600">
      <div className="mx-auto h-px w-full max-w-56 bg-slate-300" />
      <p className="mt-2 break-words font-semibold text-slate-900">{name}</p>
      <p className="mt-1 break-words">{label}</p>
    </div>
  );
}

function OfficialDocumentCard({
  busy,
  item,
  onDetails,
  onDownload,
  onHistory,
  onIssue,
  onReissue,
  onView,
}: {
  busy: string;
  item: OfficialDocumentCatalogItem;
  onDetails: (issue: OfficialDocumentIssue) => void;
  onDownload: (issue: OfficialDocumentIssue) => void;
  onHistory: () => void;
  onIssue: () => void;
  onReissue: () => void;
  onView: (issue: OfficialDocumentIssue) => void;
}) {
  const latest = item.latestIssue;
  const isBusy = busy.startsWith(item.type) || (latest ? busy.startsWith(latest.id) : false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const statusTone = latest ? "green" : "orange";
  const statusLabel = latest ? "Emitido" : item.canIssue ? "Não emitido" : "Pendente";

  useEffect(() => {
    if (!actionsOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen]);

  return (
    <article className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F2F8F6] text-[#0F2E2E]">
            <FileCheck2 aria-hidden="true" size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-sm font-semibold text-slate-950 md:text-base">
                {item.title}
              </h3>
              <AdminStatusBadge tone={statusTone}>{statusLabel}</AdminStatusBadge>
            </div>
            <p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>
            {latest ? (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <CompactMeta label="Última emissão" value={formatDateTime(latest.issuedAt)} />
                <CompactMeta label="Protocolo" value={latest.protocol} />
                <CompactMeta label="Versão" value={`v${latest.version}`} />
              </dl>
            ) : item.blockedReason ? (
              <p className="mt-2 text-sm text-amber-700">{item.blockedReason}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Disponível para emissão.</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {latest ? (
            <>
              <button
                className={adminTheme.secondaryButton}
                disabled={isBusy}
                onClick={() => onView(latest)}
                type="button"
              >
                <Eye aria-hidden="true" size={16} />
                Visualizar
              </button>
              <button
                className={adminTheme.secondaryButton}
                disabled={isBusy}
                onClick={() => onDownload(latest)}
                type="button"
              >
                <Download aria-hidden="true" size={16} />
                Baixar PDF
              </button>
            </>
          ) : (
            <button
              className={adminTheme.primaryButton}
              disabled={!item.canIssue || isBusy}
              onClick={onIssue}
              type="button"
            >
              <Send aria-hidden="true" size={16} />
              Emitir
            </button>
          )}
          <div className="relative" ref={actionsRef}>
            <button
              aria-expanded={actionsOpen}
              aria-haspopup="menu"
              className={adminTheme.secondaryButton}
              disabled={isBusy}
              onClick={() => setActionsOpen((open) => !open)}
              type="button"
            >
              <MoreHorizontal aria-hidden="true" size={16} />
              Mais ações
            </button>
            {actionsOpen ? (
              <div
                className="absolute left-0 z-20 mt-2 grid w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl sm:left-auto sm:right-0"
                role="menu"
              >
                <MenuAction
                  disabled={!item.canIssue}
                  icon={Send}
                  label={latest ? "Emitir nova via" : "Emitir"}
                  onClick={() => {
                    setActionsOpen(false);
                    onIssue();
                  }}
                />
                <MenuAction
                  disabled={!latest}
                  icon={RefreshCcw}
                  label="Reemitir última emissão"
                  onClick={() => {
                    setActionsOpen(false);
                    onReissue();
                  }}
                />
                <MenuAction
                  disabled={item.history.length === 0}
                  icon={History}
                  label="Histórico"
                  onClick={() => {
                    setActionsOpen(false);
                    onHistory();
                  }}
                />
                <MenuAction
                  disabled={!latest}
                  icon={Info}
                  label="Detalhes da emissão"
                  onClick={() => {
                    setActionsOpen(false);
                    if (latest) onDetails(latest);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1">
      <dt className="shrink-0 font-semibold text-slate-500">{label}:</dt>
      <dd className="break-words font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function MenuAction({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: typeof Send;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-2 rounded-md px-3 py-2 text-left font-semibold text-slate-700 hover:bg-[#F2F8F6] hover:text-[#0F2E2E] disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      <Icon aria-hidden="true" size={16} />
      {label}
    </button>
  );
}

function OfficialDocumentHistoryDialog({
  busy,
  item,
  onClose,
  onDownload,
  onReissue,
  onView,
}: {
  busy: string;
  item: OfficialDocumentCatalogItem;
  onClose: () => void;
  onDownload: (issue: OfficialDocumentIssue) => void;
  onReissue: () => void;
  onView: (issue: OfficialDocumentIssue) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-x-hidden bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl md:max-w-3xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Histórico — {item.title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {item.history.length} emissões registradas
          </p>
        </div>
        <div className="grid gap-3 p-5">
          {item.history.length === 0 ? (
            <AdminEmptyState
              description="Este documento ainda nao possui emissões."
              title="Sem histórico"
            />
          ) : (
            item.history.map((issue, index) => {
              const isBusy = busy.startsWith(issue.id) || busy.startsWith(item.type);
              return (
                <article
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                  key={issue.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {index === 0 ? "Emissão mais recente" : "Emissão anterior"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {formatDateTime(issue.issuedAt)}
                      </p>
                      <dl className="mt-2 grid gap-1 text-sm text-slate-600">
                        <CompactMeta label="Protocolo" value={issue.protocol} />
                        <CompactMeta label="Versão" value={`v${issue.version}`} />
                        <CompactMeta
                          label="Emitido por"
                          value={issue.issuedBy?.name ?? "usuario removido"}
                        />
                        <CompactMeta
                          label="Assinado por"
                          value={formatSignerNames(issue)}
                        />
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        className={adminTheme.secondaryButton}
                        disabled={isBusy}
                        onClick={() => onView(issue)}
                        type="button"
                      >
                        <Eye aria-hidden="true" size={16} />
                        Visualizar
                      </button>
                      <button
                        className={adminTheme.secondaryButton}
                        disabled={isBusy}
                        onClick={() => onDownload(issue)}
                        type="button"
                      >
                        <Download aria-hidden="true" size={16} />
                        Baixar
                      </button>
                      {index === 0 ? (
                        <button
                          className={adminTheme.secondaryButton}
                          disabled={isBusy}
                          onClick={onReissue}
                          type="button"
                        >
                          <RefreshCcw aria-hidden="true" size={16} />
                          Reemitir
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button className={adminTheme.secondaryButton} onClick={onClose} type="button">
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}

function OfficialDocumentDetailsDialog({
  issue,
  item,
  onClose,
}: {
  issue: OfficialDocumentIssue;
  item: OfficialDocumentCatalogItem;
  onClose: () => void;
}) {
  const details = documentDetailRows(issue);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-x-hidden bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl md:max-w-2xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Detalhes da emissão — {item.title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Protocolo, versão, emissão e dados resumidos.
          </p>
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <DetailRow label="Emissão" value={formatDateTime(issue.issuedAt)} />
            <DetailRow label="Protocolo" value={issue.protocol} />
            <DetailRow label="Versão" value={`v${issue.version}`} />
            <DetailRow label="Arquivo" value={formatBytes(issue.sizeBytes)} />
            <DetailRow
              label="Emitido por"
              value={issue.issuedBy?.name ?? "usuario removido"}
            />
          </div>

          {details.length > 0 ? (
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
              {details.map((detail) => (
                <DetailRow
                  key={`${detail.label}:${detail.value}`}
                  label={detail.label}
                  value={detail.value}
                />
              ))}
            </div>
          ) : null}

          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">Signatários</p>
            {issue.signerDetails.length > 0 ? (
              issue.signerDetails.map((signer, index) => (
                <p className="text-sm text-slate-600" key={`${signer.name ?? index}`}>
                  {signer.name ?? signer.signerName ?? "nao informado"}
                  {signer.signerRoleLabel || signer.roleLabel
                    ? ` · ${signer.signerRoleLabel ?? signer.roleLabel}`
                    : ""}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhum signatário informado.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button className={adminTheme.secondaryButton} onClick={onClose} type="button">
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="break-words font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function documentDetailRows(issue: OfficialDocumentIssue) {
  const rows: Array<{ label: string; value: string }> = [];

  if (issue.termDetails) {
    rows.push(
      { label: "Motivo", value: issue.termDetails.reason ?? "nao informado" },
      {
        label: "Data do vencimento",
        value: issue.termDetails.dueDate
          ? formatDateTime(issue.termDetails.dueDate)
          : "nao informado",
      },
      {
        label: "Data da notificacao",
        value: issue.termDetails.notificationDate
          ? formatDateTime(issue.termDetails.notificationDate)
          : "nao informado",
      },
      {
        label: "Prazo",
        value: issue.termDetails.regularizationDeadlineDays
          ? `${issue.termDetails.regularizationDeadlineDays} dias`
          : "nao informado",
      },
    );
  }

  if (issue.adhesionDetails) {
    rows.push(
      {
        label: "Primeira mensalidade",
        value: issue.adhesionDetails.firstInstallmentDate
          ? formatDateTime(issue.adhesionDetails.firstInstallmentDate)
          : "nao informado",
      },
      {
        label: "Parcelas",
        value: issue.adhesionDetails.installmentCount
          ? String(issue.adhesionDetails.installmentCount)
          : "nao informado",
      },
      {
        label: "Valor da parcela",
        value: formatCurrencyCents(issue.adhesionDetails.installmentAmountCents),
      },
      {
        label: "Valor total",
        value: formatCurrencyCents(issue.adhesionDetails.totalContractAmountCents),
      },
    );
  }

  if (issue.annualClearanceDetails) {
    rows.push(
      {
        label: "Ano",
        value: issue.annualClearanceDetails.year
          ? String(issue.annualClearanceDetails.year)
          : "nao informado",
      },
      {
        label: "Período",
        value:
          issue.annualClearanceDetails.periodStart &&
          issue.annualClearanceDetails.periodEnd
            ? `${issue.annualClearanceDetails.periodStart} a ${issue.annualClearanceDetails.periodEnd}`
            : "nao informado",
      },
      {
        label: "Valor",
        value: formatCurrencyCents(issue.annualClearanceDetails.totalAmountCents),
      },
      {
        label: "Valor por extenso",
        value: issue.annualClearanceDetails.totalAmountWords ?? "nao informado",
      },
      {
        label: "Data da quitação",
        value: issue.annualClearanceDetails.finalClearanceDate
          ? formatDateTime(issue.annualClearanceDetails.finalClearanceDate)
          : "nao informado",
      },
      {
        label: "Data/local da emissão",
        value: issue.annualClearanceDetails.issuePlaceDateText ?? "nao informado",
      },
    );
  }

  if (issue.refundDetails) {
    rows.push(
      {
        label: "Valor",
        value: formatCurrencyCents(issue.refundDetails.refundAmountCents),
      },
      {
        label: "Forma de recebimento",
        value: issue.refundDetails.paymentMethod === "PIX" ? "PIX" : "Conta bancária",
      },
      { label: "Motivo", value: issue.refundDetails.reason ?? "nao informado" },
      {
        label: "Data/local da emissão",
        value: issue.refundDetails.issuePlaceDateText ?? "nao informado",
      },
    );
  }

  if (issue.approvalDate) {
    rows.push({
      label: "Data de aprovação",
      value: formatDateTime(issue.approvalDate),
    });
  }

  return rows;
}

function formatSignerNames(issue: OfficialDocumentIssue) {
  const names = issue.signerDetails
    .map((signer) => signer.name ?? signer.signerName)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "nao informado";
}

function compareOfficialDocuments(
  first: OfficialDocumentCatalogItem,
  second: OfficialDocumentCatalogItem,
) {
  const firstWeight = documentSortWeight(first);
  const secondWeight = documentSortWeight(second);
  if (firstWeight !== secondWeight) return firstWeight - secondWeight;
  return first.title.localeCompare(second.title, "pt-BR");
}

function documentSortWeight(item: OfficialDocumentCatalogItem) {
  if (item.latestIssue) return 0;
  if (item.canIssue) return 1;
  return 2;
}

type TerminationTermForm = {
  dueDate: string;
  notificationDate: string;
  notes: string;
  reason: string;
  regularizationDeadlineDays: string;
};

type AdhesionTermForm = {
  firstInstallmentDate: string;
  installmentAmount: string;
  installmentCount: string;
  notes: string;
};

type AnnualClearanceDeclarationForm = {
  finalClearanceDate: string;
  notes: string;
  totalAmount: string;
  year: string;
};

type RefundRequestForm = {
  bankAccount: string;
  bankAccountType: string;
  bankAgency: string;
  bankName: string;
  notes: string;
  paymentMethod: "BANK_ACCOUNT" | "PIX";
  pixKey: string;
  reason: string;
  refundAmount: string;
};

function defaultAdhesionTermForm(): AdhesionTermForm {
  return {
    firstInstallmentDate: todayInputDate(),
    installmentAmount: "",
    installmentCount: "",
    notes: "",
  };
}

function defaultAnnualClearanceDeclarationForm(): AnnualClearanceDeclarationForm {
  return {
    finalClearanceDate: todayInputDate(),
    notes: "",
    totalAmount: "",
    year: String(new Date().getFullYear()),
  };
}

function defaultRefundRequestForm(): RefundRequestForm {
  return {
    bankAccount: "",
    bankAccountType: "",
    bankAgency: "",
    bankName: "",
    notes: "",
    paymentMethod: "PIX",
    pixKey: "",
    reason: "",
    refundAmount: "",
  };
}

function defaultTerminationTermForm(): TerminationTermForm {
  return {
    dueDate: todayInputDate(),
    notificationDate: todayInputDate(),
    notes: "",
    reason: "Inadimplência",
    regularizationDeadlineDays: "10",
  };
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function moneyInputToCents(value: string) {
  const digits = onlyDigits(value);
  return digits ? Number(digits) : 0;
}

function maskMoneyInput(value: string) {
  const cents = moneyInputToCents(value);
  if (!cents) {
    return "";
  }
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function formatCurrencyCents(value?: number | null) {
  return typeof value === "number" ? maskMoneyInput(String(value)) : "nao informado";
}

function AdhesionTermDialog({
  busy,
  form,
  onCancel,
  onChange,
  onSubmit,
  studentName,
}: {
  busy: boolean;
  form: AdhesionTermForm;
  onCancel: () => void;
  onChange: (form: AdhesionTermForm) => void;
  onSubmit: () => void;
  studentName: string;
}) {
  const installmentCount = Number(form.installmentCount);
  const installmentAmountCents = moneyInputToCents(form.installmentAmount);
  const canSubmit =
    form.firstInstallmentDate &&
    installmentAmountCents > 0 &&
    Number.isInteger(installmentCount) &&
    installmentCount > 0 &&
    installmentCount <= 24;

  function update<K extends keyof AdhesionTermForm>(
    key: K,
    value: AdhesionTermForm[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Emitir Termo de Adesão e Filiação
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Informe valor, quantidade e primeira mensalidade. As datas serao
            calculadas automaticamente e salvas no snapshot do documento.
          </p>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Aluno
            <input
              className={cx(adminTheme.control, "w-full")}
              readOnly
              value={studentName}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Valor da parcela
              <input
                className={cx(adminTheme.control, "w-full")}
                inputMode="numeric"
                onChange={(event) =>
                  update("installmentAmount", maskMoneyInput(event.target.value))
                }
                placeholder="R$ 330,00"
                required
                value={form.installmentAmount}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Primeira mensalidade
              <span className="relative">
                <CalendarDays
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  className={cx(adminTheme.control, "w-full pl-9")}
                  onChange={(event) =>
                    update("firstInstallmentDate", event.target.value)
                  }
                  required
                  type="date"
                  value={form.firstInstallmentDate}
                />
              </span>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Quantidade de parcelas
              <input
                className={cx(adminTheme.control, "w-full")}
                max={24}
                min={1}
                onChange={(event) => update("installmentCount", event.target.value)}
                required
                type="number"
                value={form.installmentCount}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Observacoes
            <textarea
              className={cx(adminTheme.control, "h-24 w-full py-2")}
              maxLength={500}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Opcional"
              value={form.notes}
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button className={adminTheme.secondaryButton} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className={adminTheme.primaryButton}
            disabled={busy || !canSubmit}
            onClick={onSubmit}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            Emitir
          </button>
        </div>
      </section>
    </div>
  );
}

function AnnualClearanceDeclarationDialog({
  busy,
  form,
  onCancel,
  onChange,
  onSubmit,
  studentName,
}: {
  busy: boolean;
  form: AnnualClearanceDeclarationForm;
  onCancel: () => void;
  onChange: (form: AnnualClearanceDeclarationForm) => void;
  onSubmit: () => void;
  studentName: string;
}) {
  const amountCents = moneyInputToCents(form.totalAmount);
  const year = Number(form.year);
  const canSubmit =
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    amountCents > 0 &&
    form.finalClearanceDate.length > 0;

  function update<K extends keyof AnnualClearanceDeclarationForm>(
    key: K,
    value: AnnualClearanceDeclarationForm[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-x-hidden bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl md:max-w-2xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Emitir Declaração de Quitação Anual
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Informe ano, valor total quitado e data da quitação final. Nome, CPF,
            período anual, presidente e data de emissão serão salvos no snapshot.
          </p>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Aluno
            <input
              className={cx(adminTheme.control, "w-full")}
              readOnly
              value={studentName}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Ano de referência
              <input
                className={cx(adminTheme.control, "w-full")}
                max={2100}
                min={2000}
                onChange={(event) => update("year", event.target.value)}
                required
                type="number"
                value={form.year}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Valor total quitado
              <input
                className={cx(adminTheme.control, "w-full")}
                inputMode="numeric"
                onChange={(event) =>
                  update("totalAmount", maskMoneyInput(event.target.value))
                }
                placeholder="R$ 300,00"
                required
                value={form.totalAmount}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Data da quitação final
              <span className="relative">
                <CalendarDays
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  className={cx(adminTheme.control, "w-full pl-9")}
                  onChange={(event) =>
                    update("finalClearanceDate", event.target.value)
                  }
                  required
                  type="date"
                  value={form.finalClearanceDate}
                />
              </span>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Observacoes
            <textarea
              className={cx(adminTheme.control, "h-24 w-full py-2")}
              maxLength={500}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Opcional"
              value={form.notes}
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button className={adminTheme.secondaryButton} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className={adminTheme.primaryButton}
            disabled={busy || !canSubmit}
            onClick={onSubmit}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            Emitir
          </button>
        </div>
      </section>
    </div>
  );
}

function RefundRequestDialog({
  busy,
  form,
  onCancel,
  onChange,
  onSubmit,
  studentName,
}: {
  busy: boolean;
  form: RefundRequestForm;
  onCancel: () => void;
  onChange: (form: RefundRequestForm) => void;
  onSubmit: () => void;
  studentName: string;
}) {
  const amountCents = moneyInputToCents(form.refundAmount);
  const canSubmit =
    amountCents > 0 &&
    form.reason.trim().length > 0 &&
    (form.paymentMethod === "PIX"
      ? form.pixKey.trim().length > 0
      : form.bankName.trim().length > 0 &&
        form.bankAgency.trim().length > 0 &&
        form.bankAccount.trim().length > 0);

  function update<K extends keyof RefundRequestForm>(
    key: K,
    value: RefundRequestForm[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-x-hidden bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl md:max-w-2xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Emitir Solicitação de Reembolso
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Informe valor, motivo e forma de recebimento. Os dados bancarios ficam
            apenas no snapshot do documento.
          </p>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Aluno
            <input
              className={cx(adminTheme.control, "w-full")}
              readOnly
              value={studentName}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Valor do reembolso
              <input
                className={cx(adminTheme.control, "w-full")}
                inputMode="numeric"
                onChange={(event) =>
                  update("refundAmount", maskMoneyInput(event.target.value))
                }
                placeholder="R$ 200,00"
                required
                value={form.refundAmount}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Forma de recebimento
              <select
                className={cx(adminTheme.control, "w-full")}
                onChange={(event) =>
                  update(
                    "paymentMethod",
                    event.target.value as RefundRequestForm["paymentMethod"],
                  )
                }
                value={form.paymentMethod}
              >
                <option value="PIX">PIX</option>
                <option value="BANK_ACCOUNT">Conta bancária</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Motivo da solicitação
            <textarea
              className={cx(adminTheme.control, "h-28 w-full py-2")}
              maxLength={1200}
              onChange={(event) => update("reason", event.target.value)}
              required
              value={form.reason}
            />
          </label>
          {form.paymentMethod === "PIX" ? (
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Chave PIX
              <input
                className={cx(adminTheme.control, "w-full")}
                maxLength={180}
                onChange={(event) => update("pixKey", event.target.value)}
                required
                value={form.pixKey}
              />
            </label>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Banco
                <input
                  className={cx(adminTheme.control, "w-full")}
                  maxLength={80}
                  onChange={(event) => update("bankName", event.target.value)}
                  required
                  value={form.bankName}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Agência
                <input
                  className={cx(adminTheme.control, "w-full")}
                  maxLength={40}
                  onChange={(event) => update("bankAgency", event.target.value)}
                  required
                  value={form.bankAgency}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Conta
                <input
                  className={cx(adminTheme.control, "w-full")}
                  maxLength={80}
                  onChange={(event) => update("bankAccount", event.target.value)}
                  required
                  value={form.bankAccount}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Tipo de conta
                <input
                  className={cx(adminTheme.control, "w-full")}
                  maxLength={40}
                  onChange={(event) => update("bankAccountType", event.target.value)}
                  placeholder="Opcional"
                  value={form.bankAccountType}
                />
              </label>
            </div>
          )}
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Observacoes
            <textarea
              className={cx(adminTheme.control, "h-24 w-full py-2")}
              maxLength={500}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Opcional"
              value={form.notes}
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button className={adminTheme.secondaryButton} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className={adminTheme.primaryButton}
            disabled={busy || !canSubmit}
            onClick={onSubmit}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            Emitir
          </button>
        </div>
      </section>
    </div>
  );
}

function TerminationTermDialog({
  busy,
  form,
  onCancel,
  onChange,
  onSubmit,
  studentName,
}: {
  busy: boolean;
  form: TerminationTermForm;
  onCancel: () => void;
  onChange: (form: TerminationTermForm) => void;
  onSubmit: () => void;
  studentName: string;
}) {
  const canSubmit =
    form.dueDate &&
    form.notificationDate &&
    form.reason.trim().length > 0 &&
    Number(form.regularizationDeadlineDays) > 0;

  function update<K extends keyof TerminationTermForm>(
    key: K,
    value: TerminationTermForm[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Emitir Termo de Desligamento
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Informe os dados de notificacao. O PDF sera emitido com protocolo,
            versao e historico oficial.
          </p>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Aluno
            <input
              className={cx(adminTheme.control, "w-full")}
              readOnly
              value={studentName}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Motivo
            <select
              className={cx(adminTheme.control, "w-full")}
              onChange={(event) => update("reason", event.target.value)}
              value={form.reason}
            >
              <option value="Inadimplência">Inadimplência</option>
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Data do vencimento
              <input
                className={cx(adminTheme.control, "w-full")}
                onChange={(event) => update("dueDate", event.target.value)}
                required
                type="date"
                value={form.dueDate}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Data da notificacao
              <input
                className={cx(adminTheme.control, "w-full")}
                onChange={(event) => update("notificationDate", event.target.value)}
                required
                type="date"
                value={form.notificationDate}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Prazo
              <input
                className={cx(adminTheme.control, "w-full")}
                min={1}
                onChange={(event) =>
                  update("regularizationDeadlineDays", event.target.value)
                }
                type="number"
                value={form.regularizationDeadlineDays}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Observacoes
            <textarea
              className={cx(adminTheme.control, "h-24 w-full py-2")}
              maxLength={500}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Opcional"
              value={form.notes}
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button className={adminTheme.secondaryButton} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className={adminTheme.primaryButton}
            disabled={busy || !canSubmit}
            onClick={onSubmit}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            Emitir
          </button>
        </div>
      </section>
    </div>
  );
}
