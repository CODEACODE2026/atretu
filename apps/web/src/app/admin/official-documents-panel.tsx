"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  History,
  RefreshCw,
  ScrollText,
  Send,
} from "lucide-react";
import {
  api,
  type IssueInstitutionalOfficialDocumentBody,
  type OfficialDocumentCatalogItem,
  type OfficialDocumentIssue,
} from "../../lib/api";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
} from "./components/admin-ui";
import { formatDateTime } from "./students/student-profile-utils";

export function OfficialDocumentsPanel() {
  const [documents, setDocuments] = useState<OfficialDocumentCatalogItem[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [issueDialog, setIssueDialog] =
    useState<OfficialDocumentCatalogItem | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listInstitutionalOfficialDocuments();
      setDocuments(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar documentos oficiais.");
    } finally {
      setLoading(false);
    }
  }

  async function issueDocument(
    item: OfficialDocumentCatalogItem,
    body?: IssueInstitutionalOfficialDocumentBody,
  ) {
    setBusy(`issue-${item.type}`);
    setError("");
    setMessage("");
    try {
      await api.issueInstitutionalOfficialDocument(item.type, body);
      setMessage(`${item.title} emitido com sucesso.`);
      setIssueDialog(null);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao emitir documento.");
    } finally {
      setBusy("");
    }
  }

  async function reissueDocument(item: OfficialDocumentCatalogItem, issue = item.latestIssue) {
    if (!issue) return;
    setBusy(`reissue-${issue.id}`);
    setError("");
    setMessage("");
    try {
      await api.reissueInstitutionalOfficialDocument(issue.id);
      setMessage(`${item.title} reemitido com sucesso.`);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao reemitir documento.");
    } finally {
      setBusy("");
    }
  }

  async function openIssue(issue: OfficialDocumentIssue, disposition: "attachment" | "inline") {
    setBusy(`${disposition}-${issue.id}`);
    setError("");
    try {
      const { blob, fileName } = await api.downloadInstitutionalOfficialDocument(
        issue.id,
        disposition,
      );
      const url = URL.createObjectURL(blob);
      if (disposition === "inline") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir documento.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <AdminModuleHeader
        description="Emissao e historico de documentos oficiais institucionais da ATRETU."
        eyebrow="Documentos Oficiais"
        icon={ScrollText}
        title="Documentos Oficiais"
      />

      <section className={adminTheme.card}>
        <AdminSectionHeader
          description="Regimento Interno e demais documentos gerais da instituicao, sem vinculo com academico especifico."
          title="Institucionais"
        />
        {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}
        {message ? <AdminFeedback tone="green">{message}</AdminFeedback> : null}

        <div className="p-4">
          {loading ? (
            <AdminEmptyState loading title="Carregando documentos oficiais..." />
          ) : documents.length === 0 ? (
            <AdminEmptyState title="Nenhum documento institucional configurado" />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {documents.map((item) => (
                <InstitutionalDocumentCard
                  busy={busy}
                  item={item}
                  key={item.type}
                  onDownload={(issue) => openIssue(issue, "attachment")}
                  onIssue={() => setIssueDialog(item)}
                  onReissue={(issue) => reissueDocument(item, issue)}
                  onView={(issue) => openIssue(issue, "inline")}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {issueDialog ? (
        <InstitutionalIssueDialog
          busy={busy === `issue-${issueDialog.type}`}
          item={issueDialog}
          onCancel={() => setIssueDialog(null)}
          onSubmit={(body) => issueDocument(issueDialog, body)}
        />
      ) : null}
    </div>
  );
}

function InstitutionalDocumentCard({
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
  onReissue: (issue: OfficialDocumentIssue) => void;
  onView: (issue: OfficialDocumentIssue) => void;
}) {
  const signer = item.latestIssue?.signerDetails[0] ?? null;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
            <AdminStatusBadge tone={item.latestIssue ? "green" : "slate"}>
              {item.latestIssue ? "Emitido" : "Nao emitido"}
            </AdminStatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
          <FileText aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>

      {item.latestIssue ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {item.latestIssue.approvalDate ? (
            <p>
              <span className="font-semibold text-slate-950">
                Data de aprovação:
              </span>{" "}
              {formatDate(item.latestIssue.approvalDate)}
            </p>
          ) : null}
          <p>
            <span className="font-semibold text-slate-950">Versão:</span>{" "}
            v{item.latestIssue.templateVersion}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Protocolo:</span>{" "}
            {item.latestIssue.protocol}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Emitido em:</span>{" "}
            {formatDateTime(item.latestIssue.issuedAt)}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Emitido por:</span>{" "}
            {item.latestIssue.issuedBy?.name ?? "Usuario nao identificado"}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Assinado por:</span>{" "}
            {signer?.signerName ?? "Signatario nao identificado"}
            {signer?.signerRoleLabel ? ` - ${signer.signerRoleLabel}` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className={cx(adminTheme.primaryButton, "min-h-10")}
          disabled={Boolean(busy)}
          onClick={onIssue}
          type="button"
        >
          <Send size={16} />
          Emitir
        </button>
        {item.latestIssue ? (
          <>
            <button
              className={cx(adminTheme.secondaryButton, "min-h-10")}
              disabled={Boolean(busy)}
              onClick={() => onView(item.latestIssue!)}
              type="button"
            >
              <Eye size={16} />
              Visualizar versão atual
            </button>
            <button
              className={cx(adminTheme.secondaryButton, "min-h-10")}
              disabled={Boolean(busy)}
              onClick={() => onDownload(item.latestIssue!)}
              type="button"
            >
              <Download size={16} />
              Baixar
            </button>
            <button
              className={cx(adminTheme.secondaryButton, "min-h-10")}
              disabled={Boolean(busy)}
              onClick={() => onReissue(item.latestIssue!)}
              type="button"
            >
              <RefreshCw size={16} />
              Reemitir
            </button>
          </>
        ) : null}
      </div>

      {item.history.length ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <History aria-hidden="true" className="h-4 w-4" />
            Historico de emissoes
          </div>
          <div className="space-y-2">
            {item.history.map((issue) => (
              <div
                className="grid gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 lg:grid-cols-[1fr_auto]"
                key={issue.id}
              >
                <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-4">
                  <span>{issue.protocol}</span>
                  <span>
                    v{issue.templateVersion}
                    {issue.approvalDate
                      ? ` • ${formatDate(issue.approvalDate)}`
                      : ""}
                  </span>
                  <span>
                    {issue.signerDetails[0]?.signerName ??
                      "Signatario nao identificado"}
                  </span>
                  <span>{formatDateTime(issue.issuedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={cx(adminTheme.secondaryButton, "min-h-9")}
                    disabled={Boolean(busy)}
                    onClick={() => onView(issue)}
                    type="button"
                  >
                    <Eye size={15} />
                    Visualizar
                  </button>
                  <button
                    className={cx(adminTheme.secondaryButton, "min-h-9")}
                    disabled={Boolean(busy)}
                    onClick={() => onDownload(issue)}
                    type="button"
                  >
                    <Download size={15} />
                    Baixar
                  </button>
                  <button
                    className={cx(adminTheme.secondaryButton, "min-h-9")}
                    disabled={Boolean(busy)}
                    onClick={() => onReissue(issue)}
                    type="button"
                  >
                    <RefreshCw size={15} />
                    Reemitir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function InstitutionalIssueDialog({
  busy,
  item,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  item: OfficialDocumentCatalogItem;
  onCancel: () => void;
  onSubmit: (body: IssueInstitutionalOfficialDocumentBody) => void;
}) {
  const [approvalDate, setApprovalDate] = useState("2022-12-20");
  const [notes, setNotes] = useState("");
  const signer = item.signerPreview;
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <form
        aria-labelledby="institutional-issue-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ approvalDate, notes: notes.trim() || undefined });
        }}
        role="dialog"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Documento institucional
            </p>
            <h2
              className="mt-1 text-lg font-semibold text-slate-950"
              id="institutional-issue-title"
            >
              Emitir Regimento Interno
            </h2>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <CalendarDays aria-hidden="true" className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-950">Versão:</span> v1
          </p>
          <p>
            <span className="font-semibold text-slate-950">Signatário:</span>{" "}
            {signer?.signerName
              ? `${signer.signerName} - ${signer.signerRoleLabel ?? "Presidente"}`
              : signer?.error ?? "Presidente vigente nao localizado"}
          </p>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Data de aprovação
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setApprovalDate(event.target.value)}
            required
            type="date"
            value={approvalDate}
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Observações
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            maxLength={500}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className={cx(adminTheme.secondaryButton, "justify-center")}
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={cx(adminTheme.primaryButton, "justify-center")}
            disabled={busy}
            type="submit"
          >
            <Send size={16} />
            Emitir
          </button>
        </div>
      </form>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}
