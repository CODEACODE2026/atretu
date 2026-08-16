"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  History,
  Plus,
  Power,
  RefreshCw,
  Save,
  ScrollText,
  Send,
} from "lucide-react";
import {
  api,
  type StudentSummary,
  type OfficialDocumentDynamicSignatureMode,
  type IssueInstitutionalOfficialDocumentBody,
  type OfficialDocumentModel,
  type OfficialDocumentVariable,
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
  const [models, setModels] = useState<OfficialDocumentModel[]>([]);
  const [modelIssues, setModelIssues] = useState<OfficialDocumentIssue[]>([]);
  const [variables, setVariables] = useState<OfficialDocumentVariable[]>([]);
  const [modelDialog, setModelDialog] = useState<OfficialDocumentModel | "new" | null>(null);
  const [modelIssueDialog, setModelIssueDialog] =
    useState<OfficialDocumentModel | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [issueDialog, setIssueDialog] =
    useState<OfficialDocumentCatalogItem | null>(null);
  const [historyDialog, setHistoryDialog] =
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
      const [response, modelsResponse, issuesResponse, variablesResponse] =
        await Promise.all([
          api.listInstitutionalOfficialDocuments(),
          api.listOfficialDocumentModels(),
          api.listOfficialDocumentModelIssues(),
          api.listOfficialDocumentVariables(),
        ]);
      setDocuments(response.data);
      setModels(modelsResponse.data);
      setModelIssues(issuesResponse.data);
      setVariables(variablesResponse.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar documentos oficiais.");
    } finally {
      setLoading(false);
    }
  }

  async function saveModel(body: {
    category: string;
    content: string;
    description?: string;
    name: string;
    signatureMode: OfficialDocumentDynamicSignatureMode;
  }) {
    setBusy("model-save");
    setError("");
    setMessage("");
    try {
      if (modelDialog && modelDialog !== "new") {
        await api.updateOfficialDocumentModel(modelDialog.id, body);
        setMessage("Modelo atualizado com nova versão quando houve mudança de conteúdo.");
      } else {
        await api.createOfficialDocumentModel(body);
        setMessage("Modelo criado com sucesso.");
      }
      setModelDialog(null);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar modelo.");
    } finally {
      setBusy("");
    }
  }

  async function toggleModel(model: OfficialDocumentModel) {
    setBusy(`model-status-${model.id}`);
    setError("");
    setMessage("");
    try {
      const nextStatus = model.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.updateOfficialDocumentModelStatus(model.id, nextStatus);
      setMessage(nextStatus === "ACTIVE" ? "Modelo ativado." : "Modelo inativado.");
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao alterar status do modelo.");
    } finally {
      setBusy("");
    }
  }

  async function duplicateModel(model: OfficialDocumentModel) {
    setBusy(`model-duplicate-${model.id}`);
    setError("");
    setMessage("");
    try {
      await api.duplicateOfficialDocumentModel(model.id);
      setMessage("Modelo duplicado com sucesso.");
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao duplicar modelo.");
    } finally {
      setBusy("");
    }
  }

  async function issueModelDocument(
    model: OfficialDocumentModel,
    student: StudentSummary,
    inputs: Record<string, string>,
  ) {
    setBusy(`model-issue-${model.id}`);
    setError("");
    setMessage("");
    try {
      await api.issueDynamicOfficialDocument(student.id, model.id, { inputs });
      setMessage(`${model.name} emitido para ${student.person.fullName}.`);
      setModelIssueDialog(null);
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao emitir modelo.");
    } finally {
      setBusy("");
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
        description="Modelos, emissao e historico de documentos oficiais da ATRETU."
        eyebrow="Documentos Oficiais"
        icon={ScrollText}
        title="Documentos Oficiais"
      />

      <section className={adminTheme.card}>
        <AdminSectionHeader
          action={
            <button
              className={adminTheme.primaryButton}
              disabled={Boolean(busy)}
              onClick={() => setModelDialog("new")}
              type="button"
            >
              <Plus size={16} />
              Novo modelo
            </button>
          }
          description="Modelos em texto simples com variaveis controladas, versao atual e historico imutavel nas emissoes."
          title="Modelos"
        />
        {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}
        {message ? <AdminFeedback tone="green">{message}</AdminFeedback> : null}
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {loading ? (
            <AdminEmptyState loading title="Carregando modelos..." />
          ) : models.length === 0 ? (
            <AdminEmptyState title="Nenhum modelo dinamico cadastrado" />
          ) : (
            models.map((model) => (
              <ModelCard
                busy={busy}
                key={model.id}
                model={model}
                onDuplicate={() => void duplicateModel(model)}
                onEdit={() => setModelDialog(model)}
                onIssue={() => setModelIssueDialog(model)}
                onToggle={() => void toggleModel(model)}
              />
            ))
          )}
        </div>
      </section>

      <section className={adminTheme.card}>
        <AdminSectionHeader
          description="Emissoes geradas a partir de modelos dinamicos, salvas no historico oficial com snapshot."
          title="Documentos emitidos"
        />
        <div className="grid gap-3 p-4">
          {loading ? (
            <AdminEmptyState loading title="Carregando emissoes..." />
          ) : modelIssues.length === 0 ? (
            <AdminEmptyState title="Nenhum documento dinamico emitido" />
          ) : (
            modelIssues.map((issue) => (
              <div
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 lg:grid-cols-[1fr_auto]"
                key={issue.id}
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {issue.model?.name ?? "Modelo removido"} · v{issue.templateVersion}
                  </p>
                  <p className="mt-1">
                    {issue.studentName ?? "Academico nao identificado"} · {issue.protocol} · {formatDateTime(issue.issuedAt)}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Snapshot preservado
                </span>
              </div>
            ))
          )}
        </div>
      </section>

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
                  onHistory={() => setHistoryDialog(item)}
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

      {historyDialog ? (
        <InstitutionalHistoryDialog
          busy={busy}
          item={historyDialog}
          onClose={() => setHistoryDialog(null)}
          onDownload={(issue) => openIssue(issue, "attachment")}
          onReissue={(issue) => reissueDocument(historyDialog, issue)}
          onView={(issue) => openIssue(issue, "inline")}
        />
      ) : null}
      {modelDialog ? (
        <ModelDialog
          busy={busy === "model-save"}
          model={modelDialog === "new" ? null : modelDialog}
          onCancel={() => setModelDialog(null)}
          onSubmit={saveModel}
          variables={variables}
        />
      ) : null}
      {modelIssueDialog ? (
        <ModelIssueDialog
          busy={busy === `model-issue-${modelIssueDialog.id}`}
          model={modelIssueDialog}
          onCancel={() => setModelIssueDialog(null)}
          onSubmit={(student, inputs) =>
            void issueModelDocument(modelIssueDialog, student, inputs)
          }
        />
      ) : null}
    </div>
  );
}

function InstitutionalDocumentCard({
  busy,
  item,
  onDownload,
  onHistory,
  onIssue,
  onReissue,
  onView,
}: {
  busy: string;
  item: OfficialDocumentCatalogItem;
  onDownload: (issue: OfficialDocumentIssue) => void;
  onHistory: () => void;
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
          <p>
            <span className="font-semibold text-slate-950">Versão vigente:</span>{" "}
            v{item.latestIssue.templateVersion}
          </p>
          {item.latestIssue.approvalDate ? (
            <p>
              <span className="font-semibold text-slate-950">
                Data de aprovação:
              </span>{" "}
              {formatDate(item.latestIssue.approvalDate)}
            </p>
          ) : null}
          <p>
            <span className="font-semibold text-slate-950">Protocolo da versão:</span>{" "}
            {item.latestIssue.protocol}
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
        {item.latestIssue ? (
          <>
            <button
              className={cx(adminTheme.secondaryButton, "min-h-10")}
              disabled={Boolean(busy)}
              onClick={() => onView(item.latestIssue!)}
              type="button"
            >
              <Eye size={16} />
              Visualizar
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
            <button
              className={cx(adminTheme.secondaryButton, "min-h-10")}
              disabled={Boolean(busy)}
              onClick={onHistory}
              type="button"
            >
              <History size={16} />
              Histórico
            </button>
          </>
        ) : null}
        <button
          className={cx(adminTheme.primaryButton, "min-h-10")}
          disabled={Boolean(busy)}
          onClick={onIssue}
          type="button"
        >
          <Send size={16} />
          Emitir
        </button>
      </div>
    </article>
  );
}

function ModelCard({
  busy,
  model,
  onDuplicate,
  onEdit,
  onIssue,
  onToggle,
}: {
  busy: string;
  model: OfficialDocumentModel;
  onDuplicate: () => void;
  onEdit: () => void;
  onIssue: () => void;
  onToggle: () => void;
}) {
  const isActive = model.status === "ACTIVE";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">{model.name}</h2>
            <AdminStatusBadge tone={model.status === "ACTIVE" ? "green" : "slate"}>
              {model.status === "ACTIVE" ? "Ativo" : "Inativo"}
            </AdminStatusBadge>
            <AdminStatusBadge tone="blue">v{model.currentVersion}</AdminStatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {model.description || "Sem descricao."}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
            {model.category} · {model.variableTokens.length} variavel(is)
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
          <FileText aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      <pre className="mt-4 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        {model.content}
      </pre>
      <div className="mt-4 flex flex-wrap gap-2">
        {isActive ? (
          <button className={adminTheme.primaryButton} disabled={Boolean(busy)} onClick={onIssue} type="button">
            <Send size={16} />
            Emitir
          </button>
        ) : null}
        <button className={adminTheme.secondaryButton} disabled={Boolean(busy)} onClick={onEdit} type="button">
          <Edit3 size={16} />
          Editar
        </button>
        <button className={adminTheme.secondaryButton} disabled={Boolean(busy)} onClick={onDuplicate} type="button">
          <Copy size={16} />
          Duplicar
        </button>
        <button className={adminTheme.secondaryButton} disabled={Boolean(busy)} onClick={onToggle} type="button">
          <Power size={16} />
          {model.status === "ACTIVE" ? "Inativar" : "Ativar"}
        </button>
      </div>
    </article>
  );
}

function ModelIssueDialog({
  busy,
  model,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  model: OfficialDocumentModel;
  onCancel: () => void;
  onSubmit: (student: StudentSummary, inputs: Record<string, string>) => void;
}) {
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState<
    Array<{ label?: string; name: string }>
  >([]);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const manualFieldsComplete = model.manualInputTokens.every((token) =>
    Boolean(inputs[token]?.trim()),
  );

  function updateInput(token: string, value: string) {
    setInputs((current) => ({ ...current, [token]: value }));
    setPreview("");
  }

  async function searchStudents() {
    const search = studentSearch.trim();
    if (!search) {
      setError("Informe nome, CPF ou carteirinha para buscar.");
      return;
    }
    setSearching(true);
    setError("");
    setPreview("");
    try {
      const response = await api.listStudents({
        limit: 8,
        search,
        sort: "name",
        status: "all",
      });
      setStudents(response.data);
      if (response.data.length === 0) {
        setSelectedStudent(null);
        setError("Nenhum acadêmico encontrado.");
      }
    } catch (caught) {
      setStudents([]);
      setSelectedStudent(null);
      setError(caught instanceof Error ? caught.message : "Erro ao buscar acadêmico.");
    } finally {
      setSearching(false);
    }
  }

  async function loadPreview() {
    if (!selectedStudent) {
      setError("Selecione um acadêmico para gerar a prévia.");
      return;
    }
    if (!manualFieldsComplete) {
      setError("Preencha os campos manuais obrigatórios.");
      return;
    }
    setPreviewing(true);
    setError("");
    try {
      const response = await api.previewDynamicOfficialDocument(
        selectedStudent.id,
        model.id,
        { inputs },
      );
      setPreview(response.resolvedContent);
      setSignaturePreview(response.signaturePreview);
    } catch (caught) {
      setPreview("");
      setSignaturePreview([]);
      setError(caught instanceof Error ? caught.message : "Erro ao gerar prévia.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4">
      <form
        aria-labelledby="model-issue-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-5xl sm:rounded-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedStudent) {
            setError("Selecione um acadêmico para confirmar a emissão.");
            return;
          }
          if (!preview) {
            setError("Gere a prévia antes de confirmar a emissão.");
            return;
          }
          onSubmit(selectedStudent, inputs);
        }}
        role="dialog"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Emitir pelo modelo
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950" id="model-issue-title">
              {model.name} · v{model.currentVersion}
            </h2>
          </div>
          <AdminStatusBadge tone="green">Ativo</AdminStatusBadge>
        </div>

        {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}

        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="grid min-w-0 gap-4">
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-950">Buscar acadêmico</h3>
              <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  className={cx(adminTheme.control, "min-w-0 flex-1")}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Nome, CPF ou carteirinha"
                  type="search"
                  value={studentSearch}
                />
                <button
                  className={cx(adminTheme.primaryButton, "justify-center")}
                  disabled={busy || searching}
                  onClick={() => void searchStudents()}
                  type="button"
                >
                  {searching ? "Buscando..." : "Buscar"}
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                {students.map((student) => {
                  const selected = selectedStudent?.id === student.id;
                  return (
                    <button
                      className={cx(
                        "min-w-0 rounded-lg border p-3 text-left text-sm transition",
                        selected
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-slate-50",
                      )}
                      key={student.id}
                      onClick={() => {
                        setSelectedStudent(student);
                        setPreview("");
                        setSignaturePreview([]);
                        setError("");
                      }}
                      type="button"
                    >
                      <span className="block break-words font-semibold text-slate-950">
                        {student.person.fullName}
                      </span>
                      <span className="mt-1 block break-words text-xs text-slate-600">
                        {student.person.cpfMasked} ·{" "}
                        {student.currentStudentCard?.cardNumber ?? "sem carteirinha ativa"} ·{" "}
                        {student.currentEnrollment?.academicYear.year ?? "sem matrícula ativa"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {model.manualInputTokens.length > 0 ? (
              <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-sm font-semibold text-slate-950">Campos manuais</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {model.manualInputTokens.map((token) => (
                    <label className="grid gap-1 text-sm font-medium text-slate-700" key={token}>
                      {token}
                      <input
                        className={adminTheme.control}
                        onChange={(event) => updateInput(token, event.target.value)}
                        required
                        value={inputs[token] ?? ""}
                      />
                    </label>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Este modelo não possui campos manuais.
              </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-950">Prévia</h3>
                <button
                  className={adminTheme.secondaryButton}
                  disabled={busy || previewing || !selectedStudent || !manualFieldsComplete}
                  onClick={() => void loadPreview()}
                  type="button"
                >
                  <Eye size={15} />
                  {previewing ? "Gerando..." : "Gerar prévia"}
                </button>
              </div>
              <pre className="mt-3 max-h-72 min-h-32 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {preview || model.content}
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
          </div>

          <aside className="grid h-fit gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <h3 className="text-sm font-semibold text-slate-950">Confirmação</h3>
            <DetailLine label="Modelo" value={model.name} />
            <DetailLine label="Versão" value={`v${model.currentVersion}`} />
            <DetailLine
              label="Acadêmico"
              value={selectedStudent?.person.fullName ?? "não selecionado"}
            />
            <DetailLine
              label="Campos manuais"
              value={
                model.manualInputTokens.length > 0
                  ? `${model.manualInputTokens.length} campo(s)`
                  : "não possui"
              }
            />
            <DetailLine label="Prévia" value={preview ? "gerada" : "pendente"} />
            <DetailLine
              label="Assinaturas"
              value={
                signaturePreview.length > 0
                  ? `${signaturePreview.length} bloco(s)`
                  : "nenhuma"
              }
            />
          </aside>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className={cx(adminTheme.secondaryButton, "justify-center")}
            disabled={busy || previewing || searching}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={cx(adminTheme.primaryButton, "justify-center")}
            disabled={busy || !selectedStudent || !manualFieldsComplete || !preview}
            type="submit"
          >
            <Send size={16} />
            {busy ? "Emitindo..." : "Confirmar emissão"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="font-semibold text-slate-950">{label}:</span>{" "}
      <span className="break-words">{value}</span>
    </p>
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

function variableCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    association: "Associação",
    document: "Documento",
    enrollment: "Matrícula",
    input: "Campos manuais",
    institution: "Instituição",
    student: "Acadêmico",
  };
  return labels[category] ?? category;
}

function ModelDialog({
  busy,
  model,
  onCancel,
  onSubmit,
  variables,
}: {
  busy: boolean;
  model: OfficialDocumentModel | null;
  onCancel: () => void;
  onSubmit: (body: {
    category: string;
    content: string;
    description?: string;
    name: string;
    signatureMode: OfficialDocumentDynamicSignatureMode;
  }) => void;
  variables: OfficialDocumentVariable[];
}) {
  const [name, setName] = useState(model?.name ?? "");
  const [description, setDescription] = useState(model?.description ?? "");
  const [category, setCategory] = useState(model?.category ?? "Geral");
  const [content, setContent] = useState(model?.content ?? "");
  const [signatureMode, setSignatureMode] = useState<OfficialDocumentDynamicSignatureMode>(
    model?.signatureMode ?? "NONE",
  );
  const insertVariable = (token: string) => {
    setContent((current) => `${current}${current.endsWith(" ") || current.endsWith("\n") || current === "" ? "" : " "}{{${token}}}`);
  };
  const grouped = variables.reduce<Record<string, OfficialDocumentVariable[]>>((acc, item) => {
    acc[item.category] = [...(acc[item.category] ?? []), item];
    return acc;
  }, {});
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4">
      <form
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-5xl sm:rounded-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            category,
            content,
            description: description.trim() || undefined,
            name,
            signatureMode,
          });
        }}
        role="dialog"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Modelo de documento
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {model ? "Editar modelo" : "Novo modelo"}
            </h2>
          </div>
          <AdminStatusBadge tone="blue">Texto simples</AdminStatusBadge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Título
              <input className={adminTheme.control} onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Descrição
              <input className={adminTheme.control} onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Categoria
              <input className={adminTheme.control} onChange={(event) => setCategory(event.target.value)} required value={category} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Conteúdo
              <textarea
                className="min-h-72 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setContent(event.target.value)}
                required
                value={content}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Assinaturas no documento
              <select
                className={adminTheme.control}
                onChange={(event) =>
                  setSignatureMode(
                    event.target.value as OfficialDocumentDynamicSignatureMode,
                  )
                }
                value={signatureMode}
              >
                <option value="NONE">Nenhuma</option>
                <option value="STUDENT">Acadêmico</option>
                <option value="BOARD">Diretoria</option>
                <option value="STUDENT_BOARD">Acadêmico + Diretoria</option>
              </select>
            </label>
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-950">Prévia</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{content || "Sem conteudo."}</pre>
              {signatureMode !== "NONE" ? (
                <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
                  {signatureMode === "STUDENT" || signatureMode === "STUDENT_BOARD" ? (
                    <SignaturePreviewBlock label="Acadêmico" name="{{student.name}}" />
                  ) : null}
                  {signatureMode === "BOARD" || signatureMode === "STUDENT_BOARD" ? (
                    <SignaturePreviewBlock
                      label="Cargo · Associação"
                      name="Signatário da diretoria"
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-950">Inserir variável</h3>
            <div className="mt-3 grid gap-3">
              {Object.entries(grouped).map(([categoryName, items]) => (
                <section key={categoryName}>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {variableCategoryLabel(categoryName)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {items.map((item) => (
                      <button
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                        key={item.token}
                        onClick={() => insertVariable(item.token)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className={cx(adminTheme.secondaryButton, "justify-center")} disabled={busy} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className={cx(adminTheme.primaryButton, "justify-center")} disabled={busy} type="submit">
            <Save size={16} />
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

function InstitutionalHistoryDialog({
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
  onReissue: (issue: OfficialDocumentIssue) => void;
  onView: (issue: OfficialDocumentIssue) => void;
}) {
  const grouped = item.history.reduce<Record<string, OfficialDocumentIssue[]>>(
    (groups, issue) => {
      const key = `v${issue.templateVersion}`;
      groups[key] = [...(groups[key] ?? []), issue];
      return groups;
    },
    {},
  );

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4">
      <section
        aria-labelledby="institutional-history-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-4xl sm:rounded-2xl"
        role="dialog"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Histórico de versões
            </p>
            <h2
              className="mt-1 text-lg font-semibold text-slate-950"
              id="institutional-history-title"
            >
              {item.title}
            </h2>
          </div>
          <button
            className={cx(adminTheme.secondaryButton, "min-h-10 justify-center")}
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {Object.entries(grouped).map(([version, issues]) => (
            <section
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              key={version}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-950">
                  Versão {version}
                </h3>
                {issues[0]?.approvalDate ? (
                  <span className="text-sm text-slate-600">
                    Aprovada em {formatDate(issues[0].approvalDate)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {issues.map((issue) => {
                  const signer =
                    issue.signerDetails[0]?.signerName ??
                    "Signatario nao identificado";
                  return (
                    <div
                      className="grid gap-3 rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm lg:grid-cols-[1fr_auto]"
                      key={issue.id}
                    >
                      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          <span className="font-semibold text-slate-950">
                            Protocolo:
                          </span>{" "}
                          {issue.protocol}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">
                            Emitido por:
                          </span>{" "}
                          {issue.issuedBy?.name ?? "Usuario nao identificado"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">
                            Assinado por:
                          </span>{" "}
                          {signer}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">
                            Data:
                          </span>{" "}
                          {formatDateTime(issue.issuedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
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
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
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
