"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Bus,
  CalendarClock,
  ChevronRight,
  FileWarning,
  Inbox,
  GraduationCap,
  Landmark,
  MapPinned,
  Receipt,
  Route,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  type AdminDashboardResponse,
  type DashboardChart,
  type DashboardChartPoint,
  type DashboardListItem,
  type DashboardMetric,
  type DashboardQuickShortcut,
} from "../../../lib/api";
import { translateStatus } from "../../../lib/formatters";
import { formatDate } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";

export type DashboardIndicatorKey = keyof AdminDashboardResponse["indicators"];
export type VisualTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<
  VisualTone,
  {
    badge: string;
    bar: string;
    border: string;
    icon: string;
    rail: string;
    soft: string;
    text: string;
  }
> = {
  danger: {
    badge: "border-red-200 bg-red-50 text-red-800",
    bar: "bg-red-500",
    border: "border-red-200",
    icon: "bg-red-50 text-red-700 ring-red-100",
    rail: "bg-red-500",
    soft: "bg-red-50",
    text: "text-red-700",
  },
  info: {
    badge: "border-[#B8D6CF] bg-[#EEF7F4] text-[#14534D]",
    bar: "bg-[#1F6F5F]",
    border: "border-[#B8D6CF]",
    icon: "bg-[#EEF7F4] text-[#14534D] ring-[#D8E9E4]",
    rail: "bg-[#1F6F5F]",
    soft: "bg-[#EEF7F4]",
    text: "text-[#14534D]",
  },
  neutral: {
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    bar: "bg-slate-500",
    border: "border-slate-200",
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    rail: "bg-slate-300",
    soft: "bg-slate-50",
    text: "text-slate-700",
  },
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-500",
    border: "border-emerald-200",
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rail: "bg-emerald-500",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    bar: "bg-amber-500",
    border: "border-amber-200",
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    rail: "bg-amber-500",
    soft: "bg-amber-50",
    text: "text-amber-700",
  },
};

const metricIcons: Record<string, LucideIcon> = {
  activeStudents: GraduationCap,
  activeBuses: Bus,
  availableSeats: Bus,
  bankSlipsAttention: AlertTriangle,
  bankSlipErrors: AlertTriangle,
  busSeats: Bus,
  cancelledAmount: Receipt,
  incompleteDocuments: FileWarning,
  fullBuses: Bus,
  followUpsToday: CalendarClock,
  missingDrivers: Route,
  openAmount: WalletCards,
  overdueAmount: WalletCards,
  overdueFollowUps: CalendarClock,
  overdueInvoices: Receipt,
  paidThisMonth: Receipt,
  pendingPreRegistrations: Users,
  pendingCollections: WalletCards,
  pendingStudentCards: BadgeCheck,
  promisesActive: CalendarClock,
  promisesBroken: AlertTriangle,
  suspendedStudents: Users,
  terminatedStudents: Users,
};

export function DashboardKpiCard({
  metric,
  metricKey,
  priority = false,
}: {
  metric: DashboardMetric;
  metricKey: DashboardIndicatorKey;
  priority?: boolean;
}) {
  const Icon = metricIcons[metricKey] ?? Receipt;
  const tone = resolveMetricTone(metric, metricKey);
  const classes = toneClasses[tone];

  return (
    <article
      className={cx(
        adminTheme.card,
        "group relative overflow-hidden transition duration-150 motion-reduce:transition-none",
        priority
          ? `min-h-44 p-5 shadow-[0_14px_34px_rgba(15,46,46,0.07)] ${classes.border}`
          : "border-slate-200/80 bg-white/75 p-4 shadow-sm hover:border-[#B8D6CF]",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-x-0 top-0 h-1",
          priority ? classes.rail : "bg-slate-200",
        )}
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-600">
            {metric.label}
          </p>
          <p
            className={
              priority
                ? "mt-3 text-3xl font-bold tracking-normal text-slate-950"
                : "mt-2 text-xl font-bold tracking-normal text-slate-950"
            }
          >
            {metric.formattedValue}
          </p>
        </div>
        <span
          className={`grid shrink-0 place-items-center rounded-xl shadow-sm ring-1 ${classes.icon} ${
            priority ? "h-11 w-11" : "h-9 w-9"
          }`}
          aria-hidden="true"
        >
          <Icon size={priority ? 22 : 18} strokeWidth={2} />
        </span>
      </div>
      <div className={cx("mt-4 flex items-end justify-between gap-3", priority ? "min-h-12" : "min-h-8")}>
        <p className="line-clamp-2 text-sm text-slate-500">
          {metric.context ?? "Sem contexto adicional."}
        </p>
        <DashboardStatusBadge tone={tone} label={toneLabel(tone)} />
      </div>
    </article>
  );
}

export function DashboardOperationalCard({
  metric,
  onOpen,
}: {
  metric: DashboardMetric;
  onOpen?: (href: string) => void;
}) {
  const Icon = metricIcons[metric.key] ?? Receipt;
  const tone = resolveMetricTone(metric);
  const classes = toneClasses[tone];
  const clickable = Boolean(metric.href && onOpen);
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cx("absolute inset-y-0 left-0 w-1", classes.rail)}
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-600">
            {metric.label}
          </p>
          <p className="mt-3 break-words text-2xl font-bold tracking-normal text-slate-950">
            {metric.formattedValue}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm ring-1 ${classes.icon}`}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-4 min-h-10 break-words text-sm leading-5 text-slate-500">
        {metric.context ?? "Sem contexto adicional."}
      </p>
    </>
  );

  const className = cx(
    adminTheme.card,
    "relative min-h-36 overflow-hidden bg-white/80 p-4 text-left shadow-sm transition duration-150 motion-reduce:transition-none",
    clickable
      ? "cursor-pointer hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 motion-reduce:hover:translate-y-0"
      : "",
  );

  const href = metric.href;
  if (clickable && href && onOpen) {
    return (
      <button
        aria-label={`Abrir ${metric.label}`}
        className={className}
        onClick={() => onOpen(href)}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export function DashboardSection({
  children,
  className = "",
  icon: Icon,
  subtitle,
  title,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
  subtitle?: string;
  title: string;
  tone?: VisualTone;
}) {
  const classes = toneClasses[tone];
  return (
    <section
      className={cx(adminTheme.card, "relative grid gap-4 overflow-hidden p-5", className)}
    >
      <span
        aria-hidden="true"
        className={cx("absolute left-0 top-5 h-10 w-1 rounded-r-full", classes.rail)}
      />
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm ring-1 ${classes.icon}`}
          >
            <Icon size={20} strokeWidth={2} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-sm leading-5 text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DashboardMetricStrip({ metrics }: { metrics: DashboardMetric[] }) {
  if (metrics.length === 0) {
    return <DashboardEmptyState text="Sem indicadores para exibir." />;
  }

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      {metrics.map((metric) => {
        const tone = resolveMetricTone(metric);
        return (
          <div
            className="rounded-lg border border-slate-200/70 bg-[#F8FAFA]/75 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            key={metric.key}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">
                {metric.label}
              </p>
              <span
                className={`mt-1 h-2 w-8 shrink-0 rounded-full ${toneClasses[tone].rail}`}
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-lg font-bold text-slate-950">
              {metric.formattedValue}
            </p>
            {metric.context ? (
              <p className="mt-1 text-xs text-slate-500">{metric.context}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function DashboardListCard({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: DashboardListItem[];
  title: string;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <DashboardEmptyState compact text={emptyText} />
      ) : (
        <ul className="grid min-w-0 gap-2">
          {items.map((item, index) => {
            const tone = resolveListItemTone(item);
            return (
              <li
                className={cx(
                  "relative overflow-hidden rounded-xl border transition duration-150 hover:border-[#B8D6CF] hover:bg-[#F8FAFA] motion-reduce:transition-none",
                  index === 0
                    ? "border-slate-200/90 bg-white px-3 py-3 shadow-sm"
                    : "border-slate-200/60 bg-white/70 px-3 py-2.5",
                )}
                key={item.id}
              >
                <span
                  aria-hidden="true"
                  className={cx("absolute inset-y-3 left-0 w-1 rounded-r-full", toneClasses[tone].rail)}
                />
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 pl-2">
                    <p className={cx("break-words font-semibold text-slate-950", index === 0 ? "text-sm" : "text-xs")}>
                      {item.label}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                      {item.description ?? "Sem descricao"}
                    </p>
                  </div>
                  <DashboardStatusBadge label={statusLabel(item.status)} tone={tone} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {item.date ? (
                    <span className="rounded-full bg-[#F2F8F6] px-2 py-1 text-[#14534D] ring-1 ring-[#D8E9E4]">
                      {formatDate(item.date)}
                    </span>
                  ) : null}
                  {typeof item.amountCents === "number" ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {formatCents(item.amountCents)}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DashboardChartCard({
  chart,
  emptyText = "Sem dados suficientes para este grafico.",
}: {
  chart: DashboardChart;
  emptyText?: string;
}) {
  const isOccupancyChart = chart.key === "occupancyByBus";
  const isInstitutionChart = chart.key === "studentsByInstitution";
  const chartData = [...chart.data].sort((left, right) => {
    if (isOccupancyChart) {
      const leftPercent = busOccupancyPercent(left);
      const rightPercent = busOccupancyPercent(right);
      return rightPercent - leftPercent || left.label.localeCompare(right.label);
    }
    if (isInstitutionChart) {
      return right.value - left.value || left.label.localeCompare(right.label);
    }
    return 0;
  });
  const max = Math.max(...chartData.map((item) => item.value), 0);
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <DashboardSection
      icon={
        chart.key === "occupancyByBus"
          ? Route
          : chart.key === "studentsByInstitution"
            ? Landmark
            : chart.key === "preRegistrationsByMonth"
              ? MapPinned
              : Receipt
      }
      subtitle={chart.description}
      title={chart.title}
      tone={isOccupancyChart ? "info" : "neutral"}
    >
      {chart.data.length === 0 || max === 0 ? (
        <DashboardEmptyState compact text={emptyText} />
      ) : (
        <div className="grid min-w-0 gap-4">
          {isOccupancyChart ? (
            <DashboardTransportSummary data={chartData} />
          ) : (
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 pb-2 text-xs text-slate-500">
              <span>0</span>
              <span className="min-w-0 text-center">
                {isInstitutionChart
                  ? `Ranking por quantidade - total ${formatChartValue(total)}`
                  : "Escala relativa"}
              </span>
              <span>{formatChartValue(max)}</span>
            </div>
          )}
          <div className="grid min-w-0 gap-3">
            {chartData.map((point, index) => {
              const widthPercent = isOccupancyChart
                ? busOccupancyPercent(point)
                : (point.value / max) * 100;
              return (
                <DashboardBarRow
                  index={index}
                  key={`${chart.key}-${point.busId ?? point.label}`}
                  label={point.label}
                  point={point}
                  total={total}
                  value={pointValueLabel(chart, point, total)}
                  widthPercent={widthPercent}
                />
              );
            })}
          </div>
        </div>
      )}
    </DashboardSection>
  );
}

export function DashboardQuickShortcuts({
  isShortcutAvailable,
  onShortcut,
  shortcuts,
}: {
  isShortcutAvailable: (shortcut: DashboardQuickShortcut) => boolean;
  onShortcut?: (shortcut: DashboardQuickShortcut) => void;
  shortcuts: DashboardQuickShortcut[];
}) {
  if (shortcuts.length === 0) {
    return <DashboardEmptyState compact text="Nenhum atalho disponivel." />;
  }

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {shortcuts.map((shortcut) => {
        const available = isShortcutAvailable(shortcut);
        return (
          <button
            className="group flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition duration-150 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 motion-reduce:transition-none"
            disabled={!available}
            key={shortcut.key}
            onClick={() => onShortcut?.(shortcut)}
            type="button"
          >
            <span className="break-words">{shortcut.label}</span>
            <ChevronRight
              aria-hidden="true"
              className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              size={16}
            />
          </button>
        );
      })}
    </div>
  );
}

export function DashboardEmptyState({
  compact = false,
  text,
  title,
}: {
  compact?: boolean;
  text: string;
  title?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-[#B8D6CF] bg-[#F8FAFA]/90 text-slate-500 ${
        compact ? "px-3 py-3 text-sm" : "p-5"
      }`}
    >
      <div className={cx("flex items-start", compact ? "gap-2" : "gap-3")}>
        <span
          aria-hidden="true"
          className={cx(
            "grid shrink-0 place-items-center rounded-lg bg-white text-[#1F6F5F] ring-1 ring-[#D8E9E4]",
            compact ? "h-7 w-7" : "h-9 w-9",
          )}
        >
          <Inbox size={compact ? 14 : 18} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          {title ? (
            <p className="text-sm font-semibold text-slate-800">{title}</p>
          ) : null}
          <p className={title ? "mt-1 text-sm leading-5" : "text-sm leading-5"}>{text}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: VisualTone;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ${toneClasses[tone].badge}`}
    >
      {label}
    </span>
  );
}

export const dashboardSectionIcons = {
  academics: GraduationCap,
  agenda: CalendarClock,
  alerts: AlertTriangle,
  cards: BadgeCheck,
  collections: CalendarClock,
  documents: FileWarning,
  finance: WalletCards,
  institution: Landmark,
  preRegistrations: Users,
  quickActions: Bell,
  route: MapPinned,
  shortcuts: Bell,
  transport: Bus,
};

export function resolveMetricTone(
  metric: DashboardMetric,
  metricKey?: DashboardIndicatorKey,
): VisualTone {
  const value = metric.value;

  if (metricKey === "activeStudents") {
    return value > 0 ? "success" : "neutral";
  }
  if (metricKey === "overdueAmount" || metricKey === "overdueInvoices") {
    return value > 0 ? "danger" : "success";
  }
  if (
    metricKey === "pendingPreRegistrations" ||
    metricKey === "pendingStudentCards" ||
    metricKey === "incompleteDocuments"
  ) {
    return value > 0 ? "warning" : "success";
  }
  if (metricKey === "bankSlipsAttention") {
    return value > 0 ? "danger" : "success";
  }
  if (metricKey === "busSeats") {
    return metric.status === "danger"
      ? "danger"
      : metric.status === "warning"
        ? "warning"
        : value > 0
          ? "info"
          : "neutral";
  }

  if (metric.status === "danger") {
    return "danger";
  }
  if (metric.status === "warning") {
    return "warning";
  }
  if (metric.status === "success") {
    return "success";
  }
  return "neutral";
}

export function resolveListItemTone(item: DashboardListItem): VisualTone {
  if (
    item.status === "FULL" ||
    item.status === "CRITICAL" ||
    item.status === "PROMISE_BROKEN" ||
    item.status === "ISSUE_FAILED" ||
    item.status === "CANCELLATION_FAILED"
  ) {
    return "danger";
  }
  if (
    item.status === "HIGH" ||
    item.status === "NEAR_FULL" ||
    item.status === "DOCUMENTS_PENDING" ||
    item.status === "PENDING" ||
    item.status === "PENDING_CANCELLATION" ||
    item.status === "FOLLOW_UP_TODAY"
  ) {
    return "warning";
  }
  if (item.status === "NORMAL") {
    return "success";
  }
  return "neutral";
}

function DashboardBarRow({
  index,
  label,
  point,
  total,
  value,
  widthPercent,
}: {
  index: number;
  label: string;
  point: DashboardChartPoint;
  total: number;
  value: string;
  widthPercent: number;
}) {
  const tone = resolveChartTone(point);
  const width = Math.min(Math.max(widthPercent, 0), 100);
  const isBus = typeof point.capacity === "number";
  const rank = index + 1;

  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-slate-100 bg-white/70 p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-start gap-2">
          {!isBus ? (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EEF7F4] text-xs font-bold text-[#14534D] ring-1 ring-[#D8E9E4]">
              {rank}
            </span>
          ) : null}
          <div className="min-w-0">
            <span className="block break-words font-semibold text-slate-800">
              {label}
            </span>
            <span className="mt-1 block break-words leading-5 text-slate-500">
              {value}
            </span>
          </div>
        </div>
        {point.status ? (
          <DashboardStatusBadge label={statusLabel(point.status)} tone={tone} />
        ) : null}
      </div>
      <div
        aria-label={`${label}: ${value}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(Math.min(Math.max(widthPercent, 0), 100))}
        className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70"
        role="progressbar"
        title={`${label}: ${value}`}
      >
        <div
          className={`h-3 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${toneClasses[tone].bar}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {!isBus && total > 0 ? (
        <p className="text-[11px] leading-4 text-slate-500">
          Barra em escala relativa ao maior volume do ranking.
        </p>
      ) : null}
    </div>
  );
}

function DashboardTransportSummary({ data }: { data: DashboardChartPoint[] }) {
  const summary = data.reduce(
    (acc, point) => {
      const capacity = point.capacity ?? 0;
      const occupied = point.occupiedSeats ?? point.value;
      acc.totalBuses += 1;
      acc.capacity += capacity;
      acc.occupied += occupied;
      acc.available += point.availableSeats ?? Math.max(capacity - occupied, 0);
      if (point.status === "FULL" || point.status === "NEAR_FULL") {
        acc.attention += 1;
      }
      return acc;
    },
    { attention: 0, available: 0, capacity: 0, occupied: 0, totalBuses: 0 },
  );

  const items = [
    ["Total de ônibus", summary.totalBuses],
    ["Vagas totais", summary.capacity],
    ["Ocupadas", summary.occupied],
    ["Livres", summary.available],
    ["Quase lotados/lotados", summary.attention],
  ] as const;

  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-[#D8E9E4] bg-[#F8FAFA]/80 p-3 sm:grid-cols-5">
      {items.map(([label, value]) => (
        <div className="min-w-0" key={label}>
          <p className="break-words text-[11px] font-semibold uppercase leading-4 text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-base font-bold text-slate-950">
            {formatChartValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function resolveChartTone(point: DashboardChartPoint): VisualTone {
  if (point.status === "FULL") {
    return "danger";
  }
  if (point.status === "NEAR_FULL") {
    return "warning";
  }
  if (point.status === "NORMAL") {
    return "success";
  }
  return "info";
}

function pointValueLabel(
  chart: DashboardChart,
  point: DashboardChartPoint,
  total: number,
) {
  if (chart.key === "occupancyByBus") {
    const occupied = point.occupiedSeats ?? 0;
    const capacity = point.capacity ?? 0;
    const available = point.availableSeats ?? Math.max(capacity - occupied, 0);
    return `${formatChartValue(occupied)} de ${formatChartValue(capacity)} ocupadas · ${formatPercent(busOccupancyPercent(point))} · ${formatChartValue(available)} ${available === 1 ? "vaga livre" : "vagas livres"}`;
  }
  if (chart.key === "studentsByInstitution") {
    return `${formatChartValue(point.value)} ${point.value === 1 ? "acadêmico" : "acadêmicos"} · ${formatPercent(total > 0 ? (point.value / total) * 100 : 0)}`;
  }
  if (typeof point.amountCents === "number") {
    return formatCents(point.amountCents);
  }
  return formatChartValue(point.value);
}

function busOccupancyPercent(point: DashboardChartPoint) {
  const capacity = point.capacity ?? 0;
  const occupied = point.occupiedSeats ?? 0;
  return capacity > 0 ? (occupied / capacity) * 100 : 0;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)}%`;
}

function formatChartValue(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CANCELLATION_FAILED: "Falha",
    CRITICAL: "Critico",
    DOCUMENTS_PENDING: "Incompleto",
    FOLLOW_UP_TODAY: "Hoje",
    FULL: "Lotado",
    HIGH: "Alta",
    ISSUE_FAILED: "Falha",
    NEAR_FULL: "Quase lotado",
    NORMAL: "Normal",
    PARTIAL_PAYMENT_REVIEW: "Revisao parcial",
    PENDING: "Pendente",
    PENDING_CANCELLATION: "Cancelamento",
    PROMISE_BROKEN: "Promessa quebrada",
  };
  return labels[status] ?? translateStatus(status);
}

function toneLabel(tone: VisualTone) {
  const labels: Record<VisualTone, string> = {
    danger: "Critico",
    info: "Operacao",
    neutral: "Neutro",
    success: "Saudavel",
    warning: "Atencao",
  };
  return labels[tone];
}
