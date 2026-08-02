"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type StudentCardPdfDisposition,
  type StudentCardInvalidationReason,
  type StudentCardPreview,
  type StudentCardRecord,
  type StudentCardStatus,
  type StudentCardType,
  type StudentDetail,
  type StudentSummary,
} from "../../lib/api";
import { mapApiErrorMessage, promptOption } from "../../lib/formatters";
import { adminTheme, cx } from "./admin-theme";
import {
  StudentActiveCard,
  StudentCardCurrentSummary,
  StudentCardHistory,
  StudentCardNoActiveState,
} from "./students/cards/student-card-profile-sections";
import { selectCurrentStudentCard } from "./students/cards/student-card-display-utils";

type PdfAction = "view" | "download" | "print";

export function StudentCardsPanel({ user }: { user: ApiUser }) {
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
  const [pdfBusyId, setPdfBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseAdministrativeIssue = user.roles.includes("SUPER_ADMIN");
  const canShowAdministrativeIssue = canUseAdministrativeIssue && cards.length === 0;

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
        caught instanceof Error ? caught.message : "Erro ao carregar referências",
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
      setError(caught instanceof Error ? caught.message : "Erro ao buscar acadêmico");
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
      setError(caught instanceof Error ? caught.message : "Erro ao abrir acadêmico");
    }
  }

  async function handlePreview() {
    if (!selectedStudent || !issueEnrollmentId) {
      setError("Selecione acadêmico e matrícula");
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
      setError(caught instanceof Error ? caught.message : "Erro ao visualizar prévia");
    }
  }

  async function handleIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent || !issueEnrollmentId) {
      setError("Selecione acadêmico e matrícula");
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
      "Selecione o motivo da invalidação da carteirinha:",
      [
        { label: "Correção administrativa", value: "MANUAL_CORRECTION" },
        { label: "Outro motivo", value: "OTHER" },
        { label: "Fim de participação na diretoria", value: "BOARD_MEMBERSHIP_ENDED" },
        { label: "Acadêmico desligado", value: "STUDENT_TERMINATED" },
      ],
    );
    if (!reason) {
      setError("Selecione um motivo válido para invalidar a carteirinha.");
      return;
    }
    const invalidationNote = window.prompt("Observação opcional") ?? undefined;
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

  async function handlePdf(card: StudentCardRecord, action: PdfAction) {
    setMessage("");
    setError("");
    setPdfBusyId(`${card.id}:${action}`);
    try {
      await openStudentCardPdf(card, action);
    } catch (caught) {
      setError(pdfErrorMessage(caught));
    } finally {
      setPdfBusyId("");
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <form
            className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void loadCards(search);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, CPF ou número"
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
          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <select
              className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
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
              className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setCardType(event.target.value as StudentCardType | "");
                setPage(1);
              }}
              value={cardType}
            >
              <option value="">Tipo</option>
              <option value="STUDENT">Acadêmico</option>
              <option value="BOARD_MEMBER">Diretoria</option>
            </select>
            <select
              className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setStatus(event.target.value as StudentCardStatus | "");
                setPage(1);
              }}
              value={status}
            >
              <option value="">Situação</option>
              <option value="ACTIVE">Ativa</option>
              <option value="INVALIDATED">Invalidada</option>
            </select>
            <select
              className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setValidity(event.target.value as "all" | "usable" | "notUsable");
                setPage(1);
              }}
              value={validity}
            >
              <option value="all">Todas</option>
              <option value="usable">Utilizáveis</option>
              <option value="notUsable">Não utilizáveis</option>
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

        <div className="mt-4 hidden max-w-full overflow-x-auto lg:block">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Acadêmico</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Ações</th>
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
                        ? "Utilizável"
                        : validityReasonLabel(card.validity.reason)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(card.issuedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                          disabled={Boolean(pdfBusyId)}
                          onClick={() => void handlePdf(card, "view")}
                          type="button"
                        >
                          {pdfBusyId === `${card.id}:view`
                            ? "Abrindo..."
                            : card.status === "INVALIDATED"
                              ? "Visualizar histórico"
                              : "Visualizar"}
                        </button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                          disabled={Boolean(pdfBusyId)}
                          onClick={() => void handlePdf(card, "download")}
                          type="button"
                        >
                          {pdfBusyId === `${card.id}:download`
                            ? "Baixando..."
                            : "Baixar PDF"}
                        </button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                          disabled={Boolean(pdfBusyId) || card.status !== "ACTIVE"}
                          onClick={() => void handlePdf(card, "print")}
                          type="button"
                          title={
                            card.status === "ACTIVE"
                              ? undefined
                              : "Carteirinha invalidada"
                          }
                        >
                          {pdfBusyId === `${card.id}:print`
                            ? "Abrindo..."
                            : "Imprimir"}
                        </button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                          disabled={saving || card.status !== "ACTIVE"}
                          onClick={() => void handleInvalidate(card)}
                          type="button"
                        >
                          Invalidar
                        </button>
                      </div>
                      {card.status === "INVALIDATED" ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Carteirinha invalidada.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 lg:hidden">
          {loading ? (
            <p className="rounded border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Carregando...
            </p>
          ) : cards.length === 0 ? (
            <p className="rounded border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Nenhuma carteirinha encontrada
            </p>
          ) : (
            cards.map((card) => (
              <article
                className="grid min-w-0 gap-3 rounded border border-slate-200 bg-white p-3 text-sm"
                key={card.id}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-950">
                      {card.cardNumber}
                    </p>
                    <p className="mt-1 break-words text-slate-700">
                      {card.student.person.fullName}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {card.student.person.cpfMasked} • {card.academicYear.year}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {card.status === "ACTIVE" ? "Ativa" : "Invalidada"}
                  </span>
                </div>
                <div className="grid gap-1 text-xs text-slate-600">
                  <span>Tipo: {cardTypeLabel(card.cardType)}</span>
                  <span>
                    Validade:{" "}
                    {card.validity.usable
                      ? "Utilizável"
                      : validityReasonLabel(card.validity.reason)}
                  </span>
                  <span>Emissão: {formatDateTime(card.issuedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                    disabled={Boolean(pdfBusyId)}
                    onClick={() => void handlePdf(card, "view")}
                    type="button"
                  >
                    {pdfBusyId === `${card.id}:view`
                      ? "Abrindo..."
                      : card.status === "INVALIDATED"
                        ? "Visualizar histórico"
                        : "Visualizar"}
                  </button>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                    disabled={Boolean(pdfBusyId)}
                    onClick={() => void handlePdf(card, "download")}
                    type="button"
                  >
                    {pdfBusyId === `${card.id}:download` ? "Baixando..." : "Baixar PDF"}
                  </button>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                    disabled={Boolean(pdfBusyId) || card.status !== "ACTIVE"}
                    onClick={() => void handlePdf(card, "print")}
                    type="button"
                    title={card.status === "ACTIVE" ? undefined : "Carteirinha invalidada"}
                  >
                    {pdfBusyId === `${card.id}:print` ? "Abrindo..." : "Imprimir"}
                  </button>
                  <button
                    className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                    disabled={saving || card.status !== "ACTIVE"}
                    onClick={() => void handleInvalidate(card)}
                    type="button"
                  >
                    Invalidar
                  </button>
                </div>
              </article>
            ))
          )}
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
            Próxima
          </button>
        </div>
      </div>

      {canUseAdministrativeIssue ? (
      <details className="rounded border border-amber-200 bg-amber-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-amber-950">
          Emissão administrativa excepcional
        </summary>
        <p className="mt-2 text-xs text-amber-800">
          Use somente para correção administrativa. O fluxo normal gera a
          carteirinha automaticamente no cadastro ou aprovação do acadêmico.
        </p>
        <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Localizar acadêmico
          </h2>
          <form
            className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void searchStudents(studentSearch);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Buscar acadêmico"
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
                  {student.currentEnrollment?.academicYear.year ?? "sem matrícula"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <form
          className="min-w-0 rounded border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={handleIssue}
        >
          <h2 className="text-base font-semibold text-slate-950">
            Confirmação administrativa
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
                <option value="">Matrícula</option>
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
                <option value="STUDENT">Acadêmico</option>
                <option value="BOARD_MEMBER">Diretoria</option>
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Observação opcional"
                value={note}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  onClick={() => void handlePreview()}
                  type="button"
                >
                  Visualizar prévia administrativa
                </button>
                <button
                  className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  Emitir excepcional
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Selecione um acadêmico para a correção administrativa.
            </p>
          )}

          {preview ? <StudentCardPreviewBox preview={preview} /> : null}
        </form>
      </div>
      </details>
      ) : null}
    </div>
  );
}

export function StudentCardsForStudent({
  activeCard,
  disableInvalidation = false,
  student,
  user,
  onChanged,
}: {
  activeCard?: StudentCardRecord | null;
  disableInvalidation?: boolean;
  student: StudentDetail;
  user: ApiUser;
  onChanged: () => Promise<void>;
}) {
  const [cards, setCards] = useState<StudentCardRecord[]>([]);
  const [preview, setPreview] = useState<StudentCardPreview | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(student.enrollments[0]?.id ?? "");
  const [cardType, setCardType] = useState<StudentCardType>(
    student.activeBoardMembership ? "BOARD_MEMBER" : "STUDENT",
  );
  const [note, setNote] = useState("");
  const [loadingCards, setLoadingCards] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseAdministrativeIssue = user.roles.includes("SUPER_ADMIN");
  const canShowAdministrativeIssue = canUseAdministrativeIssue && cards.length === 0;

  useEffect(() => {
    void loadCards();
  }, [student.id]);

  async function loadCards() {
    setError("");
    setLoadingCards(true);
    try {
      const response = await api.listStudentCardsForStudent(student.id);
      setCards(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar carteirinhas",
      );
    } finally {
      setLoadingCards(false);
    }
  }

  async function handlePreview() {
    if (!enrollmentId) {
      setError("Selecione uma matrícula");
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
      setError(caught instanceof Error ? caught.message : "Erro ao visualizar prévia");
    }
  }

  async function handleIssue() {
    if (!enrollmentId) {
      setError("Selecione uma matrícula");
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
      "Selecione o motivo da invalidação da carteirinha:",
      [
        { label: "Correção administrativa", value: "MANUAL_CORRECTION" },
        { label: "Outro motivo", value: "OTHER" },
        { label: "Fim de participação na diretoria", value: "BOARD_MEMBERSHIP_ENDED" },
        { label: "Acadêmico desligado", value: "STUDENT_TERMINATED" },
      ],
    );
    if (!reason) {
      setError("Selecione um motivo válido para invalidar a carteirinha.");
      return;
    }
    const invalidationNote = window.prompt("Observação opcional") ?? undefined;
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

  async function handlePdf(card: StudentCardRecord, action: PdfAction) {
    setMessage("");
    setError("");
    setPdfBusyId(`${card.id}:${action}`);
    try {
      await openStudentCardPdf(card, action);
    } catch (caught) {
      setError(pdfErrorMessage(caught));
    } finally {
      setPdfBusyId("");
    }
  }

  const currentCard = activeCard ?? selectCurrentStudentCard(student, cards);
  const historyCards = cards.filter((card) => card.id !== currentCard?.id);

  return (
    <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Carteirinhas</h3>
          <p className="mt-1 text-xs text-slate-500">
            Carteirinha ativa, PDF e histórico do acadêmico.
          </p>
        </div>
        {loadingCards ? (
          <span className="text-xs font-medium text-slate-500">
            Carregando carteirinhas...
          </span>
        ) : null}
      </div>

      <StudentCardCurrentSummary
        activeCard={currentCard}
        student={student}
        totalCards={cards.length}
      />

      <p className={cx(adminTheme.softPanel, "px-3 py-2 text-xs text-slate-600")}>
        Foto opcional: quando a foto estiver indisponível, o PDF usa uma imagem padrão.
      </p>

      {loadingCards && cards.length === 0 ? (
        <div className={cx(adminTheme.softPanel, "p-4 text-sm text-slate-600")}>
          Carregando carteirinhas do acadêmico...
        </div>
      ) : currentCard ? (
        <StudentActiveCard
          busyAction={pdfBusyId}
          card={currentCard}
          onPdf={(card, action) => void handlePdf(card, action)}
        />
      ) : (
        <StudentCardNoActiveState totalCards={cards.length} />
      )}

      <StudentCardHistory
        busyAction={pdfBusyId}
        cards={historyCards}
        onPdf={(card, action) => void handlePdf(card, action)}
      />

      {canShowAdministrativeIssue ? (
      <details className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-amber-950">
          Correção administrativa
        </summary>
        <p className="mt-2 text-xs text-amber-800">
          Use somente quando for necessário corrigir uma carteirinha fora do
          fluxo automático.
        </p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className={adminTheme.control}
            onChange={(event) => {
              setEnrollmentId(event.target.value);
              setPreview(null);
            }}
            value={enrollmentId}
          >
            <option value="">Matrícula</option>
            {student.enrollments.map((enrollment) => (
              <option key={enrollment.id} value={enrollment.id}>
                {enrollment.academicYear.year} - {enrollment.institution.name}
              </option>
            ))}
          </select>
          <select
            className={adminTheme.control}
            onChange={(event) => {
              setCardType(event.target.value as StudentCardType);
              setPreview(null);
            }}
            value={cardType}
          >
            <option value="STUDENT">Acadêmico</option>
            <option value="BOARD_MEMBER">Diretoria</option>
          </select>
        </div>
        <input
          className={cx(adminTheme.control, "mt-2 w-full")}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observação opcional"
          value={note}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className={adminTheme.secondaryButton}
            onClick={() => void handlePreview()}
            type="button"
          >
            Visualizar prévia administrativa
          </button>
          <button
            className={adminTheme.primaryButton}
            disabled={saving}
            onClick={() => void handleIssue()}
            type="button"
          >
            Emitir excepcional
          </button>
        </div>
        {preview ? <StudentCardPreviewBox preview={preview} /> : null}
      </div>
      </details>
      ) : null}
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function StudentCardPreviewBox({ preview }: { preview: StudentCardPreview }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-medium text-slate-950">
        {preview.eligible ? "Elegível para emissão" : "Bloqueado"}
      </p>
      {preview.blockingReason ? (
        <p>Motivo: {mapApiErrorMessage(preview.blockingReason)}</p>
      ) : null}
      <p>Ano letivo: {preview.academicYear.year}</p>
      <p>Instituição: {preview.enrollment.institution.name}</p>
      <p>
        Curso/série/turno: {preview.enrollment.course} / {preview.enrollment.grade} /{" "}
        {preview.enrollment.shift.name}
      </p>
      <p>Diretoria ativa: {preview.activeBoardMembership ? "sim" : "não"}</p>
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
  return type === "BOARD_MEMBER" ? "Diretoria" : "Acadêmico";
}

function validityReasonLabel(reason?: string | null) {
  const labels: Record<string, string> = {
    CARD_INVALIDATED: "Invalidada",
    STUDENT_SUSPENDED: "Acadêmico suspenso",
    STUDENT_TERMINATED: "Acadêmico desligado",
    BOARD_MEMBERSHIP_ENDED: "Diretoria encerrada",
    BOARD_MEMBERSHIP_ACTIVE_REQUIRES_BOARD_CARD: "Substituída por carteirinha de diretoria",
  };
  return reason ? labels[reason] ?? "Não utilizável" : "Não utilizável";
}

async function openStudentCardPdf(card: StudentCardRecord, action: PdfAction) {
  const disposition: StudentCardPdfDisposition =
    action === "download" ? "attachment" : "inline";
  const popup =
    action === "view" || action === "print" ? window.open("", "_blank") : null;
  if ((action === "view" || action === "print") && !popup) {
    throw new Error("O navegador bloqueou a nova aba do PDF.");
  }

  try {
    const { blob, fileName } = await api.downloadStudentCardPdf(card.id, disposition);
    const url = URL.createObjectURL(blob);
    if (action === "download") {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || `carteirinha_${card.cardNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    if (!popup) {
      URL.revokeObjectURL(url);
      throw new Error("O navegador bloqueou a nova aba do PDF.");
    }
    popup.location.href = url;
    if (action === "print") {
      window.setTimeout(() => {
        try {
          popup.focus();
          popup.print();
        } catch {
          // O navegador pode bloquear impressão automática em PDFs.
        }
      }, 1200);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (caught) {
    if (popup && !popup.closed) {
      popup.close();
    }
    throw caught;
  }
}

function pdfErrorMessage(caught: unknown) {
  if (!(caught instanceof Error)) {
    return "Erro ao abrir PDF da carteirinha.";
  }
  const message = mapApiErrorMessage(caught.message);
  if (message.includes("foto oficial")) {
    return "Não foi possível usar a foto oficial. A carteirinha também pode ser gerada sem foto; tente novamente ou remova a foto inválida.";
  }
  if (message.includes("Não foi possível concluir a operação")) {
    return "Não foi possível gerar o PDF da carteirinha. Confira se a foto oficial é um JPG ou PNG válido e tente novamente.";
  }
  return message;
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
