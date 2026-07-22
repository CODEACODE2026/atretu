"use client";

import { LogOut, Route, X } from "lucide-react";
import { useEffect } from "react";
import type { ApiUser } from "../../../lib/api";
import { getPrimaryRoleLabel } from "../../../lib/auth";
import type { AdminArea, AdminNavItem } from "../admin-navigation";
import { adminTheme, cx } from "../admin-theme";

export function MobileNavigation({
  activeArea,
  items,
  onClose,
  onLogout,
  onNavigate,
  open,
  user,
}: {
  activeArea: AdminArea;
  items: readonly AdminNavItem[];
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (area: AdminArea) => void;
  open: boolean;
  user: ApiUser;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        aria-label="Fechar menu"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
        type="button"
      />
      <aside className="relative flex h-full w-[min(86vw,22rem)] flex-col border-r border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur">
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4">
          <div className="flex items-center gap-3">
            <div className={cx(adminTheme.atretuMark, "grid h-10 w-10 place-items-center rounded-xl text-sm font-bold")}>
              <Route aria-hidden="true" size={19} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F2E2E]">ATRETU</p>
              <p className="text-xs text-slate-500">Rotas academicas</p>
            </div>
          </div>
          <button
            aria-label="Fechar menu"
            className={cx(adminTheme.iconButton, "h-9 w-9")}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <nav
          aria-label="Navegacao administrativa mobile"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeArea === item.key;
            return (
              <button
                aria-current={active ? "page" : undefined}
                className={cx(
                  active
                    ? "border-[#0F2E2E] bg-[#0F2E2E] text-white shadow-[0_10px_22px_rgba(15,46,46,0.16)]"
                    : "border-transparent text-slate-600 hover:border-[#D8E9E4] hover:bg-[#F2F8F6] hover:text-[#0F2E2E]",
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition duration-150 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 motion-reduce:transition-none",
                )}
                key={item.key}
                onClick={() => onNavigate(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>
                  <span className="block">{item.label}</span>
                  <span
                    className={
                      active
                        ? "block text-xs font-medium text-slate-300"
                        : "block text-xs font-normal text-slate-400"
                    }
                  >
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/80 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#D8E9E4] bg-[#F8FAFA] p-3 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-semibold text-[#14534D] ring-1 ring-[#B8D6CF]">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">
                {user.name}
              </p>
              <p className="text-xs text-slate-500">{getPrimaryRoleLabel(user)}</p>
            </div>
          </div>
          <button
            className={cx(adminTheme.secondaryButton, "mt-3 w-full")}
            onClick={onLogout}
            type="button"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
    </div>
  );
}
