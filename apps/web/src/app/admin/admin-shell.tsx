"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiUser } from "../../lib/api";
import { canAccessRestrictedAdmin, getPrimaryRoleLabel } from "../../lib/auth";

export function AdminShell() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .me()
      .then((response) => {
        if (active) {
          setUser(response.user);
        }
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

  async function handleLogout() {
    setError("");

    try {
      await api.logout();
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao sair");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Painel administrativo
            </p>
            <h1 className="text-xl font-semibold text-slate-950">Atretu</h1>
          </div>
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            onClick={handleLogout}
            type="button"
          >
            Sair
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-6">
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Usuario autenticado</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {user.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
          <span className="mt-3 inline-flex rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {getPrimaryRoleLabel(user)}
          </span>
        </div>

        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Base de seguranca
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            A autenticacao administrativa esta ativa. Os modulos operacionais
            serao liberados somente nas proximas sprints aprovadas.
          </p>
        </div>

        {!canAccessRestrictedAdmin(user) ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Seu perfil possui acesso operacional. Areas restritas do Super
            Admin permanecem bloqueadas.
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}
