"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type JobStatus, type JobsStatusResponse } from "../../lib/api";

const POLL_INTERVAL_MS = 5_000;

export function JobsMonitorPanel() {
  const [status, setStatus] = useState<JobsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let interval: number | null = null;

    async function load() {
      try {
        const response = await api.getJobsStatus();
        if (active) {
          setStatus(response);
          setError("");
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Erro ao carregar jobs");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    interval = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, []);

  const jobs = useMemo(() => status?.jobs ?? [], [status]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Monitor de Jobs</h2>
          <p className="text-sm text-slate-600">
            Processo {status?.pid ?? "-"} · uptime {formatUptime(status?.uptimeSeconds)}
          </p>
        </div>
        <button
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            api
              .getJobsStatus()
              .then((response) => {
                setStatus(response);
                setError("");
              })
              .catch((caught) => {
                setError(caught instanceof Error ? caught.message : "Erro ao carregar jobs");
              })
              .finally(() => setLoading(false));
          }}
          type="button"
        >
          Atualizar
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ultima execucao</th>
              <th className="px-4 py-3">Proxima estimada</th>
              <th className="px-4 py-3">Execucoes</th>
              <th className="px-4 py-3">Intervalo</th>
              <th className="px-4 py-3">Running</th>
              <th className="px-4 py-3">Ultimo erro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <JobRow job={job} key={job.name} />
            ))}
            {!loading && jobs.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-center text-slate-500" colSpan={8}>
                  Nenhum job registrado neste processo.
                </td>
              </tr>
            ) : null}
            {loading && jobs.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-center text-slate-500" colSpan={8}>
                  Carregando...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function JobRow({ job }: { job: JobStatus }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3 font-medium text-slate-950">{job.name}</td>
      <td className="px-4 py-3">
        <span className={statusClass(job)}>
          {job.enabled ? (job.registered ? "Registrado" : "Nao registrado") : "Desabilitado"}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">
        {formatDateTime(job.lastRunFinishedAt ?? job.lastRunStartedAt)}
      </td>
      <td className="px-4 py-3 text-slate-700">
        {formatDateTime(job.nextRunEstimatedAt)}
      </td>
      <td className="px-4 py-3 text-slate-700">{job.tickCount}</td>
      <td className="px-4 py-3 text-slate-700">{formatInterval(job.intervalMs)}</td>
      <td className="px-4 py-3">
        <span className={job.running ? "font-semibold text-amber-700" : "text-slate-600"}>
          {job.running ? "Sim" : "Nao"}
        </span>
      </td>
      <td className="max-w-xs px-4 py-3 text-slate-700">
        {job.lastError ? (
          <div>
            <p className="font-medium text-red-700">{job.lastError.type}</p>
            <p className="break-words text-xs text-red-700">{job.lastError.message}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(job.lastError.at)}</p>
          </div>
        ) : (
          <span className="text-slate-500">Sem erro</span>
        )}
      </td>
    </tr>
  );
}

function statusClass(job: JobStatus) {
  if (!job.enabled) {
    return "rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600";
  }
  if (!job.registered) {
    return "rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700";
  }
  return "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700";
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatInterval(value: number) {
  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }
  return `${Math.round(value / 60_000)}min`;
}

function formatUptime(value?: number) {
  if (value === undefined) {
    return "-";
  }
  if (value < 60) {
    return `${value}s`;
  }
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}min ${seconds}s`;
}
