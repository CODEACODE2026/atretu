"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  api,
  type PreRegistrationDetail,
  type PreRegistrationDocumentRecord,
  type PreRegistrationStatus,
  type PreRegistrationSummary,
} from "../../lib/api";

const statuses: Array<{ label: string; value: PreRegistrationStatus }> = [
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

export function PreRegistrationsPanel() {
  const [items, setItems] = useState<PreRegistrationSummary[]>([]);
  const [selected, setSelected] = useState<PreRegistrationDetail | null>(null);
  const [status, setStatus] = useState<PreRegistrationStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadItems();
  }, [status, page]);

  async function loadItems(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const response = await api.listPreRegistrations({
        page,
        limit: 10,
        search: nextSearch,
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

  async function openItem(id: string) {
    setError("");
    setMessage("");
    try {
      const detail = await api.getPreRegistration(id);
      setSelected(detail);
      setRejectionReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir");
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
      "Aprovar este pre-cadastro e criar academico, pessoa e matricula?",
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const detail = await api.approvePreRegistration(selected.id);
      setSelected(detail);
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
    const confirmed = window.confirm("Rejeitar este pre-cadastro?");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void loadItems(search);
          }}
        >
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, CPF ou protocolo"
            type="search"
            value={search}
          />
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            type="submit"
          >
            Buscar
          </button>
        </form>

        <select
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          onChange={(event) => {
            setStatus(event.target.value as PreRegistrationStatus);
            setPage(1);
            setSelected(null);
          }}
          value={status}
        >
          {statuses.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

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

      <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
        <div className="rounded border border-slate-200 bg-white shadow-sm">
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

        <aside className="rounded border border-slate-200 bg-white p-4 shadow-sm">
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
                  ["CPF", selected.cpf],
                  ["RG", selected.rg ?? "-"],
                  ["Nascimento", formatDate(selected.birthDate)],
                  ["Telefone", selected.phone ?? "-"],
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
                  ["CPF", selected.guardian?.cpf ?? "-"],
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
