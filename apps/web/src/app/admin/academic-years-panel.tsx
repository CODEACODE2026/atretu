"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type AcademicYear, type ApiUser } from "../../lib/api";
import { canAccessRestrictedAdmin } from "../../lib/auth";

type YearStatusFilter = "active" | "archived" | "all";

export function AcademicYearsPanel({ user }: { user: ApiUser }) {
  const canWrite = canAccessRestrictedAdmin(user);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isCurrent, setIsCurrent] = useState(false);
  const [status, setStatus] = useState<YearStatusFilter>("active");
  const [editingId, setEditingId] = useState("");
  const [editingYear, setEditingYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadYears();
  }, [status]);

  async function loadYears() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listAcademicYears({ status });
      setYears(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.createAcademicYear({ year: Number(year), isCurrent });
      setMessage("Ano Letivo salvo");
      setIsCurrent(false);
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: AcademicYear) {
    setEditingId(item.id);
    setEditingYear(String(item.year));
    setMessage("");
    setError("");
  }

  async function saveEdit(item: AcademicYear) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.updateAcademicYear(item.id, { year: Number(editingYear) });
      setMessage("Ano Letivo atualizado");
      setEditingId("");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function setCurrent(item: AcademicYear) {
    const confirmed = window.confirm(
      `Definir ${item.year} como Ano Letivo atual? Os demais deixam de ser atuais.`,
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.setCurrentAcademicYear(item.id);
      setMessage("Ano Letivo atual atualizado");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function archive(item: AcademicYear) {
    const confirmed = window.confirm(
      `Arquivar ${item.year}? Ele continuara nos historicos, mas nao aparecera em novos fluxos.`,
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.archiveAcademicYear(item.id);
      setMessage("Ano Letivo arquivado");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao arquivar");
    } finally {
      setSaving(false);
    }
  }

  async function reactivate(item: AcademicYear) {
    const confirmed = window.confirm(
      `Reativar ${item.year}? Ele voltara a aparecer em novos fluxos, mas nao sera marcado como atual automaticamente.`,
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.reactivateAcademicYear(item.id);
      setMessage("Ano Letivo reativado");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao reativar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: AcademicYear) {
    const confirmed = window.confirm(
      `Excluir definitivamente ${item.year}? Esta acao so e permitida para Ano Letivo vazio e nao atual.`,
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.deleteAcademicYear(item.id);
      setMessage("Ano Letivo excluido");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <form
        className="rounded border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <h2 className="text-base font-semibold text-slate-950">Ano Letivo</h2>
        {!canWrite ? (
          <p className="mt-2 text-sm text-slate-600">
            Secretaria pode consultar e selecionar Anos Letivos.
          </p>
        ) : null}
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Ano
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            disabled={!canWrite}
            max={2100}
            min={2000}
            onChange={(event) => setYear(event.target.value)}
            required
            type="number"
            value={year}
          />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            checked={isCurrent}
            disabled={!canWrite}
            onChange={(event) => setIsCurrent(event.target.checked)}
            type="checkbox"
          />
          Definir como atual
        </label>
        <button
          className="mt-5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={!canWrite || saving}
          type="submit"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-slate-950">
            Anos cadastrados
          </h2>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setStatus(event.target.value as YearStatusFilter)}
            value={status}
          >
            <option value="active">Ativos</option>
            <option value="archived">Arquivados</option>
            <option value="all">Todos</option>
          </select>
        </div>
        {message ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Atual</th>
                <th className="px-4 py-3">Arquivado em</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : years.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Nenhum Ano Letivo encontrado
                  </td>
                </tr>
              ) : (
                years.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {editingId === item.id ? (
                        <input
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                          max={2100}
                          min={2000}
                          onChange={(event) => setEditingYear(event.target.value)}
                          type="number"
                          value={editingYear}
                        />
                      ) : (
                        item.year
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.status === "ACTIVE"
                            ? "rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                            : "rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                        }
                      >
                        {item.status === "ACTIVE" ? "Ativo" : "Arquivado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.isCurrent
                            ? "rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800"
                            : "rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                        }
                      >
                        {item.isCurrent ? "Atual" : "Nao"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.archivedAt
                        ? new Date(item.archivedAt).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {editingId === item.id ? (
                          <>
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                              disabled={!canWrite || saving}
                              onClick={() => void saveEdit(item)}
                              type="button"
                            >
                              Salvar
                            </button>
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                              onClick={() => setEditingId("")}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                            disabled={!canWrite || saving || !item.canEditYear}
                            onClick={() => beginEdit(item)}
                            type="button"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                          disabled={!canWrite || saving || !item.canSetCurrent}
                          onClick={() => void setCurrent(item)}
                          type="button"
                        >
                          Definir atual
                        </button>
                        {item.status === "ACTIVE" ? (
                          <button
                            className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 disabled:opacity-50"
                            disabled={!canWrite || saving || !item.canArchive}
                            onClick={() => void archive(item)}
                            type="button"
                          >
                            Arquivar
                          </button>
                        ) : (
                          <button
                            className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 disabled:opacity-50"
                            disabled={!canWrite || saving || !item.canReactivate}
                            onClick={() => void reactivate(item)}
                            type="button"
                          >
                            Reativar
                          </button>
                        )}
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-50"
                          disabled={!canWrite || saving || !item.canDelete}
                          onClick={() => void remove(item)}
                          type="button"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
