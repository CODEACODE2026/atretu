"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  api,
  type AcademicYear,
  type StudentCardInvalidationReason,
  type StudentCardPreview,
  type StudentCardRecord,
  type StudentCardStatus,
  type StudentCardType,
  type StudentDetail,
  type StudentSummary,
} from "../../lib/api";
import { mapApiErrorMessage, promptOption } from "../../lib/formatters";

export function StudentCardsPanel() {
  const [cards, setCards] = useState<StudentCardRecord[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [preview, setPreview] = useState<StudentCardPreview | null>(null);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [cardType, setCardType] = useState<StudentCardType | "">("");
  const [status, setStatus] = useState<StudentCardStatus | "">("");
  const [validity, setValidity] = useState<"all" | "usable" | "notUsable">("all");
  const [issueEnrollmentId, setIssueEnrollmentId] = useState("");
  const [issueCardType, setIssueCardType] = useState<StudentCardType>("STUDENT");
  const [note, setNote] = useState("");
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
    void loadCards();
  }, [page, academicYearId, cardType, status, validity]);

  async function loadReferences() {
    try {
      const response = await api.listAcademicYears({ status: "all" });
      setYears(response.data);
      const current = response.data.find((year) => year.isCurrent);
      setAcademicYearId(current?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar referencias",
      );
    }
  }

  async function loadCards(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const response = await api.listStudentCards({
        page,
        limit: 10,
        search: nextSearch,
        academicYearId,
        cardType: cardType || undefined,
        status: status || undefined,
        validity,
      });
      setCards(response.data);
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
      const defaultEnrollment = detail.enrollments[0];
      setIssueEnrollmentId(defaultEnrollment?.id ?? "");
      setIssueCardType(detail.activeBoardMembership ? "BOARD_MEMBER" : "STUDENT");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir academico");
    }
  }

  async function handlePreview() {
    if (!selectedStudent || !issueEnrollmentId) {
      setError("Selecione academico e matricula");
      return;
    }
    setError("");
    try {
      const response = await api.previewStudentCard(selectedStudent.id, {
        enrollmentId: issueEnrollmentId,
        cardType: issueCardType,
      });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro no preview");
    }
  }

  async function handleIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent || !issueEnrollmentId) {
      setError("Selecione academico e matricula");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.issueStudentCard(selectedStudent.id, {
        enrollmentId: issueEnrollmentId,
        cardType: issueCardType,
        note: emptyToUndefined(note),
      });
      setMessage("Carteirinha emitida");
      setNote("");
      setPreview(null);
      await loadCards();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao emitir");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvalidate(card: StudentCardRecord) {
    const reason = promptOption<StudentCardInvalidationReason>(
      "Selecione o motivo da invalidacao da carteirinha:",
      [
        { label: "Correcao administrativa", value: "MANUAL_CORRECTION" },
        { label: "Outro motivo", value: "OTHER" },
        { label: "Fim de participacao na diretoria", value: "BOARD_MEMBERSHIP_ENDED" },
        { label: "Academico desligado", value: "STUDENT_TERMINATED" },
      ],
    );
    if (!reason) {
      setError("Selecione um motivo valido para invalidar a carteirinha.");
      return;
    }
    const invalidationNote = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.invalidateStudentCard(card.student.id, card.id, {
        reason,
        note: emptyToUndefined(invalidationNote),
      });
      setMessage("Carteirinha invalidada");
      await loadCards();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao invalidar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void loadCards(search);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, CPF ou numero"
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
          <div className="flex flex-wrap gap-2">
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
                setCardType(event.target.value as StudentCardType | "");
                setPage(1);
              }}
              value={cardType}
            >
              <option value="">Tipo</option>
              <option value="STUDENT">Academico</option>
              <option value="BOARD_MEMBER">Diretoria</option>
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setStatus(event.target.value as StudentCardStatus | "");
                setPage(1);
              }}
              value={status}
            >
              <option value="">Status</option>
              <option value="ACTIVE">Ativa</option>
              <option value="INVALIDATED">Invalidada</option>
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setValidity(event.target.value as "all" | "usable" | "notUsable");
                setPage(1);
              }}
              value={validity}
            >
              <option value="all">Todas</option>
              <option value="usable">Utilizaveis</option>
              <option value="notUsable">Nao utilizaveis</option>
            </select>
          </div>
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
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Numero</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Academico</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Emissao</th>
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
              ) : cards.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    Nenhuma carteirinha encontrada
                  </td>
                </tr>
              ) : (
                cards.map((card) => (
                  <tr key={card.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {card.cardNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cardTypeLabel(card.cardType)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {card.student.person.fullName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {card.student.person.cpfMasked}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {card.academicYear.year}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {card.status === "ACTIVE" ? "Ativa" : "Invalidada"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {card.validity.usable
                        ? "Utilizavel"
                        : validityReasonLabel(card.validity.reason)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(card.issuedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                        disabled={saving || card.status !== "ACTIVE"}
                        onClick={() => void handleInvalidate(card)}
                        type="button"
                      >
                        Invalidar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Emitir carteirinha
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
          onSubmit={handleIssue}
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
                  setIssueEnrollmentId(event.target.value);
                  setPreview(null);
                }}
                required
                value={issueEnrollmentId}
              >
                <option value="">Matricula</option>
                {selectedStudent.enrollments.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.id}>
                    {enrollment.academicYear.year} - {enrollment.institution.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setIssueCardType(event.target.value as StudentCardType);
                  setPreview(null);
                }}
                value={issueCardType}
              >
                <option value="STUDENT">Academico</option>
                <option value="BOARD_MEMBER">Diretoria</option>
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Observacao opcional"
                value={note}
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
                  Emitir
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Selecione um academico para emitir.
            </p>
          )}

          {preview ? <StudentCardPreviewBox preview={preview} /> : null}
        </form>
      </div>
    </div>
  );
}

export function StudentCardsForStudent({
  student,
  onChanged,
}: {
  student: StudentDetail;
  onChanged: () => Promise<void>;
}) {
  const [cards, setCards] = useState<StudentCardRecord[]>([]);
  const [preview, setPreview] = useState<StudentCardPreview | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(student.enrollments[0]?.id ?? "");
  const [cardType, setCardType] = useState<StudentCardType>(
    student.activeBoardMembership ? "BOARD_MEMBER" : "STUDENT",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCards();
  }, [student.id]);

  async function loadCards() {
    setError("");
    try {
      const response = await api.listStudentCardsForStudent(student.id);
      setCards(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar carteirinhas",
      );
    }
  }

  async function handlePreview() {
    if (!enrollmentId) {
      setError("Selecione uma matricula");
      return;
    }
    setError("");
    try {
      const response = await api.previewStudentCard(student.id, {
        enrollmentId,
        cardType,
      });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro no preview");
    }
  }

  async function handleIssue() {
    if (!enrollmentId) {
      setError("Selecione uma matricula");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.issueStudentCard(student.id, {
        enrollmentId,
        cardType,
        note: emptyToUndefined(note),
      });
      setMessage("Carteirinha emitida");
      setNote("");
      setPreview(null);
      await loadCards();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao emitir");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvalidate(card: StudentCardRecord) {
    const reason = promptOption<StudentCardInvalidationReason>(
      "Selecione o motivo da invalidacao da carteirinha:",
      [
        { label: "Correcao administrativa", value: "MANUAL_CORRECTION" },
        { label: "Outro motivo", value: "OTHER" },
        { label: "Fim de participacao na diretoria", value: "BOARD_MEMBERSHIP_ENDED" },
        { label: "Academico desligado", value: "STUDENT_TERMINATED" },
      ],
    );
    if (!reason) {
      setError("Selecione um motivo valido para invalidar a carteirinha.");
      return;
    }
    const invalidationNote = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.invalidateStudentCard(student.id, card.id, {
        reason,
        note: emptyToUndefined(invalidationNote),
      });
      setMessage("Carteirinha invalidada");
      await loadCards();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao invalidar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">Carteirinhas</h3>
      <div className="mt-3 grid gap-2">
        {cards.length === 0 ? (
          <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
            Nenhuma carteirinha emitida
          </p>
        ) : (
          cards.map((card) => (
            <div className="rounded border border-slate-200 p-3 text-sm" key={card.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-950">
                  {card.cardNumber} - {cardTypeLabel(card.cardType)}
                </p>
                <span className="text-xs text-slate-500">
                  {card.academicYear.year}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {card.status === "ACTIVE" ? "Ativa" : "Invalidada"} -{" "}
                {card.validity.usable
                  ? "utilizavel"
                  : validityReasonLabel(card.validity.reason)}
              </p>
              {card.status === "ACTIVE" ? (
                <button
                  className="mt-2 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                  disabled={saving}
                  onClick={() => void handleInvalidate(card)}
                  type="button"
                >
                  Invalidar
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
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setCardType(event.target.value as StudentCardType);
              setPreview(null);
            }}
            value={cardType}
          >
            <option value="STUDENT">Academico</option>
            <option value="BOARD_MEMBER">Diretoria</option>
          </select>
        </div>
        <input
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observacao opcional"
          value={note}
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
            onClick={() => void handleIssue()}
            type="button"
          >
            Emitir
          </button>
        </div>
        {preview ? <StudentCardPreviewBox preview={preview} /> : null}
      </div>
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function StudentCardPreviewBox({ preview }: { preview: StudentCardPreview }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-medium text-slate-950">
        {preview.eligible ? "Elegivel para emissao" : "Bloqueado"}
      </p>
      {preview.blockingReason ? (
        <p>Motivo: {mapApiErrorMessage(preview.blockingReason)}</p>
      ) : null}
      <p>Ano Letivo: {preview.academicYear.year}</p>
      <p>Instituicao: {preview.enrollment.institution.name}</p>
      <p>
        Curso/serie/turno: {preview.enrollment.course} / {preview.enrollment.grade} /{" "}
        {preview.enrollment.shift.name}
      </p>
      <p>Diretoria ativa: {preview.activeBoardMembership ? "sim" : "nao"}</p>
      <p>Tipo: {cardTypeLabel(preview.cardType)}</p>
      <p>
        Carteirinha anterior:{" "}
        {preview.previousCard
          ? `${preview.previousCard.cardNumber} (${cardTypeLabel(
              preview.previousCard.cardType,
            )})`
          : "nenhuma"}
      </p>
    </div>
  );
}

function cardTypeLabel(type: StudentCardType) {
  return type === "BOARD_MEMBER" ? "Diretoria" : "Academico";
}

function validityReasonLabel(reason?: string | null) {
  const labels: Record<string, string> = {
    CARD_INVALIDATED: "invalidada",
    STUDENT_SUSPENDED: "academico suspenso",
    STUDENT_TERMINATED: "academico desligado",
    BOARD_MEMBERSHIP_ENDED: "diretoria encerrada",
    BOARD_MEMBERSHIP_ACTIVE_REQUIRES_BOARD_CARD: "diretoria ativa",
  };
  return reason ? labels[reason] ?? reason : "nao utilizavel";
}

function emptyToUndefined(value?: string) {
  return value && value.length > 0 ? value : undefined;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
