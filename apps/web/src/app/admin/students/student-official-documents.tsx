"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileCheck2, RefreshCcw, Send } from "lucide-react";
import type {
  IssueOfficialDocumentBody,
  OfficialDocumentCatalogItem,
  OfficialDocumentIssue,
} from "../../../lib/api";
import { api } from "../../../lib/api";
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
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [termDialog, setTermDialog] = useState<OfficialDocumentCatalogItem | null>(null);
  const [termForm, setTermForm] = useState(defaultTerminationTermForm());

  useEffect(() => {
    void loadDocuments();
  }, [studentId]);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listStudentOfficialDocuments(studentId);
      setDocuments(response.data);
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

  function requestIssueDocument(item: OfficialDocumentCatalogItem) {
    if (item.type === "TERMINATION_TERM") {
      setTermForm(defaultTerminationTermForm());
      setTermDialog(item);
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

  return (
    <section className={cx(adminTheme.card, "overflow-hidden")}>
      <AdminSectionHeader
        action={
          <button
            className={adminTheme.secondaryButton}
            disabled={loading || busy !== ""}
            onClick={() => void loadDocuments()}
            type="button"
          >
            <RefreshCcw aria-hidden="true" size={16} />
            Atualizar
          </button>
        }
        description="Documentos emitidos pelo Atretu com protocolo, historico e PDF institucional."
        title="Documentos Oficiais"
      />
      {message ? <AdminFeedback tone="green">{message}</AdminFeedback> : null}
      {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}
      <div className="grid gap-3 p-4">
        {loading ? (
          <AdminEmptyState loading title="Carregando documentos oficiais..." />
        ) : documents.length === 0 ? (
          <AdminEmptyState
            description="Nenhum documento oficial esta configurado para este academico."
            title="Sem documentos oficiais"
          />
        ) : (
          documents.map((item) => (
            <OfficialDocumentCard
              busy={busy}
              item={item}
              key={item.type}
              onDownload={(issue) => void openIssue(issue, "attachment")}
              onIssue={() => requestIssueDocument(item)}
              onReissue={() => void reissueDocument(item)}
              onView={(issue) => void openIssue(issue, "inline")}
            />
          ))
        )}
      </div>
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
    </section>
  );
}

function OfficialDocumentCard({
  busy,
  item,
  onDownload,
  onIssue,
  onReissue,
  onView,
}: {
  busy: string;
  item: OfficialDocumentCatalogItem;
  onDownload: (issue: OfficialDocumentIssue) => void;
  onIssue: () => void;
  onReissue: () => void;
  onView: (issue: OfficialDocumentIssue) => void;
}) {
  const latest = item.latestIssue;
  const isBusy = busy.startsWith(item.type) || (latest ? busy.startsWith(latest.id) : false);
  return (
    <article className={cx(adminTheme.softPanel, "grid gap-4 p-4")}>
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#0F2E2E] shadow-sm">
              <FileCheck2 aria-hidden="true" size={18} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>
            </div>
          </div>
        </div>
        <AdminStatusBadge tone={latest ? "green" : "orange"}>
          {latest ? "Emitido" : "Pendente"}
        </AdminStatusBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Info label="Situacao" value={latest ? "Com historico" : "Nao emitido"} />
        <Info
          label="Ultima emissao"
          value={latest ? formatDateTime(latest.issuedAt) : "Sem emissao"}
        />
        <Info
          label="Protocolo"
          value={latest ? `${latest.protocol} · v${latest.version}` : "Aguardando"}
        />
      </div>

      {latest ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
          <p>
            Emitido por {latest.issuedBy?.name ?? "usuario removido"} ·{" "}
            {formatBytes(latest.sizeBytes)}
          </p>
          {latest.signerDetails[0]?.name ? (
            <p className="mt-1">
              Assinado por {latest.signerDetails[0].name}
              {latest.signerDetails[0].label
                ? ` · ${latest.signerDetails[0].label}`
                : ""}
              {latest.signerDetails[0].boardPeriodStart
                ? ` · Vigencia: ${formatDateTime(latest.signerDetails[0].boardPeriodStart)}`
                : ""}
            </p>
          ) : null}
          {latest.termDetails ? (
            <p className="mt-1">
              Motivo: {latest.termDetails.reason ?? "nao informado"} ·
              Vencimento:{" "}
              {latest.termDetails.dueDate
                ? formatDateTime(latest.termDetails.dueDate)
                : "nao informado"}{" "}
              · Prazo: {latest.termDetails.regularizationDeadlineDays ?? "-"} dias
            </p>
          ) : null}
          {item.history.length > 1 ? (
            <div className="mt-2 grid gap-1 border-t border-slate-200 pt-2">
              <p className="font-semibold text-slate-700">
                Historico: {item.history.length} emissoes registradas.
              </p>
              {item.history.slice(0, 3).map((issue) => (
                <p className="text-xs text-slate-500" key={issue.id}>
                  {formatDateTime(issue.issuedAt)} · Emitido por{" "}
                  {issue.issuedBy?.name ?? "usuario removido"} · Assinado por{" "}
                  {issue.signerDetails[0]?.name ?? "nao informado"}
                  {issue.signerDetails[0]?.label
                    ? ` · ${issue.signerDetails[0].label}`
                    : ""}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : item.blockedReason ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {item.blockedReason}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className={adminTheme.primaryButton}
          disabled={!item.canIssue || isBusy}
          onClick={onIssue}
          type="button"
        >
          <Send aria-hidden="true" size={16} />
          Emitir
        </button>
        <button
          className={adminTheme.secondaryButton}
          disabled={!latest || isBusy}
          onClick={() => latest && onView(latest)}
          type="button"
        >
          <Eye aria-hidden="true" size={16} />
          Visualizar
        </button>
        <button
          className={adminTheme.secondaryButton}
          disabled={!latest || isBusy}
          onClick={onReissue}
          type="button"
        >
          <RefreshCcw aria-hidden="true" size={16} />
          Reemitir
        </button>
        <button
          className={adminTheme.secondaryButton}
          disabled={!latest || isBusy}
          onClick={() => latest && onDownload(latest)}
          type="button"
        >
          <Download aria-hidden="true" size={16} />
          Baixar PDF
        </button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

type TerminationTermForm = {
  dueDate: string;
  notificationDate: string;
  notes: string;
  reason: string;
  regularizationDeadlineDays: string;
};

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
