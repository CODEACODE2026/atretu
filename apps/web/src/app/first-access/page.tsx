"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Route, ShieldCheck } from "lucide-react";
import { api, ApiRequestError, type ApiUser } from "../../lib/api";
import { getPrimaryRoleLabel } from "../../lib/auth";
import { adminTheme, cx } from "../admin/admin-theme";
import {
  AdminFeedback,
  AdminStatusBadge,
} from "../admin/components/admin-ui";
import {
  PasswordField,
  PasswordRequirements,
} from "../admin/account-panel";

type FirstAccessState = {
  confirmPassword: string;
  currentPassword: string;
  error: string;
  newPassword: string;
  saving: boolean;
  showConfirm: boolean;
  showCurrent: boolean;
  showNew: boolean;
  success: string;
};

const initialState: FirstAccessState = {
  confirmPassword: "",
  currentPassword: "",
  error: "",
  newPassword: "",
  saving: false,
  showConfirm: false,
  showCurrent: false,
  showNew: false,
  success: "",
};

export default function FirstAccessPage() {
  const router = useRouter();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<FirstAccessState>(initialState);
  const confirmationMismatch =
    state.confirmPassword.length > 0 && state.confirmPassword !== state.newPassword;
  const canSubmit =
    state.currentPassword.length > 0 &&
    state.newPassword.length > 0 &&
    state.confirmPassword.length > 0 &&
    !confirmationMismatch &&
    !state.saving;

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((response) => {
        if (!active) {
          return;
        }
        if (!response.user.mustChangePassword) {
          router.replace("/admin");
          return;
        }
        setUser(response.user);
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [user]);

  function updateField<K extends keyof FirstAccessState>(
    key: K,
    value: FirstAccessState[K],
  ) {
    setState((current) => ({ ...current, [key]: value, error: "", success: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setState((current) => ({ ...current, saving: true, error: "", success: "" }));
    try {
      await api.changeOwnPassword({
        confirmPassword: state.confirmPassword,
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
      });
      setState({
        ...initialState,
        success: "Senha alterada. Entre novamente com sua nova senha.",
      });
      window.sessionStorage.setItem(
        "atretu_login_notice",
        "Senha alterada. Entre novamente com sua nova senha.",
      );
      window.setTimeout(() => router.replace("/login"), 700);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError && caught.status === 401
          ? "Sessao expirada. Entre novamente."
          : caught instanceof Error
            ? caught.message
            : "Erro ao alterar senha";
      setState({ ...initialState, error: message });
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      router.replace("/login");
    }
  }

  if (loading || !user) {
    return (
      <main className={`grid min-h-screen place-items-center p-6 ${adminTheme.appBackground}`}>
        <p className="text-sm text-slate-600">Carregando primeiro acesso...</p>
      </main>
    );
  }

  return (
    <main className={`min-h-screen p-4 sm:p-6 ${adminTheme.appBackground}`}>
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-5xl content-center gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className={adminTheme.atretuMark}>
              <Route aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Primeiro acesso
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950 md:text-3xl">
                Troque sua senha temporaria
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Esta etapa libera o acesso normal ao Atretu. Depois da troca,
                entre novamente com a nova senha.
              </p>
            </div>
          </div>
          <button className={adminTheme.secondaryButton} onClick={handleLogout} type="button">
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair
          </button>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <form className={adminTheme.card} onSubmit={handleSubmit}>
            <div className="border-b border-slate-200/80 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">
                Nova senha
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Informe a senha temporaria atual e defina sua nova senha.
              </p>
            </div>

            {state.error ? <AdminFeedback tone="red">{state.error}</AdminFeedback> : null}
            {state.success ? (
              <AdminFeedback tone="green">{state.success}</AdminFeedback>
            ) : null}

            <div className="grid gap-4 p-5">
              <PasswordField
                autoComplete="current-password"
                id="first-access-current-password"
                inputRef={firstInputRef}
                label="Senha temporaria atual"
                onChange={(value) => updateField("currentPassword", value)}
                onToggle={() => updateField("showCurrent", !state.showCurrent)}
                show={state.showCurrent}
                value={state.currentPassword}
              />
              <PasswordField
                autoComplete="new-password"
                id="first-access-new-password"
                label="Nova senha"
                onChange={(value) => updateField("newPassword", value)}
                onToggle={() => updateField("showNew", !state.showNew)}
                show={state.showNew}
                value={state.newPassword}
              />
              <PasswordRequirements password={state.newPassword} />
              <PasswordField
                autoComplete="new-password"
                describedBy={confirmationMismatch ? "first-access-confirm-error" : undefined}
                id="first-access-confirm-password"
                label="Confirmar nova senha"
                onChange={(value) => updateField("confirmPassword", value)}
                onToggle={() => updateField("showConfirm", !state.showConfirm)}
                show={state.showConfirm}
                value={state.confirmPassword}
              />
              {confirmationMismatch ? (
                <p className="text-sm text-red-700" id="first-access-confirm-error">
                  A confirmacao precisa ser igual a nova senha.
                </p>
              ) : null}
              <button className={adminTheme.primaryButton} disabled={!canSubmit} type="submit">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                {state.saving ? "Alterando..." : "Concluir primeiro acesso"}
              </button>
            </div>
          </form>

          <aside className={cx(adminTheme.card, "p-5")}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Conta autenticada
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#0F2E2E] text-sm font-semibold text-white">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminStatusBadge tone="orange">Troca pendente</AdminStatusBadge>
              <AdminStatusBadge tone="slate">{getPrimaryRoleLabel(user)}</AdminStatusBadge>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              O menu operacional fica indisponivel ate a conclusao desta troca.
            </p>
          </aside>
        </section>
      </section>
    </main>
  );
}
