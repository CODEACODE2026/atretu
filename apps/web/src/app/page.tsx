import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto flex max-w-5xl flex-col gap-4 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Sprint 1</p>
        <h1 className="text-2xl font-semibold text-slate-950">Atretu</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Base administrativa inicial com autenticacao. As regras de negocio
          serao implementadas somente nas sprints aprovadas.
        </p>
        <Link
          className="w-fit rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          href="/login"
        >
          Acessar painel
        </Link>
      </section>
    </main>
  );
}
