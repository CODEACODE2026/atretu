import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto flex max-w-5xl flex-col gap-4 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Atretu</p>
        <h1 className="text-2xl font-semibold text-slate-950">Atretu</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Sistema administrativo com pre-cadastro publico para analise da
          secretaria.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            href="/pre-cadastro"
          >
            Fazer pre-cadastro
          </Link>
          <Link
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            href="/login"
          >
            Acessar painel
          </Link>
        </div>
      </section>
    </main>
  );
}
