"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiRequestError } from "../../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const message = window.sessionStorage.getItem("atretu_login_notice");
    if (message) {
      setNotice(message);
      window.sessionStorage.removeItem("atretu_login_notice");
    }
  }, []);

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
    <form
      className="flex w-full max-w-sm flex-col gap-4 rounded border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500">Atretu</p>
        <h1 className="text-xl font-semibold text-slate-950">
          Acesso administrativo
        </h1>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        E-mail
        <input
          autoComplete="email"
          className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Senha
        <input
          autoComplete="current-password"
          className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {notice ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={loading}
        type="submit"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
