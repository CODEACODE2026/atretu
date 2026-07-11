"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  type AcademicYear,
  type BaseRecord,
  type InvoiceCancellationReason,
  type InvoicePreview,
  type InvoiceRecord,
  type InvoiceStatus,
  type StudentDetail,
  type StudentSummary,
} from "../../lib/api";

export function FinancePanel() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [overdue, setOverdue] = useState<"all" | "overdue" | "notOverdue">("all");
  const defaultMonth = useMemo(() => currentMonthRange(), []);
  const [dueDateFrom, setDueDateFrom] = useState(defaultMonth.from);
  const [dueDateTo, setDueDateTo] = useState(defaultMonth.to);
  const [invoiceEnrollmentId, setInvoiceEnrollmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayDate());
  const [description, setDescription] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [
    page,
    academicYearId,
    institutionId,
    status,
    overdue,
    dueDateFrom,
    dueDateTo,
  ]);

  async function loadReferences() {
    setError("");
    try {
      const [yearsResponse, institutionsResponse] = await Promise.all([
        api.listAcademicYears(),
        api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
      ]);
      setYears(yearsResponse.data);
      setInstitutions(institutionsResponse.data);
      const current = yearsResponse.data.find((year) => year.isCurrent);
      setAcademicYearId(current?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar referencias",
      );
    }
  }

  async function loadInvoices(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const response = await api.listInvoices({
        page,
        limit: 10,
        search: nextSearch,
        academicYearId,
        institutionId,
        status: status || undefined,
        overdue,
        dueDateFrom,
        dueDateTo,
        sort: "dueDate",
        order: "asc",
      });
      setInvoices(response.data);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function searchStudents(nextSearch = studentSearch) {
    setError("");
    try {
      const response = await api.listStudents({
        search: nextSearch,
        status: "all",
        limit: 10,
      });
      setStudents(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao buscar academico");
    }
  }

  async function selectStudent(studentId: string) {
    setError("");
    setPreview(null);
    try {
      const detail = await api.getStudent(studentId);
      setSelectedStudent(detail);
      setInvoiceEnrollmentId(detail.enrollments[0]?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir academico");
    }
  }

  async function handlePreview() {
    if (!selectedStudent || !invoiceEnrollmentId) {
      setError("Selecione academico e matricula");
      return;
    }
    setError("");
    try {
      const response = await api.previewInvoice(selectedStudent.id, {
        enrollmentId: invoiceEnrollmentId,
      });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro no preview");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent || !invoiceEnrollmentId) {
      setError("Selecione academico e matricula");
      return;
    }
    let amountCents: number;
    try {
      amountCents = parseMoneyToCents(amount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Valor invalido");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.createInvoice(selectedStudent.id, {
        enrollmentId: invoiceEnrollmentId,
        amountCents,
        dueDate,
        description: emptyToUndefined(description),
        idempotencyKey: createIdempotencyKey(),
      });
      setMessage("Fatura criada");
      setAmount("");
      setDescription("");
      setPreview(null);
      await loadInvoices();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao criar fatura");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(invoice: InvoiceRecord) {
    const reason = window.prompt(
      "Motivo: MANUAL_CORRECTION, DUPLICATE ou OTHER",
    ) as InvoiceCancellationReason | null;
    if (
      reason !== "MANUAL_CORRECTION" &&
      reason !== "DUPLICATE" &&
      reason !== "OTHER"
    ) {
      setError("Motivo de cancelamento invalido");
      return;
    }
    const note = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.cancelInvoice(invoice.id, {
        reason,
        note: emptyToUndefined(note),
      });
      setMessage("Fatura cancelada");
      await loadInvoices();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Faturas</h2>
            <p className="text-xs text-slate-500">Financeiro</p>
          </div>
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void loadInvoices(search);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou CPF"
              type="search"
              value={search}
            />
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              type="submit"
            >
              Buscar
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              setPage(1);
            }}
            value={academicYearId}
          >
            <option value="">Ano</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setInstitutionId(event.target.value);
              setPage(1);
            }}
            value={institutionId}
          >
            <option value="">Instituicao</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setStatus(event.target.value as InvoiceStatus | "");
              setPage(1);
            }}
            value={status}
          >
            <option value="">Status</option>
            <option value="OPEN">Aberta</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setOverdue(event.target.value as "all" | "overdue" | "notOverdue");
              setPage(1);
            }}
            value={overdue}
          >
            <option value="all">Todas</option>
            <option value="overdue">Vencidas</option>
            <option value="notOverdue">Nao vencidas</option>
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setDueDateFrom(event.target.value);
              setPage(1);
            }}
            type="date"
            value={dueDateFrom}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setDueDateTo(event.target.value);
              setPage(1);
            }}
            type="date"
            value={dueDateTo}
          />
        </div>

        {message ? (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Academico</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Instituicao</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Descricao</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    Carregando...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    Nenhuma fatura encontrada
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {invoice.student.person.fullName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.student.person.cpfMasked}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.enrollment.academicYear.year}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.enrollment.institution.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.amountFormatted}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoiceStatusLabel(invoice)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.description ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                        disabled={saving || invoice.status !== "OPEN"}
                        onClick={() => void handleCancel(invoice)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Criar fatura
          </h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void searchStudents(studentSearch);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Buscar academico"
              type="search"
              value={studentSearch}
            />
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              type="submit"
            >
              Buscar
            </button>
          </form>
          <div className="mt-3 grid gap-2">
            {students.map((student) => (
              <button
                className="rounded border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
                key={student.id}
                onClick={() => void selectStudent(student.id)}
                type="button"
              >
                <span className="block font-medium text-slate-950">
                  {student.person.fullName}
                </span>
                <span className="text-xs text-slate-600">
                  {student.person.cpfMasked} -{" "}
                  {student.currentEnrollment?.academicYear.year ?? "sem matricula"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <form
          className="rounded border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={handleCreate}
        >
          <h2 className="text-base font-semibold text-slate-950">
            Confirmacao
          </h2>
          {selectedStudent ? (
            <div className="mt-3 grid gap-3 text-sm">
              <p className="font-medium text-slate-950">
                {selectedStudent.person.fullName}
              </p>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setInvoiceEnrollmentId(event.target.value);
                  setPreview(null);
                }}
                required
                value={invoiceEnrollmentId}
              >
                <option value="">Matricula</option>
                {selectedStudent.enrollments.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.id}>
                    {enrollment.academicYear.year} - {enrollment.institution.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Valor em reais"
                required
                value={amount}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setDueDate(event.target.value)}
                required
                type="date"
                value={dueDate}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                maxLength={300}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descricao opcional"
                value={description}
              />
              <div className="flex gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  onClick={() => void handlePreview()}
                  type="button"
                >
                  Preview
                </button>
                <button
                  className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  Criar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Selecione um academico para criar fatura.
            </p>
          )}

          {preview ? <InvoicePreviewBox preview={preview} /> : null}
        </form>
      </div>
    </div>
  );
}

export function StudentInvoicesForStudent({
  student,
  onChanged,
}: {
  student: StudentDetail;
  onChanged: () => Promise<void>;
}) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(student.enrollments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayDate());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadInvoices();
  }, [student.id]);

  async function loadInvoices() {
    setError("");
    try {
      const response = await api.listInvoicesForStudent(student.id);
      setInvoices(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar faturas");
    }
  }

  async function handlePreview() {
    if (!enrollmentId) {
      setError("Selecione uma matricula");
      return;
    }
    setError("");
    try {
      const response = await api.previewInvoice(student.id, { enrollmentId });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro no preview");
    }
  }

  async function handleCreate() {
    if (!enrollmentId) {
      setError("Selecione uma matricula");
      return;
    }
    let amountCents: number;
    try {
      amountCents = parseMoneyToCents(amount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Valor invalido");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.createInvoice(student.id, {
        enrollmentId,
        amountCents,
        dueDate,
        description: emptyToUndefined(description),
        idempotencyKey: createIdempotencyKey(),
      });
      setMessage("Fatura criada");
      setAmount("");
      setDescription("");
      setPreview(null);
      await loadInvoices();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao criar fatura");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(invoice: InvoiceRecord) {
    const reason = window.prompt(
      "Motivo: MANUAL_CORRECTION, DUPLICATE ou OTHER",
    ) as InvoiceCancellationReason | null;
    if (
      reason !== "MANUAL_CORRECTION" &&
      reason !== "DUPLICATE" &&
      reason !== "OTHER"
    ) {
      setError("Motivo de cancelamento invalido");
      return;
    }
    const note = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.cancelInvoice(invoice.id, {
        reason,
        note: emptyToUndefined(note),
      });
      setMessage("Fatura cancelada");
      await loadInvoices();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">Faturas</h3>
      <div className="mt-3 grid gap-2">
        {invoices.length === 0 ? (
          <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
            Nenhuma fatura criada
          </p>
        ) : (
          invoices.map((invoice) => (
            <div className="rounded border border-slate-200 p-3 text-sm" key={invoice.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-950">
                  {invoice.amountFormatted} - {formatDate(invoice.dueDate)}
                </p>
                <span className="text-xs text-slate-500">
                  {invoice.enrollment.academicYear.year}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {invoiceStatusLabel(invoice)}
                {invoice.description ? ` - ${invoice.description}` : ""}
              </p>
              {invoice.status === "OPEN" ? (
                <button
                  className="mt-2 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                  disabled={saving}
                  onClick={() => void handleCancel(invoice)}
                  type="button"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setEnrollmentId(event.target.value);
              setPreview(null);
            }}
            value={enrollmentId}
          >
            <option value="">Matricula</option>
            {student.enrollments.map((enrollment) => (
              <option key={enrollment.id} value={enrollment.id}>
                {enrollment.academicYear.year} - {enrollment.institution.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Valor"
            value={amount}
          />
        </div>
        <input
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          onChange={(event) => setDueDate(event.target.value)}
          type="date"
          value={dueDate}
        />
        <input
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          maxLength={300}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descricao opcional"
          value={description}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            onClick={() => void handlePreview()}
            type="button"
          >
            Preview
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
            disabled={saving}
            onClick={() => void handleCreate()}
            type="button"
          >
            Criar
          </button>
        </div>
        {preview ? <InvoicePreviewBox preview={preview} /> : null}
      </div>
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function InvoicePreviewBox({ preview }: { preview: InvoicePreview }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-medium text-slate-950">
        {preview.eligible ? "Elegivel para fatura" : "Bloqueado"}
      </p>
      {preview.blockingReason ? <p>Motivo: {preview.blockingReason}</p> : null}
      <p>Ano Letivo: {preview.enrollment.academicYear.year}</p>
      <p>Instituicao: {preview.enrollment.institution.name}</p>
      <p>
        Curso/serie/turno: {preview.enrollment.course} / {preview.enrollment.grade} /{" "}
        {preview.enrollment.shift.name}
      </p>
      <p>Diretoria ativa: {preview.student.activeBoardMembership ? "sim" : "nao"}</p>
    </div>
  );
}

function Pagination({
  page,
  setPage,
  totalPages,
}: {
  page: number;
  setPage: (updater: (current: number) => number) => void;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 text-sm text-slate-600">
      <button
        className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => setPage((current) => Math.max(current - 1, 1))}
        type="button"
      >
        Anterior
      </button>
      <span>
        {page}/{totalPages}
      </span>
      <button
        className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
        type="button"
      >
        Proxima
      </button>
    </div>
  );
}

function invoiceStatusLabel(invoice: InvoiceRecord) {
  if (invoice.status === "CANCELLED") {
    return "Cancelada";
  }
  return invoice.overdue ? "Aberta vencida" : "Aberta";
}

function parseMoneyToCents(input: string) {
  const normalized = input.trim().includes(",")
    ? input.trim().replace(/\./g, "").replace(",", ".")
    : input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe um valor monetario positivo");
  }
  const [reais = "0", cents = ""] = normalized.split(".");
  const amountCents =
    Number.parseInt(reais, 10) * 100 +
    Number.parseInt(cents.padEnd(2, "0") || "0", 10);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Informe um valor maior que zero");
  }
  if (amountCents > 999_999_999) {
    throw new Error("Valor excede o limite tecnico");
  }
  return amountCents;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `invoice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function emptyToUndefined(value?: string) {
  return value && value.length > 0 ? value : undefined;
}
