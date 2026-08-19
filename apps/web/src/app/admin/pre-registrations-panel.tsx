"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clipboard,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  type LucideIcon,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import {
  api,
  type AcademicYear,
  type BaseRecord,
  type BusRecord,
  type PreRegistrationDetail,
  type PreRegistrationDocumentRecord,
  type PreRegistrationStatus,
  type PreRegistrationSummary,
  type StudentDocumentType,
} from "../../lib/api";
import { maskCpf, maskPhone } from "../../lib/formatters";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminEmptyState,
  AdminModuleHeader,
  AdminStatusBadge,
} from "./components/admin-ui";

type PreRegistrationStatusFilter = PreRegistrationStatus | "all";
type PreRegistrationFilterChip = {
  key: "academicYear" | "institution" | "status";
  label: string;
  fromDashboard: boolean;
};

const statuses: Array<{ label: string; value: PreRegistrationStatusFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Aprovados", value: "APPROVED" },
  { label: "Rejeitados", value: "REJECTED" },
];

const documentLabels: Record<string, string> = {
  CPF: "CPF",
  RG: "RG",
  PROOF_OF_ADDRESS: "Comprovante de residencia",
  PROOF_OF_ENROLLMENT: "Comprovante de matricula",
};

const expectedDocumentTypes: StudentDocumentType[] = [
  "CPF",
  "RG",
  "PROOF_OF_ADDRESS",
  "PROOF_OF_ENROLLMENT",
];

type DocumentPreviewState = {
  document: PreRegistrationDocumentRecord;
  fileName: string;
  url: string;
};

export function PreRegistrationsPanel({
  initialAcademicYearId,
  initialInstitutionId,
  initialStatus,
}: {
  initialAcademicYearId?: string;
  initialInstitutionId?: string;
  initialStatus?: PreRegistrationStatus;
}) {
  const [items, setItems] = useState<PreRegistrationSummary[]>([]);
  const [selected, setSelected] = useState<PreRegistrationDetail | null>(null);
  const [status, setStatus] = useState<PreRegistrationStatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referencesError, setReferencesError] = useState("");
  const [dashboardSourceApplied, setDashboardSourceApplied] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalBusId, setApprovalBusId] = useState("");
  const [approvalBuses, setApprovalBuses] = useState<BusRecord[]>([]);
  const [approvalBusesLoading, setApprovalBusesLoading] = useState(false);
  const [approvalBusesError, setApprovalBusesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");
  const [documentPreview, setDocumentPreview] = useState<DocumentPreviewState | null>(null);
  const initialFilterValues = useMemo(
    () => ({
      academicYearId: initialAcademicYearId ?? "",
      institutionId: initialInstitutionId ?? "",
      status: initialStatus ?? "",
    }),
    [initialAcademicYearId, initialInstitutionId, initialStatus],
  );
  const activeFilterChips = useMemo(
    () =>
      [
        academicYearId
          ? {
              key: "academicYear" as const,
              label: `Ano letivo: ${yearLabel(years, academicYearId)}`,
              fromDashboard: academicYearId === initialFilterValues.academicYearId,
            }
          : null,
        institutionId
          ? {
              key: "institution" as const,
              label: `Instituicao: ${institutionLabel(institutions, institutionId)}`,
              fromDashboard: institutionId === initialFilterValues.institutionId,
            }
          : null,
        status !== "all"
          ? {
              key: "status" as const,
              label: `Status: ${statusLabel(status)}`,
              fromDashboard: status === initialFilterValues.status,
            }
          : null,
      ].filter(isPreRegistrationFilterChip),
    [academicYearId, initialFilterValues, institutionId, institutions, status, years],
  );
  const hasActiveFilters =
    Boolean(search.trim()) ||
    academicYearId !== "" ||
    institutionId !== "" ||
    status !== "all";
  const hasDashboardOrigin =
    dashboardSourceApplied && activeFilterChips.some((chip) => chip.fromDashboard);

  useEffect(() => {
    void loadItems();
  }, [academicYearId, institutionId, status, page]);

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    if (initialAcademicYearId) {
      setAcademicYearId(initialAcademicYearId);
    }
    if (initialInstitutionId) {
      setInstitutionId(initialInstitutionId);
    }
    if (!initialStatus) {
      setDashboardSourceApplied(Boolean(initialAcademicYearId || initialInstitutionId));
      setPage(1);
      return;
    }
    setStatus(initialStatus);
    setPage(1);
    setDashboardSourceApplied(true);
  }, [initialAcademicYearId, initialInstitutionId, initialStatus]);

  useEffect(() => {
    if (!selected || selected.status !== "PENDING") {
      setApprovalBusId("");
      setApprovalBuses([]);
      setApprovalBusesError("");
      return;
    }
    void loadApprovalBuses(selected.academicYear.id);
  }, [selected?.id, selected?.status, selected?.academicYear.id]);

  useEffect(() => {
    return () => {
      if (documentPreview) {
        URL.revokeObjectURL(documentPreview.url);
      }
    };
  }, [documentPreview]);

  async function loadItems(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const response = await api.listPreRegistrations({
        page,
        limit: 10,
        search: nextSearch,
        academicYearId,
        institutionId,
        status,
        sort: "createdAt",
        order: "desc",
      });
      setItems(response.data);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar pre-cadastros",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadReferences() {
    setReferencesLoading(true);
    setReferencesError("");
    try {
      const [yearsResponse, institutionsResponse] = await Promise.all([
        api.listAcademicYears({ status: "all" }),
        api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
      ]);
      setYears(yearsResponse.data);
      setInstitutions(institutionsResponse.data);
    } catch (caught) {
      setReferencesError(
        caught instanceof Error ? caught.message : "Erro ao carregar filtros",
      );
    } finally {
      setReferencesLoading(false);
    }
  }

  function updateAcademicYearFilter(value: string) {
    setAcademicYearId(value);
    setPage(1);
    setSelected(null);
  }

  function updateInstitutionFilter(value: string) {
    setInstitutionId(value);
    setPage(1);
    setSelected(null);
  }

  function updateStatusFilter(value: PreRegistrationStatusFilter) {
    setStatus(value);
    setPage(1);
    setSelected(null);
  }

  function removeFilter(key: "academicYear" | "institution" | "status") {
    if (key === "academicYear") {
      updateAcademicYearFilter("");
    }
    if (key === "institution") {
      updateInstitutionFilter("");
    }
    if (key === "status") {
      updateStatusFilter("all");
    }
  }

  function clearFilters() {
    setSearch("");
    setAcademicYearId("");
    setInstitutionId("");
    setStatus("all");
    setPage(1);
    setSelected(null);
    setDashboardSourceApplied(false);
  }

  async function openItem(id: string) {
    setError("");
    setMessage("");
    try {
      const detail = await api.getPreRegistration(id);
      setSelected(detail);
      setRejectionReason("");
      setApprovalBusId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir");
    }
  }

  async function loadApprovalBuses(academicYearId: string) {
    setApprovalBusId("");
    setApprovalBusesLoading(true);
    setApprovalBusesError("");
    try {
      const response = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId,
      });
      setApprovalBuses(response.data.filter((bus) => !bus.isFull));
    } catch (caught) {
      setApprovalBuses([]);
      setApprovalBusesError(
        caught instanceof Error ? caught.message : "Erro ao carregar onibus",
      );
    } finally {
      setApprovalBusesLoading(false);
    }
  }

  async function refreshSelected(id = selected?.id) {
    if (!id) {
      return;
    }
    const detail = await api.getPreRegistration(id);
    setSelected(detail);
  }

  async function approveSelected() {
    if (!selected) {
      return;
    }
    const confirmed = window.confirm(
      "Aprovar este pre-cadastro?\n\nO sistema criara pessoa, academico e matricula. Se um onibus foi selecionado, o vinculo sera criado na mesma operacao.",
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const detail = await api.approvePreRegistration(selected.id, {
        busId: emptyToUndefined(approvalBusId),
      });
      setSelected(detail);
      setApprovalBusId("");
      setMessage("Pre-cadastro aprovado");
      await loadItems();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao aprovar");
    } finally {
      setSaving(false);
    }
  }

  async function rejectSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    const confirmed = window.confirm(
      "Rejeitar este pre-cadastro?\n\nA solicitacao ficara registrada como rejeitada e nao criara academico ou matricula.",
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const detail = await api.rejectPreRegistration(
        selected.id,
        rejectionReason,
      );
      setSelected(detail);
      setRejectionReason("");
      setMessage("Pre-cadastro rejeitado");
      await loadItems();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao rejeitar");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewDocument(item: PreRegistrationDocumentRecord) {
    if (!selected) {
      return;
    }
    setError("");
    try {
      const { blob, fileName } = await api.downloadPreRegistrationDocument(
        selected.id,
        item.id,
        "inline",
      );
      const objectUrl = URL.createObjectURL(blob);
      if (blob.type === "application/pdf") {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
        await refreshSelected();
        return;
      }
      setDocumentPreview({ document: item, fileName, url: objectUrl });
      await refreshSelected();
    } catch (caught) {
      setError(documentErrorMessage(caught, "preview"));
    }
  }

  async function handleDownloadDocument(item: PreRegistrationDocumentRecord) {
    if (!selected) {
      return;
    }
    setError("");
    try {
      const { blob, fileName } = await api.downloadPreRegistrationDocument(
        selected.id,
        item.id,
        "attachment",
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      await refreshSelected();
    } catch (caught) {
      setError(documentErrorMessage(caught, "download"));
    }
  }

  function closeDocumentPreview() {
    setDocumentPreview(null);
  }

  async function copyPublicPreRegistrationLink() {
    setCopyMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pre-cadastro`);
      setCopyMessage("Link copiado");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao copiar link");
    }
  }

  return (
    <div className="grid gap-5">
      <AdminModuleHeader
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {copyMessage ? (
              <span
                aria-live="polite"
                className="text-sm font-medium text-emerald-700"
              >
                {copyMessage}
              </span>
            ) : null}
            <button
              className={adminTheme.secondaryButton}
              onClick={copyPublicPreRegistrationLink}
              type="button"
            >
              <Clipboard className="h-4 w-4" aria-hidden />
              Copiar link de pré-cadastro
            </button>
          </div>
        }
        description="Acompanhe solicitações recebidas, valide dados acadêmicos e revise documentos privados enviados pelo acadêmico."
        eyebrow="Pré-cadastro"
        icon={Clipboard}
        title="Análise de pré-cadastros"
      />
      <section
        aria-labelledby="pre-registration-filters-title"
        className={cx(adminTheme.card, "min-w-0 p-5")}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2
              className={cx(adminTheme.titleText, "text-base")}
              id="pre-registration-filters-title"
            >
              Filtros
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Refine os pre-cadastros por busca, ano letivo, instituicao e status.
            </p>
          </div>
          {referencesLoading ? (
            <span className="text-sm text-slate-500">Carregando filtros...</span>
          ) : null}
        </div>
        {referencesError ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {referencesError}
          </div>
        ) : null}
        <form
          className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSelected(null);
            void loadItems(search);
          }}
        >
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Busca
            <input
              className={adminTheme.control}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, CPF ou protocolo"
              type="search"
              value={search}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Ano letivo
            <select
              className={adminTheme.control}
              disabled={referencesLoading}
              onChange={(event) => updateAcademicYearFilter(event.target.value)}
              value={academicYearId}
            >
              <option value="">Todos</option>
              {academicYearId && !years.some((year) => year.id === academicYearId) ? (
                <option value={academicYearId}>
                  Ano selecionado nao encontrado
                </option>
              ) : null}
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Instituicao
            <select
              className={adminTheme.control}
              disabled={referencesLoading}
              onChange={(event) => updateInstitutionFilter(event.target.value)}
              value={institutionId}
            >
              <option value="">Todas</option>
              {institutionId &&
              !institutions.some((institution) => institution.id === institutionId) ? (
                <option value={institutionId}>
                  Instituicao selecionada nao encontrada
                </option>
              ) : null}
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              className={adminTheme.control}
              onChange={(event) =>
                updateStatusFilter(event.target.value as PreRegistrationStatusFilter)
              }
              value={status}
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
            <button
              className={adminTheme.primaryButton}
              disabled={loading}
              type="submit"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Buscar
            </button>
            <button
              className={adminTheme.secondaryButton}
              disabled={!hasActiveFilters || loading}
              onClick={clearFilters}
              type="button"
            >
              <XCircle aria-hidden="true" className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>
        </form>

        <PreRegistrationActiveFilterChips
          chips={activeFilterChips}
          hasDashboardOrigin={hasDashboardOrigin}
          onClear={clearFilters}
          onRemove={removeFilter}
        />
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Protocolo</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Instituicao</th>
                  <th className="px-4 py-3">Ano</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Envio</th>
                  <th className="px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Nenhum pre-cadastro encontrado
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {item.publicCode}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.cpfMasked}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.institution.name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.academicYear.year}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                          onClick={() => void openItem(item.id)}
                          type="button"
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 text-sm text-slate-600">
            <button
              className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              type="button"
            >
              Anterior
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              type="button"
            >
              Proxima
            </button>
          </div>
        </div>

        <aside className="min-w-0">
          {selected ? (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-[#F8FAFA]/85 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {selected.publicCode}
                  </p>
                  <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">
                    {selected.fullName}
                  </h2>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <InfoGroup
                icon={UserRound}
                rows={[
                  ["CPF", maskCpf(selected.cpf)],
                  ["RG", selected.rg ?? "-"],
                  ["Nascimento", formatDate(selected.birthDate)],
                  ["Telefone", selected.phone ? maskPhone(selected.phone) : "-"],
                  ["E-mail", selected.email ?? "-"],
                  ["Logradouro", selected.addressStreet],
                  ["Numero", selected.addressNumber],
                  ["Bairro", selected.addressNeighborhood],
                  ["Cidade", selected.addressCity],
                ]}
                title="Dados do acadêmico"
              />
              <InfoGroup
                icon={GraduationCap}
                rows={[
                  ["Instituição", selected.institution.name],
                  ["Curso", selected.course],
                  ["Série", selected.grade],
                  ["Turno", selected.shift.name],
                  ["Ano letivo", String(selected.academicYear.year)],
                ]}
                title="Dados acadêmicos"
              />
              <InfoGroup
                icon={UsersRound}
                rows={[
                  ["Responsável", selected.guardian?.fullName ?? "-"],
                  ["CPF", selected.guardian?.cpf ? maskCpf(selected.guardian.cpf) : "-"],
                  ["RG", selected.guardian?.rg ?? "-"],
                ]}
                title="Responsável"
              />
              <DocumentSection
                documents={selected.documents}
                onDownload={(document) => void handleDownloadDocument(document)}
                onPreview={(document) => void handlePreviewDocument(document)}
              />
              <InfoGroup
                icon={ShieldCheck}
                rows={[
                  ["Situação", statusLabel(selected.status)],
                  ["Recebido em", formatDateTime(selected.createdAt)],
                  ["Analisado em", selected.reviewedAt ? formatDateTime(selected.reviewedAt) : "-"],
                  ["Analista", selected.reviewedBy?.name ?? "-"],
                  ["Motivo", selected.rejectionReason ?? "-"],
                  ["Acadêmico", selected.approvedStudent?.fullName ?? "-"],
                ]}
                title="Análise / situação"
              />

              {selected.status === "PENDING" ? (
                <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-white p-4">
                  <SectionTitle icon={ShieldCheck} title="Ações administrativas" />
                  <label className="block text-sm font-medium text-slate-700">
                    Ônibus opcional
                    <select
                      className={cx(adminTheme.control, "mt-1 w-full")}
                      disabled={approvalBusesLoading}
                      onChange={(event) => setApprovalBusId(event.target.value)}
                      value={approvalBusId}
                    >
                      <option value="">
                        {approvalBusesLoading
                          ? "Carregando onibus..."
                          : "Aprovar sem onibus"}
                      </option>
                      {approvalBuses.map((bus) => (
                        <option key={bus.id} value={bus.id}>
                          {bus.name} - {bus.availableSeats ?? bus.capacity}/
                          {bus.capacity} vagas
                        </option>
                      ))}
                    </select>
                    {!approvalBusesLoading &&
                    approvalBuses.length === 0 &&
                    !approvalBusesError ? (
                      <span className="mt-1 block text-xs text-slate-500">
                        Nenhum onibus com vaga disponivel
                      </span>
                    ) : null}
                    {approvalBusesError ? (
                      <span className="mt-1 block text-xs text-red-700">
                        {approvalBusesError}
                      </span>
                    ) : null}
                  </label>
                  <button
                    className={adminTheme.primaryButton}
                    disabled={saving}
                    onClick={() => void approveSelected()}
                    type="button"
                  >
                    Aprovar
                  </button>
                  <form className="grid gap-2" onSubmit={rejectSelected}>
                    <label className="block text-sm font-medium text-slate-700">
                      Motivo da rejeição
                      <textarea
                        className={cx(adminTheme.control, "mt-1 min-h-24 w-full py-2")}
                        maxLength={500}
                        minLength={3}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        required
                        value={rejectionReason}
                      />
                    </label>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      disabled={saving}
                      type="submit"
                    >
                      Rejeitar
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <SectionTitle icon={ShieldCheck} title="Ações administrativas" />
                  <p className="mt-2 text-sm text-slate-500">
                    Não há ações pendentes para esta solicitação.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <AdminEmptyState
              description="Abra uma solicitação da lista para conferir dados, documentos e ações de análise."
              title="Selecione um pré-cadastro"
            />
          )}
        </aside>
      </div>
      {documentPreview ? (
        <DocumentPreviewModal
          fileName={documentPreview.fileName}
          onClose={closeDocumentPreview}
          preview={documentPreview.document}
          url={documentPreview.url}
        />
      ) : null}
    </div>
  );
}

function InfoGroup({
  icon,
  rows,
  title,
}: {
  icon: LucideIcon;
  rows: Array<[string, string]>;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4">
      <SectionTitle icon={icon} title={title} />
      <dl className="mt-2 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div className="grid min-w-0 gap-1 sm:grid-cols-[124px_minmax(0,1fr)] sm:gap-2" key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="break-words text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StatusBadge({ status }: { status: PreRegistrationStatus }) {
  const tone =
    status === "PENDING"
      ? "orange"
      : status === "APPROVED"
        ? "green"
        : "red";
  const label =
    status === "PENDING"
      ? "Pendente"
      : status === "APPROVED"
        ? "Aprovado"
        : "Rejeitado";
  return <AdminStatusBadge tone={tone}>{label}</AdminStatusBadge>;
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#EEF7F4] text-[#14534D]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="truncate">{title}</span>
    </h3>
  );
}

function DocumentSection({
  documents,
  onDownload,
  onPreview,
}: {
  documents: PreRegistrationDocumentRecord[];
  onDownload: (document: PreRegistrationDocumentRecord) => void;
  onPreview: (document: PreRegistrationDocumentRecord) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4">
      <SectionTitle icon={FileText} title="Documentos enviados" />
      <div className="mt-3 grid gap-2">
        {expectedDocumentTypes.map((documentType) => {
          const document = documents.find((item) => item.documentType === documentType);
          return (
            <DocumentRow
              document={document}
              documentType={documentType}
              key={documentType}
              onDownload={onDownload}
              onPreview={onPreview}
            />
          );
        })}
      </div>
    </section>
  );
}

function DocumentRow({
  document,
  documentType,
  onDownload,
  onPreview,
}: {
  document?: PreRegistrationDocumentRecord;
  documentType: StudentDocumentType;
  onDownload: (document: PreRegistrationDocumentRecord) => void;
  onPreview: (document: PreRegistrationDocumentRecord) => void;
}) {
  const unavailable = document?.status === "REMOVED";
  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-[#F8FAFA]/80 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-950">
            {documentLabels[documentType] ?? documentType}
          </p>
          <DocumentStatusBadge document={document} />
        </div>
        {document ? (
          <p className="mt-1 break-words text-xs text-slate-500">
            Arquivo: {document.originalFileName ?? `${documentLabels[document.documentType] ?? "documento"}.${document.extension}`} ·{" "}
            {document.extension.toUpperCase()} · {formatBytes(document.sizeBytes)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Nenhum arquivo recebido para este tipo.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          className={cx(adminTheme.secondaryButton, "h-9 px-2.5 text-xs")}
          disabled={!document || unavailable}
          onClick={() => document && onPreview(document)}
          type="button"
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          Visualizar
        </button>
        <button
          className={cx(adminTheme.secondaryButton, "h-9 px-2.5 text-xs")}
          disabled={!document || unavailable}
          onClick={() => document && onDownload(document)}
          type="button"
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          Baixar
        </button>
      </div>
    </div>
  );
}

function DocumentStatusBadge({
  document,
}: {
  document?: PreRegistrationDocumentRecord;
}) {
  if (!document) {
    return <AdminStatusBadge tone="slate">Não enviado</AdminStatusBadge>;
  }
  if (document.status === "REMOVED") {
    return <AdminStatusBadge tone="red">Indisponível</AdminStatusBadge>;
  }
  if (document.status === "PROMOTED") {
    return <AdminStatusBadge tone="green">Enviado</AdminStatusBadge>;
  }
  return <AdminStatusBadge tone="blue">Enviado</AdminStatusBadge>;
}

function DocumentPreviewModal({
  fileName,
  onClose,
  preview,
  url,
}: {
  fileName: string;
  onClose: () => void;
  preview: PreRegistrationDocumentRecord;
  url: string;
}) {
  const isPdf = preview.mimeType === "application/pdf";
  const isImage = preview.mimeType === "image/jpeg" || preview.mimeType === "image/png";
  return (
    <div
      aria-labelledby="pre-registration-document-preview-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid bg-slate-950/55 p-3 sm:p-6"
      role="dialog"
    >
      <div className="mx-auto grid min-h-0 w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Visualização segura
            </p>
            <h2
              className="mt-1 break-words text-base font-semibold text-slate-950"
              id="pre-registration-document-preview-title"
            >
              {documentLabels[preview.documentType] ?? preview.documentType}
            </h2>
            <p className="mt-1 break-words text-xs text-slate-500">
              {fileName} · {preview.mimeType} · {formatBytes(preview.sizeBytes)}
            </p>
          </div>
          <button
            aria-label="Fechar visualização"
            className={adminTheme.iconButton}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-auto bg-slate-100 p-3">
          {isPdf ? (
            <iframe
              className="h-[72vh] w-full rounded-lg border border-slate-200 bg-white"
              src={url}
              title={`Visualização de ${fileName}`}
            />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Visualização de ${fileName}`}
              className="mx-auto max-h-[72vh] max-w-full rounded-lg bg-white object-contain shadow-sm"
              src={url}
            />
          ) : (
            <div className="mx-auto grid max-w-md place-items-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
              <AlertTriangle aria-hidden="true" className="h-8 w-8" />
              <p className="mt-3 text-sm font-semibold">
                Não foi possível pré-visualizar este arquivo.
              </p>
              <p className="mt-1 text-sm">
                Use o botão Baixar para abrir no aplicativo adequado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreRegistrationActiveFilterChips({
  chips,
  hasDashboardOrigin,
  onClear,
  onRemove,
}: {
  chips: PreRegistrationFilterChip[];
  hasDashboardOrigin: boolean;
  onClear: () => void;
  onRemove: (key: "academicYear" | "institution" | "status") => void;
}) {
  if (chips.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        Nenhum filtro aplicado.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-500">
          Filtros ativos
        </span>
        {hasDashboardOrigin ? (
          <span className="rounded-full bg-[#F2F8F6] px-2 py-1 text-xs font-medium text-[#0F2E2E]">
            Recebidos do Dashboard
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <span
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
            key={chip.key}
          >
            <span className="truncate">{chip.label}</span>
            <button
              aria-label={`Remover filtro ${chip.label}`}
              className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/25"
              onClick={() => onRemove(chip.key)}
              type="button"
            >
              <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <button
          className={cx(adminTheme.secondaryButton, "h-8 px-2 text-xs")}
          onClick={onClear}
          type="button"
        >
          <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
          Limpar filtros
        </button>
      </div>
    </div>
  );
}

function yearLabel(years: AcademicYear[], id: string) {
  return years.find((year) => year.id === id)?.year ?? "nao encontrado";
}

function institutionLabel(institutions: BaseRecord[], id: string) {
  return (
    institutions.find((institution) => institution.id === id)?.name ??
    "nao encontrada"
  );
}

function statusLabel(status: PreRegistrationStatus) {
  if (status === "PENDING") return "Pendente";
  if (status === "APPROVED") return "Aprovado";
  return "Rejeitado";
}

function isPreRegistrationFilterChip(
  chip: PreRegistrationFilterChip | null,
): chip is PreRegistrationFilterChip {
  return chip !== null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

function documentErrorMessage(caught: unknown, action: "download" | "preview") {
  const message = caught instanceof Error ? caught.message : "";
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("nao encontrado") || normalized.includes("not found")) {
    return "Documento não encontrado.";
  }
  if (normalized.includes("acesso") || normalized.includes("forbidden") || normalized.includes("unauthorized")) {
    return "Não foi possível abrir o documento.";
  }
  return action === "download"
    ? "Não foi possível baixar o documento."
    : "Não foi possível abrir o documento.";
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
