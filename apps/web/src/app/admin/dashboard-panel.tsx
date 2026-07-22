"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  type AdminDashboardResponse,
  type DashboardChart,
  type DashboardChartPoint,
  type DashboardListItem,
  type DashboardMetric,
  type DashboardOverviewParams,
  type DashboardQuickShortcut,
} from "../../lib/api";
import { translateStatus } from "../../lib/formatters";
import { formatDate, formatDateTime } from "../../lib/formatters/date";

type LoadState = "loading" | "loaded" | "error";

const dashboardRequests = new Map<string, Promise<AdminDashboardResponse>>();
const dashboardResponses = new Map<
  string,
  { data: AdminDashboardResponse; storedAt: number }
>();
const DASHBOARD_RESPONSE_DEDUPE_MS = 10000;

function dashboardParamsKey(params: DashboardOverviewParams) {
  return JSON.stringify({
    academicYearId: params.academicYearId ?? null,
    institutionId: params.institutionId ?? null,
  });
}

function requestDashboard(params: DashboardOverviewParams, force = false) {
  const key = dashboardParamsKey(params);
  const cached = dashboardResponses.get(key);
  if (
    !force &&
    cached &&
    Date.now() - cached.storedAt < DASHBOARD_RESPONSE_DEDUPE_MS
  ) {
    return Promise.resolve(cached.data);
  }

  const pending = dashboardRequests.get(key);
  if (!force && pending) {
    return pending;
  }

  const request = api
    .getAdminDashboard(params)
    .then((data) => {
      dashboardResponses.set(key, { data, storedAt: Date.now() });
      return data;
    })
    .finally(() => {
      dashboardRequests.delete(key);
    });
  dashboardRequests.set(key, request);
  return request;
}

export function DashboardPanel({
  isShortcutAvailable = () => true,
  onShortcut,
}: {
  isShortcutAvailable?: (shortcut: DashboardQuickShortcut) => boolean;
  onShortcut?: (shortcut: DashboardQuickShortcut) => void;
}) {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [params, setParams] = useState<DashboardOverviewParams>({});
  const [academicYearId, setAcademicYearId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  async function loadDashboard(nextParams = params, force = false) {
    setState("loading");
    setError("");
    try {
      setDashboard(await requestDashboard(nextParams, force));
      setState("loaded");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Nao foi possivel carregar o dashboard",
      );
      setState("error");
    }
  }

  useEffect(() => {
    void loadDashboard(params);
  }, [params]);

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams({
      academicYearId: academicYearId.trim() || undefined,
      institutionId: institutionId.trim() || undefined,
    });
  }

  function handleClearFilters() {
    setAcademicYearId("");
    setInstitutionId("");
    setParams({});
  }

  const empty = useMemo(
    () => (dashboard ? isDashboardEmpty(dashboard) : false),
    [dashboard],
  );

  if (state === "loading" && !dashboard) {
    return <DashboardSkeleton />;
  }

  if (state === "error" && !dashboard) {
    return (
      <DashboardError
        message={error}
        onRetry={() => {
          void loadDashboard(params, true);
        }}
      />
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Dashboard administrativo
            </p>
            <h2 className="text-xl font-semibold text-slate-950">
              Visao operacional
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ultima atualizacao: {formatDateTime(dashboard.generatedAt)}
            </p>
          </div>
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60"
            disabled={state === "loading"}
            onClick={() => void loadDashboard(params, true)}
            type="button"
          >
            Atualizar
          </button>
        </div>

        <form
          className="grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={handleApplyFilters}
        >
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-slate-500">
              Ano letivo
            </span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900"
              onChange={(event) => setAcademicYearId(event.target.value)}
              placeholder={dashboard.academicYear?.id ?? "Todos"}
              value={academicYearId}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-slate-500">
              Instituicao
            </span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900"
              onChange={(event) => setInstitutionId(event.target.value)}
              placeholder="Todas"
              value={institutionId}
            />
          </label>
          <button
            className="self-end rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60"
            disabled={state === "loading"}
            type="submit"
          >
            Filtrar
          </button>
          <button
            className="self-end rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60"
            disabled={state === "loading"}
            onClick={handleClearFilters}
            type="button"
          >
            Limpar
          </button>
        </form>

        {state === "error" ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      {empty ? <DashboardEmpty /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.values(dashboard.indicators).map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Widget
          title="Minha Agenda Hoje"
          subtitle="Retornos, revisoes e pendencias operacionais"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <ListBlock
              emptyText="Nenhum retorno de cobranca para hoje."
              items={dashboard.agendaToday.collectionFollowUps}
              title="Cobranca"
            />
            <ListBlock
              emptyText="Nenhum pre-cadastro pendente na fila."
              items={dashboard.agendaToday.preRegistrationsToReview}
              title="Pre-cadastros"
            />
            <ListBlock
              emptyText="Nenhuma carteirinha pendente na fila."
              items={dashboard.agendaToday.pendingCards}
              title="Carteirinhas"
            />
          </div>
        </Widget>

        <Widget title="Alertas Criticos" subtitle="Itens que pedem atencao">
          <ListBlock
            emptyText="Nenhum alerta critico no momento."
            items={dashboard.criticalAlerts}
            title="Alertas"
          />
        </Widget>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Widget title="Financeiro e Cobranca" subtitle="Inadimplencia e retornos">
          <MetricStrip metrics={dashboard.financeAndCollections.metrics} />
          <ListBlock
            emptyText="Nenhum caso critico de cobranca."
            items={dashboard.financeAndCollections.criticalCases}
            title="Casos criticos"
          />
        </Widget>

        <Widget
          title="Academicos e Documentacao"
          subtitle="Situacao cadastral e documentos esperados"
        >
          <MetricStrip metrics={dashboard.academicsAndDocuments.metrics} />
          <ListBlock
            emptyText="Nenhum cadastro com documentacao incompleta."
            items={dashboard.academicsAndDocuments.recentItems}
            title="Documentacao incompleta"
          />
        </Widget>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Widget title="Onibus e Vagas" subtitle="Capacidade operacional">
          <MetricStrip metrics={dashboard.busesAndSeats.metrics} />
          <ListBlock
            emptyText="Nenhum onibus proximo da lotacao."
            items={dashboard.busesAndSeats.attentionBuses}
            title="Atencao"
          />
        </Widget>

        <Widget title="Pre-cadastros" subtitle="Fila de analise">
          <MetricStrip metrics={dashboard.preRegistrations.metrics} />
          <ListBlock
            emptyText="Nenhum pre-cadastro pendente."
            items={dashboard.preRegistrations.pendingItems}
            title="Pendentes"
          />
        </Widget>

        <Widget title="Carteirinhas Pendentes" subtitle="Matriculas sem emissao ativa">
          <MetricStrip metrics={dashboard.pendingStudentCards.metrics} />
          <ListBlock
            emptyText="Nenhuma carteirinha pendente."
            items={dashboard.pendingStudentCards.items}
            title="Pendentes"
          />
        </Widget>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ChartPanel chart={dashboard.charts.overdueByAgingBucket} />
        <BusOccupancyChart chart={dashboard.charts.occupancyByBus} />
        <ChartPanel chart={dashboard.charts.studentsByInstitution} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <ChartPanel chart={dashboard.charts.preRegistrationsByMonth} />
        <Widget title="Atalhos Rapidos" subtitle="Acesso direto aos modulos">
          {dashboard.quickShortcuts.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {dashboard.quickShortcuts.map((shortcut) => {
                const available = isShortcutAvailable(shortcut);
                return (
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!available}
                  key={shortcut.key}
                  onClick={() => onShortcut?.(shortcut)}
                  type="button"
                >
                  {shortcut.label}
                </button>
                );
              })}
            </div>
          ) : (
            <InlineEmpty text="Nenhum atalho disponivel." />
          )}
        </Widget>
      </section>
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
        <span className={statusDotClass(metric.status)} aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">
        {metric.formattedValue}
      </p>
      <p className="mt-2 min-h-4 text-xs text-slate-500">
        {metric.context ?? ""}
      </p>
    </article>
  );
}

function Widget({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricStrip({ metrics }: { metrics: DashboardMetric[] }) {
  if (metrics.length === 0) {
    return <InlineEmpty text="Sem indicadores para exibir." />;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
          key={metric.key}
        >
          <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {metric.formattedValue}
          </p>
        </div>
      ))}
    </div>
  );
}

function ListBlock({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: DashboardListItem[];
  title: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <span className="text-xs text-slate-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <InlineEmpty text={emptyText} />
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li className="rounded border border-slate-200 px-3 py-2" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.description ?? "Sem descricao"}
                  </p>
                </div>
                <span className={badgeClass(item.status)}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                {item.date ? <span>{formatDate(item.date)}</span> : null}
                {typeof item.amountCents === "number" ? (
                  <span>{formatCents(item.amountCents)}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartPanel({ chart }: { chart: DashboardChart }) {
  const max = Math.max(...chart.data.map((item) => item.value), 0);
  return (
    <Widget title={chart.title} subtitle={chart.description}>
      {chart.data.length === 0 || max === 0 ? (
        <InlineEmpty text="Sem dados suficientes para este grafico." />
      ) : (
        <div className="grid gap-3">
          {chart.data.map((point) => (
            <BarRow
              key={`${chart.key}-${point.label}`}
              label={point.label}
              value={String(point.value)}
              widthPercent={(point.value / max) * 100}
            />
          ))}
        </div>
      )}
    </Widget>
  );
}

function BusOccupancyChart({ chart }: { chart: DashboardChart }) {
  return (
    <Widget title={chart.title} subtitle={chart.description}>
      {chart.data.length === 0 ? (
        <InlineEmpty text="Sem ocupacao de onibus para exibir." />
      ) : (
        <div className="grid gap-3">
          {chart.data.map((point) => (
            <BarRow
              key={point.busId ?? point.label}
              label={point.label}
              value={`${point.occupiedSeats ?? 0}/${point.capacity ?? 0}`}
              widthPercent={point.occupancyPercent ?? 0}
              status={point.status}
            />
          ))}
        </div>
      )}
    </Widget>
  );
}

function BarRow({
  label,
  status,
  value,
  widthPercent,
}: {
  label: string;
  status?: DashboardChartPoint["status"];
  value: string;
  widthPercent: number;
}) {
  const width = Math.max(4, Math.min(widthPercent, 100));
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-950">{value}</span>
      </div>
      <div
        aria-label={`${label}: ${value}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(widthPercent)}
        className="h-2 rounded bg-slate-100"
        role="progressbar"
      >
        <div
          className={`h-2 rounded ${barColorClass(status)}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="h-20 rounded border border-slate-200 bg-white p-4">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="mt-3 h-6 w-56 rounded bg-slate-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="rounded border border-slate-200 bg-white p-4" key={index}>
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-56 rounded border border-slate-200 bg-white p-4" key={index}>
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="mt-4 grid gap-3">
              <div className="h-8 rounded bg-slate-100" />
              <div className="h-8 rounded bg-slate-100" />
              <div className="h-8 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded border border-red-200 bg-red-50 p-4">
      <h2 className="text-base font-semibold text-red-900">
        Nao foi possivel carregar o dashboard.
      </h2>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <button
        className="mt-4 rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 focus:outline-none focus:ring-2 focus:ring-red-700"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </section>
  );
}

function DashboardEmpty() {
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-950">
        Nenhum dado operacional encontrado.
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Quando houver registros no periodo selecionado, os indicadores aparecerao aqui.
      </p>
    </section>
  );
}

function InlineEmpty({ text }: { text: string }) {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
      {text}
    </p>
  );
}

function isDashboardEmpty(dashboard: AdminDashboardResponse) {
  const metricTotal = Object.values(dashboard.indicators).reduce(
    (total, metric) => total + metric.value,
    0,
  );
  const listTotal =
    dashboard.agendaToday.collectionFollowUps.length +
    dashboard.agendaToday.preRegistrationsToReview.length +
    dashboard.agendaToday.pendingCards.length +
    dashboard.criticalAlerts.length;
  return metricTotal === 0 && listTotal === 0;
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CRITICAL: "Critico",
    HIGH: "Alta",
    NORMAL: "Normal",
    NEAR_FULL: "Quase lotado",
    FULL: "Lotado",
    DOCUMENTS_PENDING: "Incompleto",
    FOLLOW_UP_TODAY: "Hoje",
    PROMISE_BROKEN: "Promessa quebrada",
    PARTIAL_PAYMENT_REVIEW: "Revisao parcial",
    ISSUE_FAILED: "Falha",
    CANCELLATION_FAILED: "Falha",
    PENDING_CANCELLATION: "Cancelamento",
  };
  return labels[status] ?? translateStatus(status);
}

function badgeClass(status: string) {
  if (
    status.includes("CRITICAL") ||
    status.includes("BROKEN") ||
    status === "FULL"
  ) {
    return "shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700";
  }
  if (
    status.includes("PENDING") ||
    status.includes("WARNING") ||
    status === "HIGH" ||
    status === "NEAR_FULL"
  ) {
    return "shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700";
  }
  return "shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700";
}

function statusDotClass(status: DashboardMetric["status"]) {
  const colors: Record<DashboardMetric["status"], string> = {
    danger: "bg-red-500",
    neutral: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
  };
  return `mt-1 h-2.5 w-2.5 rounded-full ${colors[status]}`;
}

function barColorClass(status?: DashboardChartPoint["status"]) {
  if (status === "FULL") {
    return "bg-red-500";
  }
  if (status === "NEAR_FULL") {
    return "bg-amber-500";
  }
  return "bg-slate-700";
}
