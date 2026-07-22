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

const metricIcons: Record<DashboardIndicatorKey, LucideIcon> = {
  activeStudents: GraduationCap,
  bankSlipsAttention: AlertTriangle,
  busSeats: Bus,
  incompleteDocuments: FileWarning,
  overdueAmount: WalletCards,
  overdueInvoices: Receipt,
  pendingPreRegistrations: Users,
  pendingStudentCards: BadgeCheck,
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
  const Icon = metricIcons[metricKey];
  const tone = resolveMetricTone(metric, metricKey);
  const classes = toneClasses[tone];

  return (
    <article
      className={cx(
        adminTheme.card,
        adminTheme.cardHover,
        "group relative overflow-hidden",
        priority ? `p-5 ${classes.border}` : "border-slate-200 p-4",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-x-0 top-0 h-1",
          priority ? classes.rail : "bg-slate-200",
        )}
      />
      <div className="flex items-start justify-between gap-3">
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
      <div className="mt-4 flex min-h-8 items-end justify-between gap-3">
        <p className="line-clamp-2 text-sm text-slate-500">
          {metric.context ?? "Sem contexto adicional."}
        </p>
        <DashboardStatusBadge tone={tone} label={toneLabel(tone)} />
      </div>
    </article>
  );
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
    <div className="grid gap-3 sm:grid-cols-2">
      {metrics.map((metric) => {
        const tone = resolveMetricTone(metric);
        return (
          <div
            className="rounded-xl border border-slate-200/80 bg-[#F8FAFA]/85 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
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
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <DashboardEmptyState compact text={emptyText} />
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const tone = resolveListItemTone(item);
            return (
              <li
                className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-3 transition duration-150 hover:border-[#B8D6CF] hover:bg-[#F8FAFA] motion-reduce:transition-none"
                key={item.id}
              >
                <span
                  aria-hidden="true"
                  className={cx("absolute inset-y-3 left-0 w-1 rounded-r-full", toneClasses[tone].rail)}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pl-2">
                    <p className="break-words text-sm font-semibold text-slate-950">
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
  const max = Math.max(...chart.data.map((item) => item.value), 0);

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
      tone={chart.key === "occupancyByBus" ? "info" : "neutral"}
    >
      {chart.data.length === 0 || max === 0 ? (
        <DashboardEmptyState compact text={emptyText} />
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs text-slate-500">
            <span>0</span>
            <span>{chart.key === "occupancyByBus" ? "Ocupacao" : "Escala relativa"}</span>
            <span>{formatChartValue(max)}</span>
          </div>
          <div className="grid gap-3">
            {chart.data.map((point) => (
              <DashboardBarRow
                key={`${chart.key}-${point.busId ?? point.label}`}
                label={point.label}
                point={point}
                value={pointValueLabel(chart, point)}
                widthPercent={chart.key === "occupancyByBus" ? point.occupancyPercent ?? 0 : (point.value / max) * 100}
              />
            ))}
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
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
  agenda: CalendarClock,
  alerts: AlertTriangle,
  cards: BadgeCheck,
  documents: FileWarning,
  finance: WalletCards,
  institution: Landmark,
  preRegistrations: Users,
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
  label,
  point,
  value,
  widthPercent,
}: {
  label: string;
  point: DashboardChartPoint;
  value: string;
  widthPercent: number;
}) {
  const tone = resolveChartTone(point);
  const width = Math.max(4, Math.min(widthPercent, 100));

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 break-words font-semibold text-slate-700">
          {label}
        </span>
        <span className="shrink-0 font-bold text-slate-950">{value}</span>
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
      {point.status ? (
        <div>
          <DashboardStatusBadge label={statusLabel(point.status)} tone={tone} />
        </div>
      ) : null}
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

function pointValueLabel(chart: DashboardChart, point: DashboardChartPoint) {
  if (chart.key === "occupancyByBus") {
    return `${point.occupiedSeats ?? 0}/${point.capacity ?? 0}`;
  }
  if (typeof point.amountCents === "number") {
    return formatCents(point.amountCents);
  }
  return formatChartValue(point.value);
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
