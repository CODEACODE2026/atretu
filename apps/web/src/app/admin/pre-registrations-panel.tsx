"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, XCircle } from "lucide-react";
import {
  api,
  type AcademicYear,
  type BaseRecord,
  type BusRecord,
  type PreRegistrationDetail,
  type PreRegistrationDocumentRecord,
  type PreRegistrationStatus,
  type PreRegistrationSummary,
} from "../../lib/api";
import { maskCpf, maskPhone } from "../../lib/formatters";
import { adminTheme, cx } from "./admin-theme";

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
  const [error, setError] = useState("");
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

  async function handleDownload(
    item: PreRegistrationDocumentRecord,
    disposition: "attachment" | "inline",
  ) {
    if (!selected) {
      return;
    }
    setError("");
    try {
      const { blob, fileName } = await api.downloadPreRegistrationDocument(
        selected.id,
        item.id,
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
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir documento");
    }
  }

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="pre-registration-filters-title"
        className={cx(adminTheme.card, "min-w-0 p-5")}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
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
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 rounded border border-slate-200 bg-white shadow-sm">
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

        <aside className="min-w-0 rounded border border-slate-200 bg-white p-4 shadow-sm">
          {selected ? (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    {selected.publicCode}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">
                    {selected.fullName}
                  </h2>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <InfoGroup
                rows={[
                  ["CPF", maskCpf(selected.cpf)],
                  ["RG", selected.rg ?? "-"],
                  ["Nascimento", formatDate(selected.birthDate)],
                  ["Telefone", selected.phone ? maskPhone(selected.phone) : "-"],
                  ["E-mail", selected.email ?? "-"],
                ]}
                title="Identificacao"
              />
              <InfoGroup
                rows={[
                  ["Logradouro", selected.addressStreet],
                  ["Numero", selected.addressNumber],
                  ["Bairro", selected.addressNeighborhood],
                  ["Cidade", selected.addressCity],
                ]}
                title="Endereco"
              />
              <InfoGroup
                rows={[
                  ["Responsavel", selected.guardian?.fullName ?? "-"],
                  ["CPF", selected.guardian?.cpf ? maskCpf(selected.guardian.cpf) : "-"],
                  ["RG", selected.guardian?.rg ?? "-"],
                ]}
                title="Responsavel"
              />
              <InfoGroup
                rows={[
                  ["Ano Letivo", String(selected.academicYear.year)],
                  ["Instituicao", selected.institution.name],
                  ["Curso", selected.course],
                  ["Serie", selected.grade],
                  ["Turno", selected.shift.name],
                ]}
                title="Dados academicos"
              />

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-950">
                  Documentos
                </h3>
                <div className="mt-2 grid gap-2">
                  {selected.documents.length === 0 ? (
                    <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
                      Nenhum documento enviado
                    </p>
                  ) : (
                    selected.documents.map((document) => (
                      <div
                        className="rounded border border-slate-200 p-3"
                        key={document.id}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {documentLabels[document.documentType] ??
                                document.documentType}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {document.extension.toUpperCase()} -{" "}
                              {formatBytes(document.sizeBytes)} -{" "}
                              {document.status}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                            onClick={() => void handleDownload(document, "inline")}
                            type="button"
                          >
                            Visualizar
                          </button>
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                            onClick={() =>
                              void handleDownload(document, "attachment")
                            }
                            type="button"
                          >
                            Baixar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selected.status === "PENDING" ? (
                <div className="grid gap-3 border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Onibus opcional
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
                    className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => void approveSelected()}
                    type="button"
                  >
                    Aprovar
                  </button>
                  <form className="grid gap-2" onSubmit={rejectSelected}>
                    <label className="block text-sm font-medium text-slate-700">
                      Motivo da rejeicao
                      <textarea
                        className="mt-1 min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        maxLength={500}
                        minLength={3}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        required
                        value={rejectionReason}
                      />
                    </label>
                    <button
                      className="rounded border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                      disabled={saving}
                      type="submit"
                    >
                      Rejeitar
                    </button>
                  </form>
                </div>
              ) : (
                <InfoGroup
                  rows={[
                    ["Analisado em", selected.reviewedAt ? formatDateTime(selected.reviewedAt) : "-"],
                    ["Analista", selected.reviewedBy?.name ?? "-"],
                    ["Motivo", selected.rejectionReason ?? "-"],
                    ["Academico", selected.approvedStudent?.fullName ?? "-"],
                  ]}
                  title="Analise"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Selecione um pre-cadastro para revisar.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoGroup({
  rows,
  title,
}: {
  rows: Array<[string, string]>;
  title: string;
}) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <dl className="mt-2 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div className="grid grid-cols-[120px_1fr] gap-2" key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="break-words text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StatusBadge({ status }: { status: PreRegistrationStatus }) {
  const className =
    status === "PENDING"
      ? "bg-amber-50 text-amber-700"
      : status === "APPROVED"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-700";
  const label =
    status === "PENDING"
      ? "Pendente"
      : status === "APPROVED"
        ? "Aprovado"
        : "Rejeitado";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
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

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
