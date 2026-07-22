"use client";

import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search,
} from "lucide-react";
import type { ApiUser } from "../../../lib/api";
import { getPrimaryRoleLabel } from "../../../lib/auth";
import type { AdminNavItem } from "../admin-navigation";
import { adminTheme, cx } from "../admin-theme";

export function AdminTopbar({
  currentItem,
  onMobileMenu,
  onToggleSidebar,
  sidebarCollapsed,
  user,
}: {
  currentItem: AdminNavItem;
  onMobileMenu: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  user: ApiUser;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/[0.92] shadow-[0_1px_0_rgba(15,46,46,0.03)] backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Abrir menu"
            className={cx(adminTheme.iconButton, "md:hidden")}
            onClick={onMobileMenu}
            type="button"
          >
            <Menu size={20} />
          </button>
          <button
            aria-label={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
            className={cx(adminTheme.iconButton, "hidden md:grid")}
            onClick={onToggleSidebar}
            type="button"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-normal text-slate-950">
              {currentItem.label}
            </p>
            <p className="hidden items-center gap-2 truncate text-sm text-slate-500 sm:flex">
              <Route aria-hidden="true" size={14} strokeWidth={2} className="text-[#1F6F5F]" />
              <span className="truncate">{currentItem.description}</span>
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="hidden min-w-52 items-center gap-2 rounded-xl border border-[#D8E9E4] bg-[#F8FAFA]/90 px-3 py-2 text-sm text-slate-400 shadow-inner lg:flex"
          >
            <Search className="text-[#1F6F5F]" size={16} />
            <span>Busca do painel</span>
          </div>
          <div className="hidden text-right sm:block">
            <p className="max-w-40 truncate text-sm font-semibold text-slate-950">
              {user.name}
            </p>
            <p className="text-xs text-slate-500">{getPrimaryRoleLabel(user)}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0F2E2E] text-sm font-semibold text-white shadow-sm ring-1 ring-[#1F6F5F]/20">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
