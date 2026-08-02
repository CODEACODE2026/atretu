"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { adminTheme, cx } from "../admin-theme";

type Tone = "slate" | "blue" | "green" | "orange" | "red";

const toneStyles: Record<
  Tone,
  {
    badge: string;
    icon: string;
    soft: string;
  }
> = {
  slate: {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    icon: "border-slate-200 bg-slate-100 text-slate-700",
    soft: "bg-slate-50 text-slate-600",
  },
  blue: {
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    icon: "border-sky-200 bg-sky-50 text-sky-700",
    soft: "bg-sky-50 text-sky-700",
  },
  green: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    soft: "bg-emerald-50 text-emerald-700",
  },
  orange: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    soft: "bg-amber-50 text-amber-700",
  },
  red: {
    badge: "border-red-200 bg-red-50 text-red-700",
    icon: "border-red-200 bg-red-50 text-red-700",
    soft: "bg-red-50 text-red-700",
  },
};

export function AdminModuleHeader({
  actions,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 gap-4">
        <span className={adminTheme.atretuMark}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 md:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function AdminSummaryCard({
  description,
  icon: Icon,
  label,
  tone = "slate",
  value,
}: {
  description?: string;
  icon: LucideIcon;
  label: string;
  tone?: Tone;
  value: ReactNode;
}) {
  return (
    <article className={cx(adminTheme.card, "p-4")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={cx(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
            toneStyles[tone].icon,
          )}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      {description ? (
        <p className="mt-3 text-sm leading-5 text-slate-600">{description}</p>
      ) : null}
    </article>
  );
}

export function AdminSectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200/80 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminStatusBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneStyles[tone].badge,
      )}
    >
      {children}
    </span>
  );
}

export function AdminEmptyState({
  description,
  loading,
  title,
}: {
  description?: string;
  loading?: boolean;
  title: string;
}) {
  const Icon = loading ? Loader2 : Inbox;
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
        <Icon
          aria-hidden="true"
          className={cx("h-5 w-5", loading ? "animate-spin" : undefined)}
        />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-5 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function AdminFeedback({
  children,
  tone,
}: {
  children: ReactNode;
  tone: Extract<Tone, "green" | "red" | "orange">;
}) {
  const Icon = tone === "green" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={cx(
        "flex items-start gap-2 border-b border-current/10 px-4 py-3 text-sm",
        toneStyles[tone].soft,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function AdminConfirmDialog({
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  description,
  disabled,
  onCancel,
  onConfirm,
  tone = "slate",
  title,
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: Tone;
  title: string;
}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex gap-3 p-5">
          <span
            className={cx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
              toneStyles[tone].icon,
            )}
          >
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button
            className={adminTheme.secondaryButton}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={cx(
              adminTheme.primaryButton,
              tone === "red" ? "bg-red-600 hover:bg-red-700" : undefined,
              tone === "orange" ? "bg-amber-600 hover:bg-amber-700" : undefined,
            )}
            disabled={disabled}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
