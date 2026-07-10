"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type AcademicYear, type ApiUser } from "../../lib/api";
import { canAccessRestrictedAdmin } from "../../lib/auth";

export function AcademicYearsPanel({ user }: { user: ApiUser }) {
  const canWrite = canAccessRestrictedAdmin(user);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isCurrent, setIsCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadYears();
  }, []);

  async function loadYears() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listAcademicYears();
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

  async function setCurrent(id: string) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.setCurrentAcademicYear(id);
      setMessage("Ano Letivo atual atualizado");
      await loadYears();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
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
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Anos cadastrados
          </h2>
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
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Atual</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={3}>
                    Carregando...
                  </td>
                </tr>
              ) : years.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={3}>
                    Nenhum Ano Letivo cadastrado
                  </td>
                </tr>
              ) : (
                years.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {item.year}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.isCurrent
                            ? "rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                            : "rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                        }
                      >
                        {item.isCurrent ? "Atual" : "Nao"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                        disabled={!canWrite || item.isCurrent || saving}
                        onClick={() => void setCurrent(item.id)}
                        type="button"
                      >
                        Definir atual
                      </button>
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
