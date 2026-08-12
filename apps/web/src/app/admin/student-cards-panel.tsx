"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  IdCard,
  ImageOff,
  MoreHorizontal,
  Printer,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BaseRecord,
  type StudentCardPdfDisposition,
  type StudentCardInvalidationReason,
  type StudentCardPreview,
  type StudentCardRecord,
  type StudentCardStatus,
  type StudentCardType,
  type StudentDetail,
  type StudentSummary,
} from "../../lib/api";
import { mapApiErrorMessage } from "../../lib/formatters";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
  AdminSummaryCard,
} from "./components/admin-ui";
import {
  StudentActiveCard,
  StudentCardCurrentSummary,
  StudentCardHistory,
  StudentCardNoActiveState,
} from "./students/cards/student-card-profile-sections";
import {
  expectedStudentCardType,
  selectCurrentStudentCard,
  selectPendingStudentCardRequirement,
} from "./students/cards/student-card-display-utils";

type PdfAction = "view" | "download" | "print";
type PendingInvalidation = {
  card: StudentCardRecord;
} | null;

export function StudentCardsPanel({ user }: { user: ApiUser }) {
  const [cards, setCards] = useState<StudentCardRecord[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [shifts, setShifts] = useState<BaseRecord[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(
    null,
  );
  const [preview, setPreview] = useState<StudentCardPreview | null>(null);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [cardType, setCardType] = useState<StudentCardType | "">("");
  const [status, setStatus] = useState<StudentCardStatus | "">("");
  const [validity, setValidity] = useState<"all" | "usable" | "notUsable">(
    "all",
  );
  const [issueEnrollmentId, setIssueEnrollmentId] = useState("");
  const [issueCardType, setIssueCardType] =
    useState<StudentCardType>("STUDENT");
  const [note, setNote] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState("");
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchYearId, setBatchYearId] = useState("");
  const [batchCardType, setBatchCardType] = useState<"ALL" | StudentCardType>(
    "ALL",
  );
  const [batchInstitutionId, setBatchInstitutionId] = useState("");
  const [batchShiftId, setBatchShiftId] = useState("");
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [openActionsCardId, setOpenActionsCardId] = useState("");
  const [pendingInvalidation, setPendingInvalidation] =
    useState<PendingInvalidation>(null);
  const [invalidationReason, setInvalidationReason] =
    useState<StudentCardInvalidationReason>("MANUAL_CORRECTION");
  const [invalidationNote, setInvalidationNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseAdministrativeIssue = user.roles.includes("SUPER_ADMIN");
  const canShowAdministrativeIssue =
    canUseAdministrativeIssue && cards.length === 0;

  const summary = useMemo(
    () => ({
      active: cards.filter((card) => card.status === "ACTIVE").length,
      invalidated: cards.filter((card) => card.status === "INVALIDATED").length,
      noPhoto: cards.filter((card) =>
        card.validity.reason?.toLowerCase().includes("foto"),
      ).length,
      notUsable: cards.filter((card) => !card.validity.usable).length,
    }),
    [cards],
  );

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadCards();
  }, [page, academicYearId, cardType, status, validity]);

  useEffect(() => {
    if (batchDialogOpen) {
      void loadBatchCount();
    }
  }, [
    batchDialogOpen,
    batchYearId,
    batchCardType,
    batchInstitutionId,
    batchShiftId,
  ]);

  useEffect(() => {
    if (!openActionsCardId) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-card-actions-menu]") ||
        target?.closest("[data-card-actions-trigger]")
      ) {
        return;
      }
      setOpenActionsCardId("");
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenActionsCardId("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionsCardId]);

  async function loadReferences() {
    try {
      const [yearResponse, institutionResponse, shiftResponse] =
        await Promise.all([
          api.listAcademicYears({ status: "all" }),
          api.listInstitutions({ limit: 100, status: "active" }),
          api.listShifts({ limit: 100, status: "active" }),
        ]);
      setYears(yearResponse.data);
      setInstitutions(institutionResponse.data);
      setShifts(shiftResponse.data);
      const current = yearResponse.data.find((year) => year.isCurrent);
      setAcademicYearId(current?.id ?? "");
      setBatchYearId(current?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao carregar referências",
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
      setError(
        caught instanceof Error ? caught.message : "Erro ao buscar acadêmico",
      );
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
      setIssueCardType(
        detail.activeBoardMembership ? "BOARD_MEMBER" : "STUDENT",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao abrir acadêmico",
      );
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
      setError(
        caught instanceof Error ? caught.message : "Erro ao visualizar prévia",
      );
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

  function requestInvalidation(card: StudentCardRecord) {
    setOpenActionsCardId("");
    setPendingInvalidation({ card });
    setInvalidationReason("MANUAL_CORRECTION");
    setInvalidationNote("");
    setMessage("");
    setError("");
  }

  async function confirmInvalidation() {
    if (!pendingInvalidation) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.invalidateStudentCard(
        pendingInvalidation.card.student.id,
        pendingInvalidation.card.id,
        {
          reason: invalidationReason,
          note: emptyToUndefined(invalidationNote),
        },
      );
      setPendingInvalidation(null);
      setMessage("Carteirinha invalidada");
      await loadCards();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao invalidar");
    } finally {
      setSaving(false);
    }
  }

  async function handlePdf(card: StudentCardRecord, action: PdfAction) {
    setOpenActionsCardId("");
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

  async function loadBatchCount() {
    if (!batchYearId) {
      setBatchTotal(0);
      return;
    }
    setBatchLoading(true);
    setError("");
    try {
      const response = await api.listStudentCards({
        page: 1,
        limit: 1,
        academicYearId: batchYearId,
        cardType: batchCardType === "ALL" ? undefined : batchCardType,
        institutionId: emptyToUndefined(batchInstitutionId),
        shiftId: emptyToUndefined(batchShiftId),
        status: "ACTIVE",
        validity: "usable",
        sort: "cardNumber",
        order: "asc",
      });
      setBatchTotal(response.pagination.total);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao calcular lote",
      );
      setBatchTotal(0);
    } finally {
      setBatchLoading(false);
    }
  }

  function openBatchDialog() {
    setBatchDialogOpen(true);
    setMessage("");
    setError("");
    setBatchYearId(
      academicYearId || years.find((year) => year.isCurrent)?.id || "",
    );
    setBatchCardType(cardType || "ALL");
    setBatchInstitutionId("");
    setBatchShiftId("");
  }

  async function generateBatchPdf() {
    if (!batchYearId) {
      setError("Selecione o ano letivo para imprimir.");
      return;
    }
    if (batchTotal === 0) {
      setError(
        "Nenhuma carteirinha emitida encontrada para os filtros selecionados.",
      );
      return;
    }
    setBatchGenerating(true);
    setMessage("");
    setError("");
    try {
      const { blob, fileName } = await api.downloadStudentCardsBatchPdf({
        academicYearId: batchYearId,
        cardType: batchCardType,
        institutionId: emptyToUndefined(batchInstitutionId),
        shiftId: emptyToUndefined(batchShiftId),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "carteirinhas_lote.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBatchDialogOpen(false);
      setMessage("PDF de impressão em lote gerado.");
    } catch (caught) {
      setError(pdfErrorMessage(caught));
    } finally {
      setBatchGenerating(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <AdminModuleHeader
        description="Acompanhe carteirinhas emitidas, validade operacional, histórico e PDF sem alterar os contratos de emissão já homologados."
        eyebrow="Identificação acadêmica"
        icon={IdCard}
        title="Carteirinhas"
      />

      <div className="grid min-w-0 gap-3 md:grid-cols-4">
        <AdminSummaryCard
          description="Aptas para visualização e uso operacional."
          icon={IdCard}
          label="Ativas"
          tone="green"
          value={summary.active}
        />
        <AdminSummaryCard
          description="Mantidas no histórico do acadêmico."
          icon={XCircle}
          label="Inválidas"
          tone="red"
          value={summary.invalidated}
        />
        <AdminSummaryCard
          description="PDF usa imagem padrão quando permitido."
          icon={ImageOff}
          label="Sem foto"
          tone="orange"
          value={summary.noPhoto}
        />
        <AdminSummaryCard
          description="Sem emissão válida no filtro atual."
          icon={ShieldAlert}
          label="Pendentes"
          tone="blue"
          value={summary.notUsable}
        />
      </div>

      <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
        <AdminSectionHeader
          description="Filtros rápidos por ano, tipo, situação e validade."
          title="Carteirinhas emitidas"
        />
        <div className="border-b border-slate-200/80 p-4">
          <form
            className="grid min-w-0 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1.2fr)_auto_minmax(96px,0.5fr)_minmax(116px,0.6fr)] xl:grid-cols-[minmax(260px,1.4fr)_auto_minmax(96px,0.55fr)_minmax(116px,0.65fr)_minmax(118px,0.65fr)_minmax(132px,0.75fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void loadCards(search);
            }}
          >
            <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Busca
              <input
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, CPF ou número"
                type="search"
                value={search}
              />
            </label>
            <button
              className={cx(adminTheme.primaryButton, "h-10 w-full xl:w-auto")}
              type="submit"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Buscar
            </button>
            <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ano
              <select
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => {
                  setAcademicYearId(event.target.value);
                  setPage(1);
                }}
                value={academicYearId}
              >
                <option value="">Todos</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo
              <select
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => {
                  setCardType(event.target.value as StudentCardType | "");
                  setPage(1);
                }}
                value={cardType}
              >
                <option value="">Todos</option>
                <option value="STUDENT">Acadêmico</option>
                <option value="BOARD_MEMBER">Diretoria</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Situação
              <select
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => {
                  setStatus(event.target.value as StudentCardStatus | "");
                  setPage(1);
                }}
                value={status}
              >
                <option value="">Todas</option>
                <option value="ACTIVE">Ativa</option>
                <option value="INVALIDATED">Invalidada</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Validade
              <select
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => {
                  setValidity(
                    event.target.value as "all" | "usable" | "notUsable",
                  );
                  setPage(1);
                }}
                value={validity}
              >
                <option value="all">Todas</option>
                <option value="usable">Utilizáveis</option>
                <option value="notUsable">Não utilizáveis</option>
              </select>
            </label>
            <button
              className={cx(
                adminTheme.secondaryButton,
                "h-10 w-full xl:w-auto",
              )}
              onClick={openBatchDialog}
              type="button"
            >
              <Printer aria-hidden="true" className="h-4 w-4" />
              Imprimir em lote
            </button>
          </form>
        </div>

        {message ? <AdminFeedback tone="green">{message}</AdminFeedback> : null}
        {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}

        <div className="hidden max-w-full overflow-x-auto lg:block">
          <table className="w-full min-w-[960px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[16%]" />
              <col className="w-[9%]" />
              <col className="w-[5%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[29%]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Número</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Acadêmico</th>
                <th className="px-3 py-2.5">CPF</th>
                <th className="px-3 py-2.5">Ano</th>
                <th className="px-3 py-2.5">Situação</th>
                <th className="px-3 py-2.5">Validade</th>
                <th className="px-3 py-2.5">Emissão</th>
                <th className="px-3 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    <AdminEmptyState loading title="Carregando carteirinhas" />
                  </td>
                </tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    <AdminEmptyState
                      description="Ajuste os filtros ou busque por nome, CPF ou número da carteirinha."
                      title="Nenhuma carteirinha encontrada"
                    />
                  </td>
                </tr>
              ) : (
                cards.map((card) => (
                  <tr className="align-middle" key={card.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-950">
                      {card.cardNumber}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {cardTypeLabel(card.cardType)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <span className="line-clamp-2 break-words">
                        {card.student.person.fullName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {card.student.person.cpfMasked}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {card.academicYear.year}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <StudentCardStatusBadge card={card} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <StudentCardValidityBadges card={card} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {formatDateTime(card.issuedAt)}
                    </td>
                    <td className="px-1.5 py-2.5">
                      <StudentCardListActions
                        card={card}
                        onInvalidate={requestInvalidation}
                        onPdf={(nextCard, action) =>
                          void handlePdf(nextCard, action)
                        }
                        onToggleMore={(cardId) =>
                          setOpenActionsCardId((current) =>
                            current === cardId ? "" : cardId,
                          )
                        }
                        open={openActionsCardId === card.id}
                        pdfBusyId={pdfBusyId}
                        saving={saving}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 lg:hidden">
          {loading ? (
            <AdminEmptyState loading title="Carregando carteirinhas" />
          ) : cards.length === 0 ? (
            <AdminEmptyState
              description="Ajuste os filtros ou busque por nome, CPF ou número da carteirinha."
              title="Nenhuma carteirinha encontrada"
            />
          ) : (
            cards.map((card) => (
              <article
                className={cx(
                  adminTheme.card,
                  "grid min-w-0 gap-3 p-3 text-sm",
                )}
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
                  <StudentCardStatusBadge card={card} />
                </div>
                <div className="grid gap-1 text-xs text-slate-600">
                  <span>Tipo: {cardTypeLabel(card.cardType)}</span>
                  <span>
                    Validade: <StudentCardValidityBadges card={card} />
                  </span>
                  <span>Emissão: {formatDateTime(card.issuedAt)}</span>
                </div>
                <StudentCardListActions
                  card={card}
                  mobile
                  onInvalidate={requestInvalidation}
                  onPdf={(nextCard, action) => void handlePdf(nextCard, action)}
                  onToggleMore={(cardId) =>
                    setOpenActionsCardId((current) =>
                      current === cardId ? "" : cardId,
                    )
                  }
                  open={openActionsCardId === card.id}
                  pdfBusyId={pdfBusyId}
                  saving={saving}
                />
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
            onClick={() =>
              setPage((current) => Math.min(current + 1, totalPages))
            }
            type="button"
          >
            Próxima
          </button>
        </div>
      </section>

      {canUseAdministrativeIssue ? (
        <details className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amber-950">
            Emissão administrativa excepcional
          </summary>
          <p className="mt-2 text-xs text-amber-800">
            Use somente para correção administrativa. O fluxo normal gera a
            carteirinha automaticamente no cadastro ou aprovação do acadêmico.
          </p>
          <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className={cx(adminTheme.card, "min-w-0 p-4")}>
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
                  className={cx(adminTheme.control, "min-w-0 flex-1")}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Buscar acadêmico"
                  type="search"
                  value={studentSearch}
                />
                <button className={adminTheme.primaryButton} type="submit">
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
                      {student.currentEnrollment?.academicYear.year ??
                        "sem matrícula"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form
              className={cx(adminTheme.card, "min-w-0 p-4")}
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
                    className={adminTheme.control}
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
                        {enrollment.academicYear.year} -{" "}
                        {enrollment.institution.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={adminTheme.control}
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
                    className={adminTheme.control}
                    maxLength={300}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Observação opcional"
                    value={note}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
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
      {pendingInvalidation ? (
        <StudentCardInvalidationDialog
          card={pendingInvalidation.card}
          disabled={saving}
          note={invalidationNote}
          onCancel={() => setPendingInvalidation(null)}
          onConfirm={() => void confirmInvalidation()}
          onNoteChange={setInvalidationNote}
          onReasonChange={setInvalidationReason}
          reason={invalidationReason}
        />
      ) : null}
      {batchDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-950">
                Imprimir carteirinhas em lote
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                O lote usa somente carteirinhas já emitidas e utilizáveis.
              </p>
            </div>
            <div className="grid gap-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Ano letivo
                  <select
                    className={adminTheme.control}
                    onChange={(event) => setBatchYearId(event.target.value)}
                    value={batchYearId}
                  >
                    <option value="">Selecione</option>
                    {years.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Tipo
                  <select
                    className={adminTheme.control}
                    onChange={(event) =>
                      setBatchCardType(
                        event.target.value as "ALL" | StudentCardType,
                      )
                    }
                    value={batchCardType}
                  >
                    <option value="ALL">Todas</option>
                    <option value="STUDENT">Acadêmico</option>
                    <option value="BOARD_MEMBER">Diretoria</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Instituição
                  <select
                    className={adminTheme.control}
                    onChange={(event) =>
                      setBatchInstitutionId(event.target.value)
                    }
                    value={batchInstitutionId}
                  >
                    <option value="">Todas</option>
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Turno
                  <select
                    className={adminTheme.control}
                    onChange={(event) => setBatchShiftId(event.target.value)}
                    value={batchShiftId}
                  >
                    <option value="">Todos</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {batchLoading ? (
                  "Calculando carteirinhas..."
                ) : batchTotal > 0 ? (
                  <span>
                    <strong className="text-slate-950">{batchTotal}</strong>{" "}
                    carteirinha{batchTotal === 1 ? "" : "s"} selecionada
                    {batchTotal === 1 ? "" : "s"} para impressão.
                  </span>
                ) : (
                  "Nenhuma carteirinha emitida encontrada para os filtros selecionados."
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end">
              <button
                className={adminTheme.secondaryButton}
                disabled={batchGenerating}
                onClick={() => setBatchDialogOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={adminTheme.primaryButton}
                disabled={batchGenerating || batchLoading || batchTotal === 0}
                onClick={() => void generateBatchPdf()}
                type="button"
              >
                <Printer aria-hidden="true" className="h-4 w-4" />
                {batchGenerating ? "Gerando..." : "Gerar PDF para impressão"}
              </button>
            </div>
          </div>
        </div>
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
  const [enrollmentId, setEnrollmentId] = useState(
    student.enrollments[0]?.id ?? "",
  );
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
  const canShowAdministrativeIssue =
    canUseAdministrativeIssue && cards.length === 0;

  useEffect(() => {
    void loadCards();
  }, [student.id]);

  useEffect(() => {
    setEnrollmentId(student.enrollments[0]?.id ?? "");
    setCardType(expectedStudentCardType(student));
    setPreview(null);
  }, [
    student.id,
    student.activeBoardMembership?.id,
    student.enrollments[0]?.id,
  ]);

  async function loadCards() {
    setError("");
    setLoadingCards(true);
    try {
      const response = await api.listStudentCardsForStudent(student.id);
      setCards(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao carregar carteirinhas",
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
      setError(
        caught instanceof Error ? caught.message : "Erro ao visualizar prévia",
      );
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
  const pendingRequirement = selectPendingStudentCardRequirement(
    student,
    cards,
    currentCard,
  );
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
        pendingRequirement={pendingRequirement}
        student={student}
        totalCards={cards.length}
      />

      <p
        className={cx(adminTheme.softPanel, "px-3 py-2 text-xs text-slate-600")}
      >
        Foto opcional: quando a foto estiver indisponível, o PDF usa uma imagem
        padrão.
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
        <StudentCardNoActiveState
          onIssue={pendingRequirement ? () => void handleIssue() : undefined}
          pendingRequirement={pendingRequirement}
          saving={saving}
          totalCards={cards.length}
        />
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
                    {enrollment.academicYear.year} -{" "}
                    {enrollment.institution.name}
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
      {message ? (
        <p className="mt-2 text-xs text-emerald-700">{message}</p>
      ) : null}
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
        Curso/série/turno: {preview.enrollment.course} /{" "}
        {preview.enrollment.grade} / {preview.enrollment.shift.name}
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

function StudentCardListActions({
  card,
  mobile = false,
  onInvalidate,
  onPdf,
  onToggleMore,
  open,
  pdfBusyId,
  saving,
}: {
  card: StudentCardRecord;
  mobile?: boolean;
  onInvalidate: (card: StudentCardRecord) => void;
  onPdf: (card: StudentCardRecord, action: PdfAction) => void;
  onToggleMore: (cardId: string) => void;
  open: boolean;
  pdfBusyId: string;
  saving: boolean;
}) {
  const viewLabel =
    card.status === "INVALIDATED" ? "Visualizar histórico" : "Visualizar";
  const canUseSecondaryActions = card.status === "ACTIVE";
  const actionButtonClass = cx(
    adminTheme.secondaryButton,
    "h-8 whitespace-nowrap text-[11px]",
    mobile ? "flex-1 px-2 sm:flex-none" : "px-1.5",
  );
  const menuId = `student-card-actions-${card.id}`;

  return (
    <div
      className={cx(
        "relative flex gap-1.5",
        mobile ? "flex-wrap" : "items-center gap-0.5 whitespace-nowrap",
      )}
    >
      <button
        aria-label={`${viewLabel} ${card.cardNumber}`}
        className={actionButtonClass}
        disabled={Boolean(pdfBusyId)}
        onClick={() => onPdf(card, "view")}
        title={viewLabel}
        type="button"
      >
        <Eye aria-hidden="true" className="h-3 w-3" />
        {pdfBusyId === `${card.id}:view` ? "Abrindo..." : viewLabel}
      </button>
      <button
        aria-label={`Baixar PDF ${card.cardNumber}`}
        className={actionButtonClass}
        disabled={Boolean(pdfBusyId)}
        onClick={() => onPdf(card, "download")}
        title="Baixar PDF"
        type="button"
      >
        <Download aria-hidden="true" className="h-3 w-3" />
        {pdfBusyId === `${card.id}:download` ? "Baixando..." : "Baixar PDF"}
      </button>
      {canUseSecondaryActions ? (
        <div className="relative" data-card-actions-menu>
          <button
            aria-controls={menuId}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`Mais ações da carteirinha ${card.cardNumber}`}
            className={cx(
              adminTheme.secondaryButton,
              "h-8 whitespace-nowrap text-[11px]",
              mobile ? "w-full px-2 sm:w-auto" : "w-8 px-0",
            )}
            data-card-actions-trigger
            onClick={() => onToggleMore(card.id)}
            title="Mais ações"
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-3 w-3" />
            <span className={mobile ? "" : "sr-only"}>Mais ações</span>
          </button>
          {open ? (
            <div
              className="absolute right-0 z-30 mt-2 grid min-w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
              id={menuId}
              role="menu"
            >
              <button
                className="flex items-center gap-2 px-3 py-2 text-left text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                disabled={Boolean(pdfBusyId)}
                onClick={() => onPdf(card, "print")}
                role="menuitem"
                title="Imprimir"
                type="button"
              >
                <Printer aria-hidden="true" className="h-4 w-4" />
                {pdfBusyId === `${card.id}:print` ? "Abrindo..." : "Imprimir"}
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 text-left text-red-700 transition hover:bg-red-50 focus:bg-red-50 focus:outline-none disabled:opacity-60"
                disabled={saving}
                onClick={() => onInvalidate(card)}
                role="menuitem"
                title="Invalidar carteirinha"
                type="button"
              >
                <XCircle aria-hidden="true" className="h-4 w-4" />
                Invalidar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StudentCardStatusBadge({ card }: { card: StudentCardRecord }) {
  if (card.status === "INVALIDATED") {
    return <AdminStatusBadge tone="red">Invalidada</AdminStatusBadge>;
  }
  if (!card.validity.usable && card.validity.reason) {
    return <AdminStatusBadge tone="orange">Expirada</AdminStatusBadge>;
  }
  return <AdminStatusBadge tone="green">Ativa</AdminStatusBadge>;
}

function StudentCardValidityBadges({ card }: { card: StudentCardRecord }) {
  const hasPhotoIssue = card.validity.reason?.toLowerCase().includes("foto");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <AdminStatusBadge tone={card.validity.usable ? "green" : "orange"}>
        {card.validity.usable
          ? "Utilizável"
          : validityReasonLabel(card.validity.reason)}
      </AdminStatusBadge>
      {hasPhotoIssue ? (
        <AdminStatusBadge tone="orange">Sem foto</AdminStatusBadge>
      ) : null}
    </span>
  );
}

function StudentCardInvalidationDialog({
  card,
  disabled,
  note,
  onCancel,
  onConfirm,
  onNoteChange,
  onReasonChange,
  reason,
}: {
  card: StudentCardRecord;
  disabled?: boolean;
  note: string;
  onCancel: () => void;
  onConfirm: () => void;
  onNoteChange: (value: string) => void;
  onReasonChange: (value: StudentCardInvalidationReason) => void;
  reason: StudentCardInvalidationReason;
}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex gap-3 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">
              Invalidar carteirinha
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {card.cardNumber} de {card.student.person.fullName}. A regra
              funcional permanece a mesma; informe o motivo antes de confirmar.
            </p>
          </div>
        </div>
        <div className="grid gap-3 border-t border-slate-200 px-5 py-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Motivo
            <select
              className={adminTheme.control}
              onChange={(event) =>
                onReasonChange(
                  event.target.value as StudentCardInvalidationReason,
                )
              }
              value={reason}
            >
              <option value="MANUAL_CORRECTION">Correção administrativa</option>
              <option value="OTHER">Outro motivo</option>
              <option value="BOARD_MEMBERSHIP_ENDED">
                Fim de participação na diretoria
              </option>
              <option value="STUDENT_TERMINATED">Acadêmico desligado</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Observação opcional
            <input
              className={adminTheme.control}
              maxLength={300}
              onChange={(event) => onNoteChange(event.target.value)}
              value={note}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button
            className={adminTheme.secondaryButton}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-600/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
            disabled={disabled}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {disabled ? "Invalidando..." : "Invalidar carteirinha"}
          </button>
        </div>
      </section>
    </div>
  );
}

function cardTypeLabel(type: StudentCardType) {
  return type === "BOARD_MEMBER" ? "Diretoria" : "Acadêmico";
}

function validityReasonLabel(reason?: string | null) {
  const labels: Record<string, string> = {
    CARD_INVALIDATED: "Não utilizável",
    STUDENT_SUSPENDED: "Acadêmico suspenso",
    STUDENT_TERMINATED: "Acadêmico desligado",
    BOARD_MEMBERSHIP_ENDED: "Diretoria encerrada",
    BOARD_MEMBERSHIP_ACTIVE_REQUIRES_BOARD_CARD:
      "Substituída por carteirinha de diretoria",
  };
  return reason ? (labels[reason] ?? "Não utilizável") : "Não utilizável";
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
    const { blob, fileName } = await api.downloadStudentCardPdf(
      card.id,
      disposition,
    );
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
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${datePart} ${timePart}`;
}
