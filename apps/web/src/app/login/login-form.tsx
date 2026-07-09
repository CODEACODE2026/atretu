"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.login(email, password);
      router.replace("/admin");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Credenciais invalidas",
      );
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
