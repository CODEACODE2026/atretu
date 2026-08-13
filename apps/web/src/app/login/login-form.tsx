"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, ApiRequestError } from "../../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;

    const message = window.sessionStorage.getItem("atretu_login_notice");
    if (message) {
      setNotice(message);
      window.sessionStorage.removeItem("atretu_login_notice");
    }

    api
      .me()
      .then((response) => {
        router.replace(
          response.user.mustChangePassword ? "/first-access" : "/admin",
        );
      })
      .catch(() => {
        if (active) {
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (error) {
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  useEffect(() => {
    if (!password) {
      setShowPassword(false);
    }
  }, [password]);

  if (checkingSession) {
    return (
      <LoginCardShell>
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
          <Loader2
            className="h-6 w-6 animate-spin text-cyan-700"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-600">
            Validando acesso...
          </p>
        </div>
      </LoginCardShell>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const response = await api.login(email, password);
      setPassword("");
      router.replace(response.user.mustChangePassword ? "/first-access" : "/admin");
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        setError("Credenciais invalidas ou acesso indisponivel.");
      } else {
        setError(
          caught instanceof Error ? caught.message : "Credenciais invalidas",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginCardShell>
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase text-cyan-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Area segura
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">
            Acessar sistema
          </h1>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          E-mail
          <input
            autoComplete="email"
            className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 sm:text-sm"
            disabled={loading}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-slate-700"
            htmlFor="login-password"
          >
            Senha
          </label>
          <div className="relative">
            <input
              autoComplete="current-password"
              className="h-11 w-full rounded border border-slate-300 bg-white px-3 pr-11 text-base text-slate-950 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 sm:text-sm"
              disabled={loading}
              id="login-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={
                showPassword
                  ? "Ocultar conteudo do campo"
                  : "Exibir conteudo do campo"
              }
              className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || !password}
              onClick={() => setShowPassword((current) => !current)}
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              type="button"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {notice ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Entrando...
            </>
          ) : (
            <>
              <LockKeyhole className="h-4 w-4" aria-hidden />
              Entrar
            </>
          )}
        </button>
      </form>
    </LoginCardShell>
  );
}

function LoginCardShell({ children }: { children: ReactNode }) {
  return (
    <section className="w-full max-w-[430px] rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
      <div className="mb-8 flex items-center gap-4">
        <img
          alt="Logo ATRETU"
          className="h-14 w-14 shrink-0 rounded bg-white object-contain ring-1 ring-slate-200"
          height={56}
          src="/atretu-logo.png"
          width={56}
        />
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-6 text-slate-950">ATRETU</p>
          <p className="mt-1 text-xs font-medium uppercase leading-4 text-slate-500">
            Associacao Terra-Riquense de Estudantes Tecnicos e Universitarios
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
