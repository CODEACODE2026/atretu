"use client";

import {
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
} from "lucide-react";
import type { ApiUser } from "../../../lib/api";
import { getPrimaryRoleLabel } from "../../../lib/auth";
import type { AdminArea, AdminNavItem } from "../admin-navigation";
import { adminTheme, cx } from "../admin-theme";

export function AdminSidebar({
  activeArea,
  collapsed,
  items,
  onNavigate,
  onToggleCollapsed,
  onLogout,
  user,
}: {
  activeArea: AdminArea;
  collapsed: boolean;
  items: readonly AdminNavItem[];
  onNavigate: (area: AdminArea) => void;
  onToggleCollapsed: () => void;
  onLogout: () => void;
  user: ApiUser;
}) {
  return (
    <aside
      className={
        collapsed
          ? "fixed inset-y-0 left-0 z-30 hidden w-20 border-r border-slate-200/80 bg-white/95 shadow-[8px_0_30px_rgba(15,23,42,0.03)] backdrop-blur md:flex md:flex-col"
          : "fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200/80 bg-white/95 shadow-[8px_0_30px_rgba(15,23,42,0.03)] backdrop-blur md:flex md:flex-col"
      }
    >
      <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cx(adminTheme.atretuMark, "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold")}>
            <Route aria-hidden="true" size={19} strokeWidth={2.2} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0F2E2E]">
                ATRETU
              </p>
              <p className="truncate text-xs text-slate-500">
                Rotas academicas
              </p>
            </div>
          ) : null}
        </div>
        <button
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          className={cx(adminTheme.iconButton, "h-9 w-9 shrink-0")}
          onClick={onToggleCollapsed}
          type="button"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav
        aria-label="Navegacao administrativa"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {items.map((item) => (
          <SidebarItem
            active={activeArea === item.key}
            collapsed={collapsed}
            item={item}
            key={item.key}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-slate-200/80 p-3">
        <div
          className={
            collapsed
              ? "grid place-items-center rounded-xl border border-[#D8E9E4] bg-[#F8FAFA] p-2 shadow-sm"
              : "rounded-xl border border-[#D8E9E4] bg-[#F8FAFA] p-3 shadow-sm"
          }
        >
          <div className="flex w-full items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-[#14534D] ring-1 ring-[#B8D6CF]">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {getPrimaryRoleLabel(user)}
                </p>
              </div>
            ) : null}
          </div>
          <button
            aria-label="Sair"
            className={
              collapsed
                ? cx(adminTheme.iconButton, "mt-3 h-9 w-9")
                : cx(adminTheme.secondaryButton, "mt-3 w-full")
            }
            onClick={onLogout}
            type="button"
          >
            <LogOut size={16} />
            {!collapsed ? <span>Sair</span> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  active,
  collapsed,
  item,
  onNavigate,
}: {
  active: boolean;
  collapsed: boolean;
  item: AdminNavItem;
  onNavigate: (area: AdminArea) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={cx(
        active
          ? "border-[#0F2E2E] bg-[#0F2E2E] text-white shadow-[0_10px_22px_rgba(15,46,46,0.16)]"
          : "border-transparent text-slate-600 hover:border-[#D8E9E4] hover:bg-[#F2F8F6] hover:text-[#0F2E2E]",
        "relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition duration-150 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 motion-reduce:transition-none",
      )}
      onClick={() => onNavigate(item.key)}
      title={collapsed ? item.label : undefined}
      type="button"
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#7FD0B4]"
        />
      ) : null}
      <Icon className="shrink-0" size={18} strokeWidth={2} />
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate">{item.label}</span>
          <span
            className={
              active
                ? "block truncate text-xs font-medium text-slate-300"
                : "block truncate text-xs font-normal text-slate-400"
            }
          >
            {item.description}
          </span>
        </span>
      ) : null}
    </button>
  );
}
