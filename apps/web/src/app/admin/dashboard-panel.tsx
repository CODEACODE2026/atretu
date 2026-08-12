"use client";

import { Activity, ChevronRight, RefreshCw, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AdminDashboardResponse,
  type DashboardMetric,
  type DashboardOverviewParams,
  type DashboardQuickShortcut,
} from "../../lib/api";
import { formatDateTime } from "../../lib/formatters/date";
import { adminTheme, cx } from "./admin-theme";
import { DashboardFilters } from "./dashboard-filters";
import {
  DashboardChartCard,
  DashboardEmptyState,
  DashboardKpiCard,
  DashboardListCard,
  DashboardMetricStrip,
  DashboardOperationalCard,
  DashboardSection,
  dashboardSectionIcons,
  type DashboardIndicatorKey,
  type VisualTone,
} from "./components/dashboard-primitives";

type LoadState = "loading" | "loaded" | "error";

const dashboardRequests = new Map<string, Promise<AdminDashboardResponse>>();
const dashboardResponses = new Map<
  string,
  { data: AdminDashboardResponse; storedAt: number }
>();
const DASHBOARD_RESPONSE_DEDUPE_MS = 10000;

const primaryKpiKeys: DashboardIndicatorKey[] = [
  "activeStudents",
  "overdueAmount",
  "overdueInvoices",
  "pendingPreRegistrations",
];

const secondaryKpiKeys: DashboardIndicatorKey[] = [
  "bankSlipsAttention",
  "busSeats",
  "pendingStudentCards",
  "incompleteDocuments",
];

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
  onNavigateHref,
  onShortcut,
}: {
  isShortcutAvailable?: (shortcut: DashboardQuickShortcut) => boolean;
  onNavigateHref?: (href: string) => void;
  onShortcut?: (shortcut: DashboardQuickShortcut) => void;
}) {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [params, setParams] = useState<DashboardOverviewParams>({});
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
        caught instanceof Error ? caught.message : "Não foi possível carregar o dashboard",
      );
      setState("error");
    }
  }

  useEffect(() => {
    void loadDashboard(params);
  }, [params]);

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

  const primaryKpis = primaryKpiKeys.map((key) => ({
    key,
    metric: dashboard.indicators[key],
  }));
  const secondaryKpis = secondaryKpiKeys.map((key) => ({
    key,
    metric: dashboard.indicators[key],
  }));
  const isRefreshing = state === "loading";
  const operationalBlocks = dashboard.operationalBlocks ?? [];

  const operationalContent =
    operationalBlocks.length > 0 ? (
      <>
        {operationalBlocks.map((block) => (
          <DashboardSection
            icon={dashboardSectionIcons[block.key]}
            key={block.key}
            subtitle={block.description}
            title={block.title}
            tone={blockTone(block.key)}
          >
            {block.status === "error" ? (
              <DashboardEmptyState
                compact
                text={block.error ?? "Não foi possível carregar este bloco."}
              />
            ) : block.key === "quickActions" ? (
              <DashboardOperationalFocus
                isShortcutAvailable={isShortcutAvailable}
                metrics={block.metrics}
                onNavigateHref={onNavigateHref}
                onShortcut={onShortcut}
                shortcuts={block.shortcuts ?? dashboard.quickShortcuts}
              />
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {block.metrics.map((metric) => (
                  <DashboardOperationalCard
                    key={metric.key}
                    metric={metric}
                    onOpen={onNavigateHref}
                  />
                ))}
              </div>
            )}
          </DashboardSection>
        ))}

        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          <DashboardChartCard
            chart={dashboard.charts.occupancyByBus}
            emptyText="Sem ocupacao de onibus para exibir."
          />
          <DashboardChartCard chart={dashboard.charts.studentsByInstitution} />
        </section>
      </>
    ) : null;

  return (
    <div className="grid gap-6">
      <section className={cx(adminTheme.card, "relative grid gap-4 overflow-hidden p-4 sm:p-5")}>
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-1 bg-[#1F6F5F]"
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3 pl-2">
            <span
              aria-hidden="true"
              className="mt-0.5 hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF7F4] text-[#14534D] ring-1 ring-[#D8E9E4] sm:grid"
            >
              <Activity size={22} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                Dashboard administrativo
                <span className="inline-flex items-center gap-1 rounded-full border border-[#B8D6CF] bg-[#F8FAFA] px-2 py-0.5 normal-case text-[#14534D]">
                  <Route size={12} strokeWidth={2} />
                  Operação em rota
                </span>
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-slate-950 sm:text-2xl">
                Visão operacional
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Acompanhamento de acadêmicos, cobrança, documentos, transporte e
                pendências do dia em uma leitura única.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Última atualização: {formatDateTime(dashboard.generatedAt)}
              </p>
            </div>
          </div>
          <button
            className={adminTheme.secondaryButton}
            disabled={isRefreshing}
            onClick={() => void loadDashboard(params, true)}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}
              size={16}
            />
            {isRefreshing ? "Atualizando" : "Atualizar"}
          </button>
        </div>

        <DashboardFilters
          appliedParams={params}
          disabled={isRefreshing}
          onApply={setParams}
        />

        {state === "error" ? (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}
      </section>

      {empty ? (
        <DashboardEmptyState
          text="Quando houver registros no período selecionado, os indicadores aparecerão aqui."
          title="Nenhum dado operacional encontrado."
        />
      ) : null}

      {operationalContent ? (
        operationalContent
      ) : (
        <>
      <section
        aria-label="Indicadores principais"
        className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
      >
        {primaryKpis[0] ? (
          <DashboardKpiCard
            key={primaryKpis[0].key}
            metric={primaryKpis[0].metric}
            metricKey={primaryKpis[0].key}
            priority
          />
        ) : null}
        <div className="grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {primaryKpis.slice(1).map(({ key, metric }) => (
            <DashboardKpiCard key={key} metric={metric} metricKey={key} priority />
          ))}
        </div>
      </section>

      <section aria-label="Indicadores secundarios" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryKpis.map(({ key, metric }) => (
          <DashboardKpiCard key={key} metric={metric} metricKey={key} />
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <DashboardSection
          className="xl:min-h-[320px]"
          icon={dashboardSectionIcons.agenda}
          subtitle="Retornos e filas que pedem ação hoje"
          title="Agenda de hoje"
          tone="info"
        >
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <DashboardListCard
              emptyText="Nenhum retorno de cobranca para hoje."
              items={dashboard.agendaToday.collectionFollowUps}
              title="Cobranca"
            />
            <DashboardListCard
              emptyText="Nenhum pre-cadastro pendente na fila."
              items={dashboard.agendaToday.preRegistrationsToReview}
              title="Pre-cadastros"
            />
            <DashboardListCard
              emptyText="Nenhuma carteirinha pendente na fila."
              items={dashboard.agendaToday.pendingCards}
              title="Carteirinhas"
            />
          </div>
        </DashboardSection>

        <DashboardSection
          className="border-red-100 bg-red-50/30"
          icon={dashboardSectionIcons.alerts}
          subtitle="Casos que merecem conferência antes da rotina"
          title="Alertas críticos"
          tone={dashboard.criticalAlerts.length > 0 ? "danger" : "success"}
        >
          <DashboardListCard
            emptyText="Nenhum alerta critico no momento."
            items={dashboard.criticalAlerts}
            title="Prioridade"
          />
        </DashboardSection>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardSection
          icon={dashboardSectionIcons.finance}
          subtitle="Inadimplência, retornos e casos críticos"
          title="Financeiro e cobrança"
          tone="warning"
        >
          <DashboardMetricStrip metrics={dashboard.financeAndCollections.metrics} />
          <DashboardListCard
            emptyText="Nenhum caso critico de cobranca."
            items={dashboard.financeAndCollections.criticalCases}
            title="Casos criticos"
          />
        </DashboardSection>

        <DashboardSection
          icon={dashboardSectionIcons.documents}
          subtitle="Situação cadastral e documentos esperados"
          title="Acadêmicos e documentação"
          tone="info"
        >
          <DashboardMetricStrip metrics={dashboard.academicsAndDocuments.metrics} />
          <DashboardListCard
            emptyText="Nenhum cadastro com documentacao incompleta."
            items={dashboard.academicsAndDocuments.recentItems}
            title="Documentacao incompleta"
          />
        </DashboardSection>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-3">
        <DashboardSection
          icon={dashboardSectionIcons.transport}
          subtitle="Capacidade operacional e ônibus em atenção"
          title="Ônibus e vagas"
          tone="info"
        >
          <DashboardMetricStrip metrics={dashboard.busesAndSeats.metrics} />
          <DashboardListCard
            emptyText="Nenhum onibus proximo da lotacao."
            items={dashboard.busesAndSeats.attentionBuses}
            title="Atencao"
          />
        </DashboardSection>

        <DashboardSection
          icon={dashboardSectionIcons.preRegistrations}
          subtitle="Solicitações aguardando análise"
          title="Pré-cadastros"
          tone="warning"
        >
          <DashboardMetricStrip metrics={dashboard.preRegistrations.metrics} />
          <DashboardListCard
            emptyText="Nenhum pre-cadastro pendente."
            items={dashboard.preRegistrations.pendingItems}
            title="Pendentes"
          />
        </DashboardSection>

        <DashboardSection
          icon={dashboardSectionIcons.cards}
          subtitle="Matrículas sem emissão ativa"
          title="Carteirinhas pendentes"
          tone="warning"
        >
          <DashboardMetricStrip metrics={dashboard.pendingStudentCards.metrics} />
          <DashboardListCard
            emptyText="Nenhuma carteirinha pendente."
            items={dashboard.pendingStudentCards.items}
            title="Pendentes"
          />
        </DashboardSection>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardChartCard
          chart={dashboard.charts.occupancyByBus}
          emptyText="Sem ocupacao de onibus para exibir."
        />
        <DashboardChartCard chart={dashboard.charts.studentsByInstitution} />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardChartCard chart={dashboard.charts.overdueByAgingBucket} />
        <DashboardChartCard chart={dashboard.charts.preRegistrationsByMonth} />
      </section>

      <DashboardSection
        icon={dashboardSectionIcons.shortcuts}
        subtitle="Itens que pedem atenção antes da rotina"
        title="Pendências operacionais"
        tone="neutral"
      >
        <DashboardOperationalFocus
          isShortcutAvailable={isShortcutAvailable}
          metrics={[]}
          onNavigateHref={onNavigateHref}
          onShortcut={onShortcut}
          shortcuts={dashboard.quickShortcuts}
        />
      </DashboardSection>
        </>
      )}
    </div>
  );
}

function DashboardOperationalFocus({
  isShortcutAvailable,
  metrics,
  onNavigateHref,
  onShortcut,
  shortcuts,
}: {
  isShortcutAvailable: (shortcut: DashboardQuickShortcut) => boolean;
  metrics: DashboardMetric[];
  onNavigateHref?: (href: string) => void;
  onShortcut?: (shortcut: DashboardQuickShortcut) => void;
  shortcuts: DashboardQuickShortcut[];
}) {
  const availableShortcuts = shortcuts.filter(isShortcutAvailable);

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.34fr)]">
      <div className="min-w-0">
        {metrics.length === 0 ? (
          <DashboardEmptyState
            compact
            text="Nenhuma pendência operacional no momento."
          />
        ) : (
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {metrics.map((metric) => (
              <button
                className="group grid min-w-0 gap-2 rounded-xl border border-slate-200/80 bg-white/85 px-3 py-2.5 text-left shadow-sm transition duration-150 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 disabled:cursor-default disabled:hover:border-slate-200/80 disabled:hover:bg-white/85 motion-reduce:transition-none"
                disabled={!metric.href || !onNavigateHref}
                key={metric.key}
                onClick={() => {
                  if (metric.href) {
                    onNavigateHref?.(metric.href);
                  }
                }}
                type="button"
              >
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase text-slate-500">
                      {metric.label}
                    </span>
                    <span className="mt-1 block break-words text-sm leading-5 text-slate-600">
                      {metric.context ?? "Sem contexto adicional."}
                    </span>
                  </span>
                  <span className="shrink-0 text-xl font-bold tracking-normal text-slate-950">
                    {metric.formattedValue}
                  </span>
                </span>
                {metric.href && onNavigateHref ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#14534D]">
                    Ver
                    <ChevronRight
                      aria-hidden="true"
                      className="transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                      size={14}
                    />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {availableShortcuts.length > 0 ? (
        <div className="min-w-0 rounded-xl border border-slate-200/80 bg-[#F8FAFA]/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Ações úteis
          </p>
          <div className="grid min-w-0 gap-2">
            {availableShortcuts.map((shortcut) => (
              <button
                className="group flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition duration-150 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 motion-reduce:transition-none"
                key={shortcut.key}
                onClick={() => onShortcut?.(shortcut)}
                type="button"
              >
                <span className="min-w-0 break-words">{shortcut.label}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  size={15}
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function blockTone(key: "academics" | "finance" | "collections" | "transport" | "quickActions"): VisualTone {
  if (key === "finance" || key === "collections") {
    return "warning";
  }
  if (key === "transport" || key === "academics") {
    return "info";
  }
  return "neutral";
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
        <div className={cx(adminTheme.card, "p-5")}>
        <div className="h-3 w-36 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-64 max-w-full rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-slate-100" />
        <div className="mt-5 h-14 rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={cx(adminTheme.card, "h-40 p-5")} key={index}>
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-6 h-9 w-28 rounded bg-slate-200" />
            <div className="mt-5 h-4 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={cx(adminTheme.card, "h-32 p-4")} key={index}>
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="mt-5 h-7 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div className={cx(adminTheme.card, "h-72 p-5")} key={index}>
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="mt-5 grid gap-3">
              <div className="h-12 rounded bg-slate-100" />
              <div className="h-12 rounded bg-slate-100" />
              <div className="h-12 rounded bg-slate-100" />
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
    <section className="rounded-xl border border-red-200 bg-red-50/90 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-red-900">
        Nao foi possivel carregar o dashboard.
      </h2>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      <button
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-700/20 focus:ring-offset-2 motion-reduce:transition-none"
        onClick={onRetry}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={16} />
        Tentar novamente
      </button>
    </section>
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
