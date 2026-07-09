export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto flex max-w-5xl flex-col gap-4 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Sprint 0</p>
        <h1 className="text-2xl font-semibold text-slate-950">Atretu</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Base tecnica inicial criada. As regras de negocio serao implementadas
          somente nas sprints aprovadas.
        </p>
      </section>
    </main>
  );
}
