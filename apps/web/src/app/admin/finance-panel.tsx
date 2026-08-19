"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Banknote,
  Download,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
  XCircle,
} from "lucide-react";
import {
  api,
  ApiRequestError,
  type AcademicYear,
  type ApiUser,
  type BaseRecord,
  type BankSlipRecord,
  type BankSlipIssueBatch,
  type BankSlipIssueBatchItem,
  type BankSlipIssueBatchPreview,
  type BankSlipSummary,
  type BankSlipStatus,
  type CollectionSummary,
  type InvoiceCancellationReason,
  type InvoiceListSummary,
  type InvoicePreview,
  type InvoiceRecord,
  type InvoiceStatus,
  type LegacyFinancialHistoryResponse,
  type LegacyFinancialHistoryRecord,
  type StudentDetail,
  type StudentSummary,
} from "../../lib/api";
import { canAccessRestrictedAdmin } from "../../lib/auth";
import { formatDate, formatDateTime } from "../../lib/formatters/date";
import { mapApiErrorMessage, maskCpf } from "../../lib/formatters";
import { adminTheme, cx } from "./admin-theme";
import {
  BankSlipDialog,
  type BankSlipDialogState,
} from "./finance/bank-slip-dialogs";
import {
  BatchDialog,
  type BatchDialogState,
} from "./finance/batch-dialogs";
import {
  calculateBatchSummary,
  batchProgress,
  filterBatches,
} from "./finance/batch-display-utils";
import { BatchList } from "./finance/batch-list";
import { BatchSummaryCards } from "./finance/batch-summary";
import { CollectionsPanel } from "./collections-panel";
import {
  type BankSlipListRecord,
  calculateFinanceSummary,
  type FinanceArea,
  hasActiveFinanceFilters,
} from "./finance/finance-display-utils";
import { FinanceFilters } from "./finance/finance-filters";
import { type CollectionFilters } from "./finance/collections/collection-display-utils";
import { InvoiceActiveFilterChips } from "./finance/invoice-active-filter-chips";
import { InvoiceBulkActionBar } from "./finance/invoice-bulk-action-bar";
import { InvoiceCompactRow } from "./finance/invoice-compact-row";
import { InvoiceDetails } from "./finance/invoice-details";
import {
  calculateInvoiceOperationalSummary,
  filterInvoicesByQuickFilter,
  sortInvoicesOperationally,
  type InvoiceQuickFilter,
} from "./finance/invoice-display-utils";
import { InvoiceList } from "./finance/invoice-list";
import { InvoiceOperationalSummaryCards } from "./finance/invoice-operational-summary";
import { FinanceNavigation } from "./finance/finance-navigation";
import {
  FinanceSummaryCards,
  type FinanceMonthlyOverview,
  type FinanceSituationSlice,
} from "./finance/finance-summary";
import { FinancialReportsPanel } from "./finance/financial-reports-panel";
import { ManualMovementsPanel } from "./finance/manual-movements-panel";

type FinanceInitialArea = Extract<FinanceArea, "invoices" | "collections">;
type InvoiceInitialFilters = {
  academicYearId?: string;
  institutionId?: string;
  overdue?: "all" | "overdue" | "notOverdue";
  paidAtFrom?: string;
  paidAtTo?: string;
  status?: InvoiceStatus | "";
};

const invoiceStatusIssueErrorCodes = new Set([
  "INVOICE_ALREADY_PAID",
  "INVOICE_CANCELLED",
  "INVOICE_NOT_OPEN",
]);

function shouldReloadInvoicesAfterIssueError(caught: unknown) {
  return (
    caught instanceof ApiRequestError &&
    Boolean(caught.code && invoiceStatusIssueErrorCodes.has(caught.code))
  );
}

const invoiceCancellationOptions: Array<{
  label: string;
  value: InvoiceCancellationReason;
}> = [
  { label: "Correcao administrativa", value: "MANUAL_CORRECTION" },
  { label: "Fatura duplicada", value: "DUPLICATE" },
  { label: "Outro motivo", value: "OTHER" },
];

const LEGACY_FINANCIAL_PAGE_SIZE = 10;

export function FinancePanel({
  initialArea = "invoices",
  initialCollectionFilters,
  initialInvoiceFilters,
  user,
}: {
  initialArea?: FinanceInitialArea;
  initialCollectionFilters?: Partial<CollectionFilters>;
  initialInvoiceFilters?: InvoiceInitialFilters;
  user: ApiUser;
}) {
  const [financeArea, setFinanceArea] = useState<FinanceArea>(initialArea);
  const canViewCollections =
    user.roles.includes("SUPER_ADMIN") || user.roles.includes("SECRETARIA");
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceListSummary | null>(null);
  const invoiceRequestIdRef = useRef(0);
  const [bankSlips, setBankSlips] = useState<
    Record<string, BankSlipListRecord | null | undefined>
  >({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [createInvoiceDialogOpen, setCreateInvoiceDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const defaultMonth = useMemo(() => currentMonthRange(), []);
  const defaultOverviewPeriod = useMemo(() => currentMonthParts(), []);
  const [overviewMonth, setOverviewMonth] = useState(defaultOverviewPeriod.month);
  const [overviewYear, setOverviewYear] = useState(defaultOverviewPeriod.year);
  const [monthlyOverview, setMonthlyOverview] = useState<FinanceMonthlyOverview[]>([]);
  const [situationBreakdown, setSituationBreakdown] = useState<FinanceSituationSlice[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [collectionSummary, setCollectionSummary] = useState<CollectionSummary | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState("");
  const [academicYearId, setAcademicYearId] = useState(
    initialInvoiceFilters?.academicYearId ?? "",
  );
  const [institutionId, setInstitutionId] = useState(
    initialInvoiceFilters?.institutionId ?? "",
  );
  const [status, setStatus] = useState<InvoiceStatus | "">(
    initialInvoiceFilters?.status ?? "",
  );
  const [overdue, setOverdue] = useState<"all" | "overdue" | "notOverdue">(
    initialInvoiceFilters?.overdue ?? "all",
  );
  const [invoiceQuickFilter, setInvoiceQuickFilter] =
    useState<InvoiceQuickFilter>(() =>
      initialInvoiceFilters
        ? quickFilterFromInitialFilters(initialInvoiceFilters)
        : "all",
    );
  const [dueDateFrom, setDueDateFrom] = useState(
    initialInvoiceFilters ? "" : defaultMonth.from,
  );
  const [dueDateTo, setDueDateTo] = useState(
    initialInvoiceFilters ? "" : defaultMonth.to,
  );
  const [paidAtFrom, setPaidAtFrom] = useState(
    initialInvoiceFilters?.paidAtFrom ?? "",
  );
  const [paidAtTo, setPaidAtTo] = useState(
    initialInvoiceFilters?.paidAtTo ?? "",
  );
  const [invoiceEnrollmentId, setInvoiceEnrollmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayDate());
  const [description, setDescription] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankSlipAction, setBankSlipAction] = useState("");
  const [bankSlipDialog, setBankSlipDialog] = useState<BankSlipDialogState | null>(null);
  const [invoiceActionDialog, setInvoiceActionDialog] = useState<{
    invoice: InvoiceRecord;
    mode: "cancel-invoice";
  } | null>(null);
  const issueBankSlipInFlightRef = useRef("");
  const issueBatchInFlightRef = useRef(false);
  const issueBatchRetryInFlightRef = useRef(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [issueBatchInstitutionId, setIssueBatchInstitutionId] = useState("");
  const [issueBatchAmount, setIssueBatchAmount] = useState("");
  const [issueBatchDueDate, setIssueBatchDueDate] = useState(todayDate());
  const [issueBatchPreview, setIssueBatchPreview] = useState<BankSlipIssueBatchPreview | null>(null);
  const [issueBatch, setIssueBatch] = useState<BankSlipIssueBatch | null>(null);
  const [issueBatchItems, setIssueBatchItems] = useState<BankSlipIssueBatchItem[]>([]);
  const [issueBatches, setIssueBatches] = useState<BankSlipIssueBatch[]>([]);
  const [issueBatchesLoading, setIssueBatchesLoading] = useState(false);
  const [expandedIssueBatchId, setExpandedIssueBatchId] = useState("");
  const [issueBatchItemsById, setIssueBatchItemsById] = useState<
    Record<string, BankSlipIssueBatchItem[] | undefined>
  >({});
  const [issueBatchItemsLoadingId, setIssueBatchItemsLoadingId] = useState("");
  const [issueBatchActionId, setIssueBatchActionId] = useState("");
  const [batchDialog, setBatchDialog] = useState<BatchDialogState | null>(null);
  const [issueBatchDownloadState, setIssueBatchDownloadState] = useState<
    "" | "preparing" | "started" | "partial" | "empty" | "error"
  >("");
  const [issueBatchDownloadSummary, setIssueBatchDownloadSummary] = useState("");
  const [issueBatchDownloadPanelOpen, setIssueBatchDownloadPanelOpen] = useState(false);
  const [issueBatchDownloadBatches, setIssueBatchDownloadBatches] = useState<BankSlipIssueBatch[]>([]);
  const [issueBatchSearch, setIssueBatchSearch] = useState("");
  const [issueBatchDownloadSearch, setIssueBatchDownloadSearch] = useState("");
  const [issueBatchDownloadLoading, setIssueBatchDownloadLoading] = useState(false);
  const [issueBatchDownloadBatchId, setIssueBatchDownloadBatchId] = useState("");
  const [syncPaidDate, setSyncPaidDate] = useState(todayDate());
  const [syncPaidDialogOpen, setSyncPaidDialogOpen] = useState(false);
  const [syncPaidSummary, setSyncPaidSummary] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invoiceLoadError, setInvoiceLoadError] = useState("");
  const createInvoiceButtonRef = useRef<HTMLButtonElement | null>(null);
  const studentSearchInputRef = useRef<HTMLInputElement | null>(null);
  const issueBatchProgressEvents = useMemo(
    () => latestIssueBatchEvents(issueBatchItems),
    [issueBatchItems],
  );
  const showIssueBatchProgress = Boolean(
    issueBatch &&
      (isIssueBatchRunning(issueBatch) || issueBatch.progressPercent === 100 || issueBatch.finishedAt),
  );
  const filteredIssueBatchDownloads = useMemo(
    () => filterBatches(issueBatchDownloadBatches, issueBatchDownloadSearch),
    [issueBatchDownloadBatches, issueBatchDownloadSearch],
  );
  const filteredIssueBatches = useMemo(
    () => filterBatches(issueBatches, issueBatchSearch),
    [issueBatches, issueBatchSearch],
  );
  const canRetryIssueBatches = canAccessRestrictedAdmin(user);
  const batchSummary = useMemo(
    () => calculateBatchSummary(issueBatches),
    [issueBatches],
  );
  const financeSummary = useMemo(
    () => ({
      ...(invoiceSummary
        ? { ...invoiceSummary, scope: "filtered" as const }
        : calculateFinanceSummary(invoices, bankSlips, issueBatch)),
      processingBatches: issueBatch && isIssueBatchRunning(issueBatch) ? 1 : 0,
    }),
    [bankSlips, invoices, invoiceSummary, issueBatch],
  );
  const invoiceOperationalSummary = useMemo(
    () =>
      calculateInvoiceOperationalSummary(invoices, bankSlips, {
        paidAtFrom: paidAtFrom || defaultMonth.from,
        paidAtTo: paidAtTo || defaultMonth.to,
      }),
    [bankSlips, defaultMonth.from, defaultMonth.to, invoices, paidAtFrom, paidAtTo],
  );
  const visibleInvoices = useMemo(
    () =>
      sortInvoicesOperationally(
        filterInvoicesByQuickFilter(invoices, bankSlips, invoiceQuickFilter, {
          paidAtFrom: paidAtFrom || defaultMonth.from,
          paidAtTo: paidAtTo || defaultMonth.to,
        }),
        bankSlips,
      ),
    [bankSlips, defaultMonth.from, defaultMonth.to, invoiceQuickFilter, invoices, paidAtFrom, paidAtTo],
  );
  const hasActiveFilters = hasActiveFinanceFilters({
    academicYearId,
    dueDateFrom,
    dueDateTo,
    institutionId,
    overdue,
    paidAtFrom,
    paidAtTo,
    search,
    status,
  }) || invoiceQuickFilter !== "all";
  const selectedInvoiceEnrollment = selectedStudent?.enrollments.find(
    (enrollment) => enrollment.id === invoiceEnrollmentId,
  );
  const invoiceAmountCents = parseMoneyToCentsSafe(amount);
  const isInvoiceFormValid =
    Boolean(selectedStudent) &&
    Boolean(invoiceEnrollmentId) &&
    typeof invoiceAmountCents === "number" &&
    invoiceAmountCents > 0 &&
    Boolean(dueDate);
  const canSubmitInvoice =
    isInvoiceFormValid &&
    selectedStudent?.canReceiveFutureInvoices !== false &&
    preview?.eligible === true;

  useEffect(() => {
    void loadReferences();
    void loadIssueBatches();
  }, []);

  useEffect(() => {
    if (financeArea === "overview") {
      void loadOverviewData();
    }
  }, [academicYearId, canViewCollections, financeArea, institutionId, overviewMonth, overviewYear]);

  useEffect(() => {
    setFinanceArea(
      initialArea === "collections" && !canViewCollections ? "invoices" : initialArea,
    );
  }, [canViewCollections, initialArea]);

  useEffect(() => {
    if (!initialInvoiceFilters) {
      return;
    }
    setAcademicYearId(initialInvoiceFilters.academicYearId ?? "");
    setInstitutionId(initialInvoiceFilters.institutionId ?? "");
    setStatus(initialInvoiceFilters.status ?? "");
    setOverdue(initialInvoiceFilters.overdue ?? "all");
    setDueDateFrom("");
    setDueDateTo("");
    setPaidAtFrom(initialInvoiceFilters.paidAtFrom ?? "");
    setPaidAtTo(initialInvoiceFilters.paidAtTo ?? "");
    setInvoiceQuickFilter(quickFilterFromInitialFilters(initialInvoiceFilters));
    setPage(1);
  }, [initialInvoiceFilters]);

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
    paidAtFrom,
    paidAtTo,
  ]);

  useEffect(() => {
    if (!createInvoiceDialogOpen) {
      return;
    }
    window.setTimeout(() => studentSearchInputRef.current?.focus(), 0);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        closeCreateInvoiceDialog();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [createInvoiceDialogOpen, saving]);

  useEffect(() => {
    if (!issueBatch || !isIssueBatchRunning(issueBatch)) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshIssueBatch(issueBatch.id);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [issueBatch?.id, issueBatch?.status]);

  async function loadReferences() {
    setError("");
    try {
      const [yearsResponse, institutionsResponse] = await Promise.all([
        api.listAcademicYears({ status: "all" }),
        api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
      ]);
      setYears(yearsResponse.data);
      setInstitutions(institutionsResponse.data);
      const current = yearsResponse.data.find((year) => year.isCurrent);
      if (!initialInvoiceFilters) {
        setAcademicYearId(current?.id ?? "");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar referencias",
      );
    }
  }

  async function loadInvoices(nextSearch = search) {
    const requestId = invoiceRequestIdRef.current + 1;
    invoiceRequestIdRef.current = requestId;
    setLoading(true);
    setError("");
    setInvoiceLoadError("");
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
        paidAtFrom,
        paidAtTo,
        sort: "dueDate",
        order: "asc",
      });
      if (requestId !== invoiceRequestIdRef.current) {
        return;
      }
      setInvoices(response.data);
      setInvoiceSummary(response.summary ?? null);
      setBankSlips((current) => mergeBankSlipSummaries(response.data, current));
      setSelectedInvoiceIds((current) =>
        current.filter((invoiceId) => response.data.some((invoice) => invoice.id === invoiceId)),
      );
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (caught) {
      if (requestId !== invoiceRequestIdRef.current) {
        return;
      }
      const message = caught instanceof Error ? caught.message : "Erro ao carregar faturas";
      setInvoices([]);
      setInvoiceSummary(null);
      setBankSlips({});
      setSelectedInvoiceIds([]);
      setTotalPages(1);
      setInvoiceLoadError(message);
    } finally {
      if (requestId === invoiceRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  async function loadIssueBatches() {
    setIssueBatchesLoading(true);
    try {
      const response = await api.listBankSlipIssueBatches({
        limit: 100,
      });
      setIssueBatches(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar lotes");
    } finally {
      setIssueBatchesLoading(false);
    }
  }

  async function loadOverviewData() {
    const periodRange = monthRange(overviewYear, overviewMonth);
    setOverviewLoading(true);
    setCollectionLoading(canViewCollections);
    setOverviewError("");
    setCollectionError("");
    try {
      const monthRanges = lastMonthRanges(overviewYear, overviewMonth, 12);
      const [
        monthlyResponses,
        openResponse,
        overdueResponse,
        paidResponse,
        cancelledResponse,
        collectionsResponse,
      ] = await Promise.all([
        Promise.all(
          monthRanges.map((range) =>
            api.listInvoices({
              page: 1,
              limit: 1,
              academicYearId,
              institutionId,
              overdue: "all",
              dueDateFrom: range.from,
              dueDateTo: range.to,
              sort: "dueDate",
              order: "asc",
            }),
          ),
        ),
        api.listInvoices({
          page: 1,
          limit: 1,
          academicYearId,
          institutionId,
          status: "OPEN",
          overdue: "notOverdue",
          dueDateFrom: periodRange.from,
          dueDateTo: periodRange.to,
        }),
        api.listInvoices({
          page: 1,
          limit: 1,
          academicYearId,
          institutionId,
          status: "OPEN",
          overdue: "overdue",
          dueDateFrom: periodRange.from,
          dueDateTo: periodRange.to,
        }),
        api.listInvoices({
          page: 1,
          limit: 1,
          academicYearId,
          institutionId,
          status: "PAID",
          overdue: "all",
          dueDateFrom: periodRange.from,
          dueDateTo: periodRange.to,
        }),
        api.listInvoices({
          page: 1,
          limit: 1,
          academicYearId,
          institutionId,
          status: "CANCELLED",
          overdue: "all",
          dueDateFrom: periodRange.from,
          dueDateTo: periodRange.to,
        }),
        canViewCollections
          ? api.getCollectionSummary({
              academicYearId,
              institutionId,
            })
          : Promise.resolve(null),
      ]);

      setMonthlyOverview(
        monthRanges.map((range, index) => {
          const item = monthlyResponses[index];
          return {
            key: range.from,
            label: range.label,
            openAmountCents: item?.summary?.openAmountCents ?? 0,
            overdueAmountCents: item?.summary?.overdueAmountCents ?? 0,
            paidAmountCents: item?.summary?.paidAmountCents ?? 0,
          };
        }),
      );
      setSituationBreakdown([
        toSituationSlice("paid", "Pago", "#1F6F5F", paidResponse),
        toSituationSlice("open", "Em aberto", "#2563EB", openResponse),
        toSituationSlice("overdue", "Vencido", "#DC2626", overdueResponse),
        toSituationSlice("cancelled", "Cancelado/baixado", "#F59E0B", cancelledResponse),
      ]);
      setCollectionSummary(collectionsResponse);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Erro ao carregar visão geral";
      setOverviewError(message);
      if (canViewCollections) {
        setCollectionError(message);
      }
    } finally {
      setOverviewLoading(false);
      setCollectionLoading(false);
    }
  }

  function mergeIssueBatch(updated: BankSlipIssueBatch) {
    setIssueBatches((current) => {
      const exists = current.some((batch) => batch.id === updated.id);
      const next = exists
        ? current.map((batch) => (batch.id === updated.id ? updated : batch))
        : [updated, ...current];
      return next.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    });
  }

  function updateBankSlip(
    invoiceId: string,
    bankSlip: BankSlipListRecord | null | undefined,
  ) {
    setBankSlips((current) => ({ ...current, [invoiceId]: bankSlip }));
  }

  async function loadFullBankSlip(invoice: InvoiceRecord) {
    const current = bankSlips[invoice.id];
    if (!current || isFullBankSlip(current)) {
      return current;
    }
    updateBankSlip(invoice.id, undefined);
    try {
      const bankSlip = await api.getInvoiceBankSlip(invoice.id);
      updateBankSlip(invoice.id, bankSlip);
      return bankSlip;
    } catch (caught) {
      updateBankSlip(invoice.id, invoice.bankSlipSummary);
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar detalhe do boleto",
      );
      return invoice.bankSlipSummary;
    }
  }

  async function toggleBankSlipDetails(invoice: InvoiceRecord) {
    const willExpand = expandedInvoiceId !== invoice.id;
    setExpandedInvoiceId(willExpand ? invoice.id : "");
    if (willExpand) {
      await loadFullBankSlip(invoice);
    }
  }

  async function searchStudents(nextSearch = studentSearch) {
    const trimmedSearch = nextSearch.trim();
    if (trimmedSearch.length < 2) {
      setStudents([]);
      setError("Informe ao menos 2 caracteres para buscar acadêmico.");
      return;
    }
    setError("");
    try {
      const response = await api.listStudents({
        search: trimmedSearch,
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
    if (preview?.eligible !== true) {
      setError("Revise a fatura e confirme a elegibilidade antes de criar.");
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
      setSelectedStudent(null);
      setInvoiceEnrollmentId("");
      setStudents([]);
      setStudentSearch("");
      setCreateInvoiceDialogOpen(false);
      await loadInvoices();
      window.setTimeout(() => createInvoiceButtonRef.current?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao criar fatura");
    } finally {
      setSaving(false);
    }
  }

  function openCreateInvoiceDialog() {
    setFinanceArea("invoices");
    setError("");
    setMessage("");
    setPreview(null);
    setCreateInvoiceDialogOpen(true);
  }

  function closeCreateInvoiceDialog() {
    if (saving) {
      return;
    }
    setCreateInvoiceDialogOpen(false);
    setPreview(null);
    window.setTimeout(() => createInvoiceButtonRef.current?.focus(), 0);
  }

  async function handleCancel(
    invoice: InvoiceRecord,
    reason: InvoiceCancellationReason,
    note: string,
  ) {
    if (!reason) {
      setError("Selecione um motivo valido para cancelar a fatura.");
      return;
    }
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
      setInvoiceActionDialog(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  function showBankSlipResult(title: string, message: string, tone: "danger" | "success" | "warning") {
    setBankSlipDialog({
      message,
      title,
      tone,
      type: "result",
    });
  }

  function openIssueBankSlipDialog(invoice: InvoiceRecord) {
    if (issueBankSlipInFlightRef.current || bankSlipAction) {
      return;
    }
    setBankSlipDialog({
      invoice,
      type: "issue",
    });
  }

  function openSyncBankSlipDialog(invoice: InvoiceRecord) {
    if (bankSlipAction) {
      return;
    }
    setBankSlipDialog({
      bankSlip: bankSlips[invoice.id] ?? invoice.bankSlipSummary,
      invoice,
      type: "sync",
    });
  }

  function openCancelBankSlipDialog(invoice: InvoiceRecord) {
    if (bankSlipAction) {
      return;
    }
    setBankSlipDialog({
      bankSlip: bankSlips[invoice.id] ?? invoice.bankSlipSummary,
      invoice,
      type: "cancel",
    });
  }

  async function openBankSlipErrorDialog(invoice: InvoiceRecord) {
    const existingBankSlip = bankSlips[invoice.id] ?? invoice.bankSlipSummary;
    if (bankSlipAction) {
      setBankSlipDialog({
        bankSlip: existingBankSlip,
        invoice,
        type: "error",
      });
      return;
    }
    setBankSlipAction(invoice.id);
    try {
      const fullBankSlip = await loadFullBankSlip(invoice);
      setBankSlipDialog({
        bankSlip: fullBankSlip ?? existingBankSlip,
        invoice,
        type: "error",
      });
    } catch {
      setBankSlipDialog({
        bankSlip: existingBankSlip,
        invoice,
        type: "error",
      });
    } finally {
      setBankSlipAction("");
    }
  }

  async function handleIssueBankSlip(invoice: InvoiceRecord) {
    if (issueBankSlipInFlightRef.current) {
      return;
    }
    issueBankSlipInFlightRef.current = invoice.id;
    try {
      setBankSlipAction(invoice.id);
      setMessage("");
      setError("");
      const bankSlip = await api.issueInvoiceBankSlip(invoice.id);
      updateBankSlip(invoice.id, bankSlip);
      setExpandedInvoiceId(invoice.id);
      setMessage("Boleto emitido");
      showBankSlipResult("Boleto emitido", "O boleto foi emitido e a fatura foi atualizada.", "success");
      await loadInvoices();
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Erro ao emitir boleto";
      const messageText =
        text.includes("incerto") || text.includes("confirmar")
          ? "O sistema não conseguiu confirmar se o boleto foi criado no Sicredi. Não tente emitir novamente. Use a consulta de situação ou procure o administrador."
          : text;
      setError(messageText);
      showBankSlipResult("Emissão não confirmada", messageText, "danger");
      if (shouldReloadInvoicesAfterIssueError(caught)) {
        await loadInvoices();
      } else {
        await loadFullBankSlip(invoice);
      }
    } finally {
      setBankSlipAction("");
      issueBankSlipInFlightRef.current = "";
    }
  }

  async function handleSyncBankSlip(invoice: InvoiceRecord) {
    const previous = bankSlips[invoice.id]?.status;
    setBankSlipAction(invoice.id);
    setMessage("");
    setError("");
    try {
      const bankSlip = await api.syncInvoiceBankSlip(invoice.id);
      updateBankSlip(invoice.id, bankSlip);
      setExpandedInvoiceId(invoice.id);
      const resultMessage = syncResultMessage(previous, bankSlip.status);
      setMessage(resultMessage);
      showBankSlipResult("Consulta concluída", resultMessage, "success");
      await loadInvoices();
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Erro ao consultar boleto";
      setError(messageText);
      showBankSlipResult("Erro ao consultar boleto", messageText, "danger");
    } finally {
      setBankSlipAction("");
    }
  }

  async function handleCancelBankSlip(
    invoice: InvoiceRecord,
    reason: InvoiceCancellationReason,
    note: string,
  ) {
    setBankSlipAction(invoice.id);
    setMessage("");
    setError("");
    try {
      const bankSlip = await api.cancelInvoiceBankSlip(invoice.id, {
        reason,
        note: emptyToUndefined(note),
      });
      updateBankSlip(invoice.id, bankSlip);
      setExpandedInvoiceId(invoice.id);
      const resultMessage = "Baixa solicitada. Aguarde confirmação bancária.";
      setMessage(resultMessage);
      showBankSlipResult("Baixa solicitada", resultMessage, "success");
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Erro ao solicitar baixa";
      setError(messageText);
      showBankSlipResult("Erro ao solicitar baixa", messageText, "danger");
    } finally {
      setBankSlipAction("");
    }
  }

  async function handleDownloadPdf(invoice: InvoiceRecord) {
    setBankSlipAction(invoice.id);
    setMessage("");
    setError("");
    try {
      const result = await api.downloadInvoiceBankSlipPdf(invoice.id);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeBankSlipFileName(result.fileName, invoice.id);
      link.click();
      URL.revokeObjectURL(url);
      setMessage("PDF do boleto baixado");
      showBankSlipResult("Download iniciado", "O PDF do boleto foi preparado para download.", "success");
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "PDF indisponível";
      setError(messageText);
      showBankSlipResult("PDF indisponível", messageText, "warning");
    } finally {
      setBankSlipAction("");
    }
  }

  async function handleCopyLinhaDigitavel(invoiceId: string) {
    const bankSlip = bankSlips[invoiceId];
    const line = isFullBankSlip(bankSlip) ? bankSlip.linhaDigitavel : undefined;
    if (!line) {
      return;
    }
    try {
      await navigator.clipboard.writeText(line);
      setMessage("Linha digitavel copiada");
    } catch {
      setError("Nao foi possivel copiar a linha digitavel");
    }
  }

  async function handleSyncPaidDay() {
    setSyncPaidDialogOpen(false);
    setSaving(true);
    setMessage("");
    setError("");
    setSyncPaidSummary("");
    try {
      const summary = await api.syncPaidBankSlipsDay(syncPaidDate);
      setSyncPaidSummary(
        `Paginas: ${summary.pagesProcessed}; recebidos: ${summary.recordsReceived}; encontrados: ${summary.bankSlipsFound}; confirmados: ${summary.paymentsConfirmed}; ja sincronizados: ${summary.alreadySynced}; nao encontrados: ${summary.notFound}; erros: ${summary.errors.length}.`,
      );
      await loadInvoices();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro na conciliacao");
    } finally {
      setSaving(false);
    }
  }

  function toggleInvoiceSelection(invoiceId: string) {
    setSelectedInvoiceIds((current) =>
      current.includes(invoiceId)
        ? current.filter((currentId) => currentId !== invoiceId)
        : [...current, invoiceId],
    );
  }

  function selectAllEligibleInvoices() {
    const eligible = visibleInvoices
      .filter((invoice) => canIssueBankSlip(invoice, bankSlips[invoice.id]))
      .map((invoice) => invoice.id);
    setSelectedInvoiceIds(eligible);
  }

  async function handlePreviewInstitutionIssueBatch() {
    if (!issueBatchInstitutionId || !issueBatchDueDate) {
      setError("Selecione instituicao e vencimento para gerar a previa");
      return;
    }
    let amountCents: number;
    try {
      amountCents = parseMoneyToCents(issueBatchAmount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Valor invalido");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const previewResult = await api.previewBankSlipIssueBatch({
        institutionId: issueBatchInstitutionId,
        amountCents,
        dueDate: issueBatchDueDate,
        limit: 200,
      });
      setIssueBatchPreview(previewResult);
      setMessage("Previa de emissao gerada");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao gerar previa");
    } finally {
      setSaving(false);
    }
  }

  async function refreshIssueBatch(batchId: string) {
    try {
      const [batch, items] = await Promise.all([
        api.getBankSlipIssueBatch(batchId),
        api.listBankSlipIssueBatchItems(batchId, { limit: 200 }),
      ]);
      setIssueBatch(batch);
      setIssueBatchItems(items.data);
      mergeIssueBatch(batch);
      setIssueBatchItemsById((current) => ({ ...current, [batch.id]: items.data }));
      if (!isIssueBatchRunning(batch)) {
        setMessage(issueBatchCompletionMessage(batch));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar lote");
    }
  }

  async function handleCreateIssueBatch() {
    if (issueBatchInFlightRef.current || selectedInvoiceIds.length === 0) {
      return;
    }
    setBatchDialog({ count: selectedInvoiceIds.length, type: "create-manual" });
  }

  async function confirmCreateIssueBatch() {
    if (issueBatchInFlightRef.current || selectedInvoiceIds.length === 0) {
      return;
    }
    issueBatchInFlightRef.current = true;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const batch = await api.createBankSlipIssueBatch(selectedInvoiceIds);
      setMessage("Lote criado. Emitindo boletos...");
      setIssueBatch(batch);
      mergeIssueBatch(batch);
      setSelectedInvoiceIds([]);
      setBatchDialog({
        message: "Lote criado. A emissão foi iniciada e o progresso será atualizado automaticamente.",
        title: "Emissão iniciada",
        tone: "success",
        type: "result",
      });
      await refreshIssueBatch(batch.id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Erro ao criar lote";
      setError(message);
      setBatchDialog({
        message,
        title: "Erro ao criar lote",
        tone: "danger",
        type: "result",
      });
    } finally {
      setSaving(false);
      issueBatchInFlightRef.current = false;
    }
  }

  async function handleCreateInstitutionIssueBatch() {
    if (issueBatchInFlightRef.current || !issueBatchPreview || issueBatchPreview.totalEligible === 0) {
      return;
    }
    setBatchDialog({ preview: issueBatchPreview, type: "create-institution" });
  }

  async function confirmCreateInstitutionIssueBatch() {
    if (issueBatchInFlightRef.current || !issueBatchPreview || issueBatchPreview.totalEligible === 0) {
      return;
    }
    issueBatchInFlightRef.current = true;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const batch = await api.createBankSlipIssueBatch({
        source: "INSTITUTION",
        institutionId: issueBatchPreview.institutionId,
        amountCents: issueBatchPreview.unitAmountCents,
        shiftId: issueBatchPreview.shiftId || undefined,
        dueDate: issueBatchPreview.dueDate ?? issueBatchDueDate,
        createMissingInvoices: true,
      });
      setMessage("Lote criado. Emitindo boletos...");
      setIssueBatch(batch);
      mergeIssueBatch(batch);
      setBatchDialog({
        message: "Lote institucional criado. Faturas elegíveis foram enviadas para emissão.",
        title: "Lote institucional iniciado",
        tone: "success",
        type: "result",
      });
      await refreshIssueBatch(batch.id);
      await loadInvoices();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Erro ao criar lote institucional";
      setError(message);
      setBatchDialog({
        message,
        title: "Erro no lote institucional",
        tone: "danger",
        type: "result",
      });
    } finally {
      setSaving(false);
      issueBatchInFlightRef.current = false;
    }
  }

  async function handleCancelIssueBatch() {
    if (!issueBatch) {
      return;
    }
    setBatchDialog({ batch: issueBatch, type: "cancel" });
  }

  async function confirmCancelIssueBatch(reason: string) {
    const batchToCancel = batchDialog?.type === "cancel" ? batchDialog.batch : issueBatch;
    if (!batchToCancel) {
      return;
    }
    setIssueBatchActionId(batchToCancel.id);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const batch = await api.cancelBankSlipIssueBatch(batchToCancel.id, {
        reason: emptyToUndefined(reason),
      });
      setIssueBatch(batch);
      mergeIssueBatch(batch);
      await refreshIssueBatch(batch.id);
      setMessage("Lote cancelado");
      setBatchDialog({
        message: "Lote cancelado. Itens já finalizados foram preservados.",
        title: "Lote cancelado",
        tone: "warning",
        type: "result",
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Erro ao cancelar lote";
      setError(message);
      setBatchDialog({
        message,
        title: "Erro ao cancelar lote",
        tone: "danger",
        type: "result",
      });
    } finally {
      setSaving(false);
      setIssueBatchActionId("");
    }
  }

  async function handleRetryIssueBatch() {
    if (!issueBatch || !canRetryIssueBatches) {
      return;
    }
    setBatchDialog({ batch: issueBatch, type: "retry" });
  }

  async function confirmRetryIssueBatch(reason: string) {
    const batchToRetry = batchDialog?.type === "retry" ? batchDialog.batch : issueBatch;
    if (!batchToRetry || !canRetryIssueBatches || issueBatchRetryInFlightRef.current) {
      return;
    }
    if (batchToRetry.failedItems === 0) {
      const message = "Não há itens FAILED neste lote. O retry seguro não inclui itens UNKNOWN para evitar duplicidade.";
      setMessage(message);
      setBatchDialog({
        message,
        title: "Sem itens seguros para retry",
        tone: "warning",
        type: "result",
      });
      return;
    }
    setIssueBatchActionId(batchToRetry.id);
    issueBatchRetryInFlightRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const batch = await api.retryFailedBankSlipIssueBatch(batchToRetry.id, {
        reason: emptyToUndefined(reason),
      });
      setIssueBatch(batch);
      mergeIssueBatch(batch);
      await refreshIssueBatch(batch.id);
      setMessage("Itens com falha segura reenfileirados");
      setBatchDialog({
        message: "Itens FAILED foram reenfileirados com segurança. Itens UNKNOWN permaneceram fora do retry.",
        title: "Retry enviado",
        tone: "success",
        type: "result",
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Erro ao reenfileirar";
      setError(message);
      setBatchDialog({
        message: message.includes("NO_SAFE_RETRY_ITEMS")
          ? "Não há itens com falha segura para retry neste lote."
          : message,
        title: "Retry não executado",
        tone: "danger",
        type: "result",
      });
    } finally {
      issueBatchRetryInFlightRef.current = false;
      setSaving(false);
      setIssueBatchActionId("");
    }
  }

  async function openIssueBatchDownloadPanel() {
    setIssueBatchDownloadPanelOpen(true);
    if (issueBatchDownloadBatches.length === 0) {
      await loadIssueBatchDownloadBatches();
    }
  }

  async function loadIssueBatchDownloadBatches() {
    setIssueBatchDownloadLoading(true);
    setError("");
    try {
      const response = await api.listBankSlipIssueBatches({
        source: "INSTITUTION",
        limit: 100,
      });
      setIssueBatchDownloadBatches(response.data);
      setIssueBatches((current) => mergeBatchLists(current, response.data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar lotes");
    } finally {
      setIssueBatchDownloadLoading(false);
    }
  }

  async function handleDownloadIssueBatchPdfs(batch: BankSlipIssueBatch) {
    if (issueBatchDownloadState === "preparing") {
      return;
    }
    setIssueBatchDownloadState("preparing");
    setIssueBatchDownloadBatchId(batch.id);
    setIssueBatchDownloadSummary("Preparando arquivo...");
    setMessage("");
    setError("");
    try {
      const result = await api.downloadBankSlipIssueBatchZip(batch.id);
      const link = document.createElement("a");
      const url = URL.createObjectURL(result.blob);
      link.href = url;
      link.download = safeZipFileName(
        result.fileName,
        `boletos-${batch.id.slice(0, 8)}.zip`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const total = numberHeader(result.headers, "x-bank-slip-zip-total", batch.totalItems);
      const included = numberHeader(result.headers, "x-bank-slip-zip-included", 0);
      const skipped = numberHeader(result.headers, "x-bank-slip-zip-skipped", Math.max(0, total - included));
      const failed = numberHeader(result.headers, "x-bank-slip-zip-failed", skipped);
      const firstFailure = decodedHeader(result.headers, "x-bank-slip-zip-first-failure");
      const summary = `Total de boletos: ${total}; PDFs incluidos: ${included}; boletos ignorados: ${skipped}; falhas: ${failed}.`;
      setIssueBatchDownloadSummary(summary);
      if (included === 0) {
        setIssueBatchDownloadState("empty");
        setMessage(issueBatchEmptyDownloadMessage(firstFailure));
      } else if (skipped > 0 || failed > 0) {
        setIssueBatchDownloadState("partial");
        setMessage("Alguns boletos não foram incluídos");
      } else {
        setIssueBatchDownloadState("started");
        setMessage("Download iniciado");
      }
    } catch (caught) {
      setIssueBatchDownloadState("error");
      setIssueBatchDownloadSummary("");
      setError(caught instanceof Error ? caught.message : "Erro ao preparar ZIP");
    } finally {
      setIssueBatchDownloadBatchId("");
    }
  }

  function handleViewIssueBatchDetails() {
    document.getElementById("issue-batch-details")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function toggleIssueBatchDetails(batch: BankSlipIssueBatch) {
    if (expandedIssueBatchId === batch.id) {
      setExpandedIssueBatchId("");
      return;
    }
    setExpandedIssueBatchId(batch.id);
    setIssueBatch(batch);
    if (issueBatchItemsById[batch.id]) {
      setIssueBatchItems(issueBatchItemsById[batch.id] ?? []);
      return;
    }
    setIssueBatchItemsLoadingId(batch.id);
    try {
      const items = await api.listBankSlipIssueBatchItems(batch.id, { limit: 200 });
      setIssueBatchItems(items.data);
      setIssueBatchItemsById((current) => ({ ...current, [batch.id]: items.data }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar itens do lote");
    } finally {
      setIssueBatchItemsLoadingId("");
    }
  }

  function openCancelIssueBatchDialog(batch: BankSlipIssueBatch) {
    setIssueBatch(batch);
    setBatchDialog({ batch, type: "cancel" });
  }

  function openRetryIssueBatchDialog(batch: BankSlipIssueBatch) {
    if (!canRetryIssueBatches) {
      return;
    }
    setIssueBatch(batch);
    setBatchDialog({ batch, type: "retry" });
  }

  function refreshIssueBatchFromCard(batch: BankSlipIssueBatch) {
    setIssueBatch(batch);
    void refreshIssueBatch(batch.id);
  }

  function clearFilters() {
    setSearch("");
    setAcademicYearId("");
    setInstitutionId("");
    setStatus("");
    setOverdue("all");
    setInvoiceQuickFilter("all");
    setDueDateFrom("");
    setDueDateTo("");
    setPaidAtFrom("");
    setPaidAtTo("");
    setPage(1);
    void loadInvoices("");
  }

  function applyInvoiceQuickFilter(filter: InvoiceQuickFilter) {
    setInvoiceQuickFilter(filter);
    setPage(1);
    if (filter === "open") {
      setStatus("OPEN");
      setOverdue("all");
      setPaidAtFrom("");
      setPaidAtTo("");
    } else if (filter === "overdue") {
      setStatus("OPEN");
      setOverdue("overdue");
      setPaidAtFrom("");
      setPaidAtTo("");
    } else if (filter === "paid") {
      setStatus("PAID");
      setOverdue("all");
      setDueDateFrom("");
      setDueDateTo("");
      setPaidAtFrom(paidAtFrom || defaultMonth.from);
      setPaidAtTo(paidAtTo || defaultMonth.to);
    } else if (filter === "cancelled") {
      setStatus("CANCELLED");
      setOverdue("all");
      setPaidAtFrom("");
      setPaidAtTo("");
    } else if (filter === "dueToday") {
      const today = todayDate();
      setStatus("OPEN");
      setOverdue("all");
      setDueDateFrom(today);
      setDueDateTo(today);
      setPaidAtFrom("");
      setPaidAtTo("");
    } else if (filter === "upcoming") {
      setStatus("OPEN");
      setOverdue("notOverdue");
      setPaidAtFrom("");
      setPaidAtTo("");
    }
  }

  function changeFinanceArea(area: FinanceArea) {
    setFinanceArea(area);
    if (area === "batches") {
      window.setTimeout(() => {
        document.getElementById("finance-batches")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    }
  }

  function changeOverviewPeriod(month: number, year: number) {
    const nextRange = monthRange(year, month);
    setOverviewMonth(month);
    setOverviewYear(year);
    setDueDateFrom(nextRange.from);
    setDueDateTo(nextRange.to);
    setPage(1);
  }

  const invoiceActions = (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      <button
        className={adminTheme.primaryButton}
        onClick={openCreateInvoiceDialog}
        ref={createInvoiceButtonRef}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Nova fatura
      </button>
      {canSyncPaidDay(user) ? (
        <button
          className={adminTheme.secondaryButton}
          disabled={saving}
          onClick={() => setSyncPaidDialogOpen(true)}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Sincronizar liquidados
        </button>
      ) : null}
    </div>
  );

  const financeHeader = (
    <>
      <section className={cx(adminTheme.card, "min-w-0 overflow-hidden p-3 sm:p-4")}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={cx(adminTheme.atretuMark, "grid h-10 w-10 shrink-0 place-items-center rounded-lg")}>
            <Banknote aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#1F6F5F]">
              Administração financeira
            </p>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-bold tracking-normal text-slate-950">
                Financeiro
              </h1>
              <p className="min-w-0 text-sm text-slate-600">
                Faturas, boletos, lotes, movimentações, relatórios e cobrança.
              </p>
            </div>
          </div>
        </div>
      </section>
      <FinanceNavigation
        activeArea={financeArea}
        canViewCollections={canViewCollections}
        onChange={changeFinanceArea}
      />
    </>
  );

  function confirmBankSlipIssue() {
    if (bankSlipDialog?.type !== "issue") {
      return;
    }
    void handleIssueBankSlip(bankSlipDialog.invoice);
  }

  function confirmBankSlipSync() {
    if (bankSlipDialog?.type !== "sync") {
      return;
    }
    void handleSyncBankSlip(bankSlipDialog.invoice);
  }

  function confirmBankSlipCancellation(reason: InvoiceCancellationReason, note: string) {
    if (bankSlipDialog?.type !== "cancel") {
      return;
    }
    void handleCancelBankSlip(bankSlipDialog.invoice, reason, note);
  }

  const batchManagementSection = (
    <section className="grid min-w-0 gap-4" id="finance-batches">
      <BatchSummaryCards summary={batchSummary} />
      <div className={cx(adminTheme.card, "min-w-0 p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={cx(adminTheme.titleText, "text-base")}>
              Emissão em lote
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Crie lotes por instituição ou envie somente faturas selecionadas.
            </p>
          </div>
          <button
            className={adminTheme.secondaryButton}
            disabled={issueBatchDownloadState === "preparing" && Boolean(issueBatchDownloadBatchId)}
            onClick={() => void openIssueBatchDownloadPanel()}
            type="button"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Baixar boletos
          </button>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={cx(adminTheme.softPanel, "grid gap-3 p-4")}>
            <span className="text-xs font-semibold uppercase text-slate-500">
              Lote institucional
            </span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select
                className={adminTheme.control}
                onChange={(event) => {
                  setIssueBatchInstitutionId(event.target.value);
                  setIssueBatchPreview(null);
                }}
                value={issueBatchInstitutionId}
              >
                <option value="">Instituição</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
              <input
                className={adminTheme.control}
                inputMode="decimal"
                onChange={(event) => {
                  setIssueBatchAmount(formatMoneyInput(event.target.value));
                  setIssueBatchPreview(null);
                }}
                placeholder="R$ 150,00"
                value={issueBatchAmount}
              />
              <input
                className={adminTheme.control}
                onChange={(event) => {
                  setIssueBatchDueDate(event.target.value);
                  setIssueBatchPreview(null);
                }}
                type="date"
                value={issueBatchDueDate}
              />
              <button
                className={adminTheme.secondaryButton}
                disabled={saving || !issueBatchInstitutionId || !issueBatchAmount || !issueBatchDueDate}
                onClick={() => void handlePreviewInstitutionIssueBatch()}
                type="button"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                Gerar prévia
              </button>
            </div>
            {issueBatchPreview ? (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <BatchPreviewMetric label="Alunos" value={String(issueBatchPreview.totalStudentsFound)} />
                  <BatchPreviewMetric label="Elegíveis" value={String(issueBatchPreview.totalEligible)} />
                  <BatchPreviewMetric label="Faturas a criar" value={String(issueBatchPreview.totalWillCreateInvoices)} />
                  <BatchPreviewMetric label="Valor previsto" value={issueBatchPreview.eligibleAmountFormatted} />
                </div>
                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <span>Pagas: {issueBatchPreview.totalAlreadyPaid}</span>
                  <span>Boleto ativo: {issueBatchPreview.totalWithActiveBankSlip}</span>
                  <span>Conflito de valor: {issueBatchPreview.totalInvoiceAmountConflict}</span>
                  <span>Cadastro incompleto: {issueBatchPreview.totalIncompleteRequiredAddress}</span>
                </div>
                <button
                  className={adminTheme.primaryButton}
                  disabled={
                    saving ||
                    Boolean(issueBatch && isIssueBatchRunning(issueBatch)) ||
                    issueBatchPreview.totalEligible === 0
                  }
                  onClick={() => void handleCreateInstitutionIssueBatch()}
                  type="button"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  Gerar faturas e emitir
                </button>
              </div>
            ) : null}
          </div>

          <div className={cx(adminTheme.softPanel, "grid content-start gap-3 p-4")}>
            <span className="text-xs font-semibold uppercase text-slate-500">
              Seleção manual
            </span>
            <p className="text-sm text-slate-600">
              Use a barra contextual na lista de faturas para selecionar e emitir boletos em lote.
            </p>
            <button
              className={adminTheme.secondaryButton}
              disabled={saving || selectedInvoiceIds.length === 0}
              onClick={() => setSelectedInvoiceIds([])}
              type="button"
            >
              Limpar seleção ({selectedInvoiceIds.length})
            </button>
          </div>
        </div>
      </div>

      <div className={cx(adminTheme.card, "min-w-0 p-4")}>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Buscar lote
          <input
            className={adminTheme.control}
            onChange={(event) => setIssueBatchSearch(event.target.value)}
            placeholder="Identificação, origem, instituição ou situação"
            type="search"
            value={issueBatchSearch}
          />
        </label>
      </div>

      <BatchList
        batches={filteredIssueBatches}
        busyBatchId={issueBatchActionId || issueBatchDownloadBatchId}
        canRetryBatch={canRetryIssueBatches}
        expandedBatchId={expandedIssueBatchId}
        itemsByBatchId={issueBatchItemsById}
        loading={issueBatchesLoading}
        loadingItemsBatchId={issueBatchItemsLoadingId}
        onCancel={openCancelIssueBatchDialog}
        onDownload={(batch) => void handleDownloadIssueBatchPdfs(batch)}
        onRefresh={refreshIssueBatchFromCard}
        onRetry={openRetryIssueBatchDialog}
        onToggle={(batch) => void toggleIssueBatchDetails(batch)}
      />
    </section>
  );

  if (financeArea === "collections" && canViewCollections) {
    return (
      <div className="grid min-w-0 gap-5">
        {financeHeader}
        <CollectionsPanel
          initialFilters={initialCollectionFilters}
          user={user}
        />
      </div>
    );
  }

  if (financeArea === "movements") {
    return (
      <div className="grid min-w-0 gap-5">
        {financeHeader}
        <ManualMovementsPanel />
      </div>
    );
  }

  if (financeArea === "reports") {
    return (
      <div className="grid min-w-0 gap-5">
        {financeHeader}
        <FinancialReportsPanel user={user} />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      {financeHeader}
      <BankSlipDialog
        dialog={bankSlipDialog}
        onClose={() => {
          if (!bankSlipAction) {
            setBankSlipDialog(null);
          }
        }}
        onConfirmCancel={confirmBankSlipCancellation}
        onConfirmIssue={confirmBankSlipIssue}
        onConfirmSync={confirmBankSlipSync}
        reasonOptions={invoiceCancellationOptions}
        saving={Boolean(bankSlipAction)}
      />
      {invoiceActionDialog ? (
        <StudentFinanceActionDialog
          invoice={invoiceActionDialog.invoice}
          mode={invoiceActionDialog.mode}
          onClose={() => setInvoiceActionDialog(null)}
          onConfirm={(reason, note) =>
            void handleCancel(invoiceActionDialog.invoice, reason, note)
          }
          saving={saving}
        />
      ) : null}
      {syncPaidDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-6">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
                  Financeiro
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Sincronizar liquidados
                </h2>
              </div>
              <button
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                disabled={saving}
                onClick={() => setSyncPaidDialogOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-700">
              Confirmar sincronização de boletos liquidados em {formatDate(syncPaidDate)}.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                disabled={saving}
                onClick={() => setSyncPaidDialogOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-[#1F6F5F] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                disabled={saving}
                onClick={() => void handleSyncPaidDay()}
                type="button"
              >
                Sincronizar
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <BatchDialog
        dialog={batchDialog}
        onClose={() => {
          if (!saving) {
            setBatchDialog(null);
          }
        }}
        onConfirmCancel={confirmCancelIssueBatch}
        onConfirmCreateInstitution={confirmCreateInstitutionIssueBatch}
        onConfirmCreateManual={confirmCreateIssueBatch}
        onConfirmRetry={confirmRetryIssueBatch}
        saving={saving}
      />
      {createInvoiceDialogOpen ? (
        <div
          aria-labelledby="create-invoice-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
          role="dialog"
        >
          <form
            className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-[960px] sm:rounded-2xl"
            onSubmit={handleCreate}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
                  Faturas
                </p>
                <h2
                  className="mt-1 text-lg font-bold text-slate-950 sm:text-xl"
                  id="create-invoice-dialog-title"
                >
                  Nova fatura
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Busque o acadêmico, revise a matrícula e crie a fatura sem alterar regras financeiras.
                </p>
              </div>
              <button
                aria-label="Fechar nova fatura"
                className={adminTheme.iconButton}
                disabled={saving}
                onClick={closeCreateInvoiceDialog}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {error ? (
                <p className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                <section className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-950">
                    Selecionar acadêmico
                  </h3>
                  <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Buscar acadêmico</span>
                      <input
                        className={cx(adminTheme.control, "w-full min-w-0")}
                        onChange={(event) => {
                          setStudentSearch(event.target.value);
                          setPreview(null);
                        }}
                        placeholder="Nome, CPF ou carteirinha"
                        ref={studentSearchInputRef}
                        type="search"
                        value={studentSearch}
                      />
                    </label>
                    <button
                      className={cx(adminTheme.primaryButton, "justify-center sm:w-auto")}
                      onClick={() => void searchStudents(studentSearch)}
                      type="button"
                    >
                      <Search aria-hidden="true" className="h-4 w-4" />
                      Buscar
                    </button>
                  </div>

                  <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                    {students.length === 0 ? (
                      <div className={cx(adminTheme.softPanel, "p-3 text-sm text-slate-600")}>
                        Nenhum acadêmico carregado. Faça uma busca para iniciar.
                      </div>
                    ) : null}
                    {students.map((student) => {
                      const selected = selectedStudent?.id === student.id;
                      return (
                        <button
                          className={cx(
                            "rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15",
                            selected
                              ? "border-[#1F6F5F] bg-[#F2F8F6]"
                              : "border-slate-200 bg-white",
                          )}
                          key={student.id}
                          onClick={() => void selectStudent(student.id)}
                          type="button"
                        >
                          <span className="block font-medium text-slate-950">
                            {student.person.fullName}
                          </span>
                          <span className="mt-1 block text-xs text-slate-600">
                            CPF {student.person.cpfMasked} · Carteirinha{" "}
                            {student.currentStudentCard?.cardNumber ?? "sem número ativo"}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {student.currentEnrollment
                              ? `${student.currentEnrollment.academicYear.year} · ${student.currentEnrollment.institution.name}`
                              : "Sem matrícula atual"}
                          </span>
                          {!student.canReceiveFutureInvoices ? (
                            <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              Exige revisão de elegibilidade
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-950">
                    Dados e revisão
                  </h3>
                  {selectedStudent ? (
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className={cx(adminTheme.softPanel, "p-3")}>
                        <p className="font-semibold text-slate-950">
                          {selectedStudent.person.fullName}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          CPF {maskCpf(selectedStudent.person.cpf)}
                        </p>
                        {!selectedStudent.canReceiveFutureInvoices ? (
                          <p className="mt-2 text-xs font-semibold text-amber-700">
                            Este acadêmico possui regra de elegibilidade que pode impedir nova fatura. Gere a revisão para ver o motivo.
                          </p>
                        ) : null}
                      </div>

                      <label className="grid gap-1 font-medium text-slate-700">
                        Matrícula/ano letivo
                        <select
                          className={cx(adminTheme.control, "w-full min-w-0")}
                          onChange={(event) => {
                            setInvoiceEnrollmentId(event.target.value);
                            setPreview(null);
                          }}
                          required
                          value={invoiceEnrollmentId}
                        >
                          <option value="">Selecione uma matrícula</option>
                          {selectedStudent.enrollments.map((enrollment) => (
                            <option key={enrollment.id} value={enrollment.id}>
                              {enrollment.academicYear.year} - {enrollment.institution.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                        <label className="grid gap-1 font-medium text-slate-700">
                          Valor
                          <input
                            className={cx(adminTheme.control, "w-full min-w-0")}
                            inputMode="decimal"
                            onChange={(event) => {
                              setAmount(event.target.value);
                              setPreview(null);
                            }}
                            placeholder="Ex.: 150,00"
                            required
                            value={amount}
                          />
                        </label>
                        <label className="grid gap-1 font-medium text-slate-700">
                          Vencimento
                          <input
                            className={cx(adminTheme.control, "w-full min-w-0")}
                            onChange={(event) => {
                              setDueDate(event.target.value);
                              setPreview(null);
                            }}
                            required
                            type="date"
                            value={dueDate}
                          />
                        </label>
                      </div>

                      <label className="grid gap-1 font-medium text-slate-700">
                        Descrição opcional
                        <input
                          className={cx(adminTheme.control, "w-full min-w-0")}
                          maxLength={300}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="Ex.: Mensalidade de agosto"
                          value={description}
                        />
                      </label>

                      <div className={cx(adminTheme.softPanel, "grid gap-1 p-3 text-xs text-slate-600")}>
                        <p className="font-semibold text-slate-950">Resumo</p>
                        <p>Acadêmico: {selectedStudent.person.fullName}</p>
                        <p>
                          Matrícula:{" "}
                          {selectedInvoiceEnrollment
                            ? `${selectedInvoiceEnrollment.academicYear.year} - ${selectedInvoiceEnrollment.institution.name}`
                            : "não selecionada"}
                        </p>
                        <p>
                          Valor:{" "}
                          {typeof invoiceAmountCents === "number"
                            ? formatCents(invoiceAmountCents)
                            : "não informado"}
                        </p>
                        <p>Vencimento: {dueDate ? formatDate(dueDate) : "não informado"}</p>
                      </div>

                      <button
                        className={adminTheme.secondaryButton}
                        disabled={!isInvoiceFormValid || saving}
                        onClick={() => void handlePreview()}
                        type="button"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Revisar fatura
                      </button>
                      {preview ? <InvoicePreviewBox preview={preview} /> : null}
                    </div>
                  ) : (
                    <div className={cx(adminTheme.softPanel, "mt-3 p-4 text-sm text-slate-600")}>
                      Selecione um acadêmico nos resultados para preencher a fatura.
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                className={adminTheme.secondaryButton}
                disabled={saving}
                onClick={closeCreateInvoiceDialog}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={adminTheme.primaryButton}
                disabled={!canSubmitInvoice || saving}
                type="submit"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {saving ? "Criando..." : "Criar fatura"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {financeArea === "overview" ? (
        <>
          <FinanceAreaHeader
            description="Resumo operacional de faturas, boletos e cobrança com base em dados persistidos."
            title="Visão geral financeira"
          />
          {overviewError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {overviewError}
            </div>
          ) : null}
          <FinanceSummaryCards
            collectionError={collectionError}
            collectionLoading={collectionLoading}
            collectionSummary={canViewCollections ? collectionSummary : null}
            loading={loading}
            monthlyEvolution={monthlyOverview}
            onNavigate={changeFinanceArea}
            onPeriodChange={changeOverviewPeriod}
            onRefreshOverview={() => void loadOverviewData()}
            overviewLoading={overviewLoading}
            periodMonth={overviewMonth}
            periodYear={overviewYear}
            situationBreakdown={situationBreakdown}
            summary={financeSummary}
          />
        </>
      ) : null}
      {financeArea === "invoices" ? (
        <>
          <FinanceAreaHeader
            actions={invoiceActions}
            description="Cadastre faturas, acompanhe boletos e faça a conciliação de liquidados."
            title="Faturas e boletos"
          />
          <InvoiceOperationalSummaryCards
            activeFilter={invoiceQuickFilter}
            onSelect={applyInvoiceQuickFilter}
            summary={invoiceOperationalSummary}
          />
          <FinanceFilters
            academicYearId={academicYearId}
            dueDateFrom={dueDateFrom}
            dueDateTo={dueDateTo}
            hasActiveFilters={hasActiveFilters}
            institutionId={institutionId}
            institutions={institutions}
            loading={loading}
            onClear={clearFilters}
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void loadInvoices(search);
            }}
            overdue={overdue}
            paidAtFrom={paidAtFrom}
            paidAtTo={paidAtTo}
            search={search}
            setAcademicYearId={(value) => {
              setAcademicYearId(value);
              setPage(1);
            }}
            setDueDateFrom={(value) => {
              setDueDateFrom(value);
              setPage(1);
            }}
            setDueDateTo={(value) => {
              setDueDateTo(value);
              setPage(1);
            }}
            setInstitutionId={(value) => {
              setInstitutionId(value);
              setPage(1);
            }}
            setOverdue={(value) => {
              setOverdue(value);
              setPage(1);
            }}
            setPaidAtFrom={(value) => {
              setPaidAtFrom(value);
              setPage(1);
            }}
            setPaidAtTo={(value) => {
              setPaidAtTo(value);
              setPage(1);
            }}
            setSearch={setSearch}
            setStatus={(value) => {
              setStatus(value);
              setPage(1);
            }}
            status={status}
            years={years}
          />
          <InvoiceActiveFilterChips
            academicYearId={academicYearId}
            dueDateFrom={dueDateFrom}
            dueDateTo={dueDateTo}
            institutionId={institutionId}
            institutions={institutions}
            onClear={clearFilters}
            overdue={overdue}
            paidAtFrom={paidAtFrom}
            paidAtTo={paidAtTo}
            quickFilter={invoiceQuickFilter}
            search={search}
            status={status}
            years={years}
          />
          <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
            <div className="border-b border-slate-200/80 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Fila de faturas</h2>
                  <p className="text-sm text-slate-600">
                    Itens desta página ordenados por atenção operacional.
                  </p>
                </div>
              </div>
            </div>

            {canSyncPaidDay(user) ? (
              <div className="mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-medium uppercase text-slate-500">
                  Conciliação
                </span>
                <input
                  className={adminTheme.control}
                  onChange={(event) => setSyncPaidDate(event.target.value)}
                  type="date"
                  value={syncPaidDate}
                />
                <button
                  className={adminTheme.secondaryButton}
                  disabled={saving}
                  onClick={() => setSyncPaidDialogOpen(true)}
                  type="button"
                >
                  Sincronizar liquidados
                </button>
                {syncPaidSummary ? (
                  <span className="text-xs text-slate-600">{syncPaidSummary}</span>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <p className="mx-4 mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mx-4 mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {invoiceLoadError ? (
              <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-800">
                  Erro ao carregar faturas
                </p>
                <p className="mt-1 text-sm text-red-700">{invoiceLoadError}</p>
              </div>
            ) : null}

            <div className="mt-4 px-4">
              <InvoiceBulkActionBar
                disabled={saving || loading}
                onClear={() => setSelectedInvoiceIds([])}
                onCreateBatch={() => void handleCreateIssueBatch()}
                onSelectEligible={selectAllEligibleInvoices}
                selectedCount={selectedInvoiceIds.length}
              />
            </div>

            <div className="mt-3 px-4">
              <InvoiceList
                bankSlipAction={bankSlipAction}
                bankSlips={bankSlips}
                canCancelInvoice={canCancelInvoiceDirectly}
                canCancelSlip={canRequestBankSlipCancellation}
                canDownloadPdf={canDownloadBankSlipPdf}
                canIssue={canIssueBankSlip}
                expandedInvoiceId={expandedInvoiceId}
                hasActiveFilters={hasActiveFilters}
                invoices={visibleInvoices}
                loading={loading}
                onCancelInvoice={(invoice) =>
                  setInvoiceActionDialog({ invoice, mode: "cancel-invoice" })
                }
                onCancelSlip={openCancelBankSlipDialog}
                onCopy={(invoiceId) => void handleCopyLinhaDigitavel(invoiceId)}
                onIssue={openIssueBankSlipDialog}
                onPdf={(invoice) => void handleDownloadPdf(invoice)}
                onSelect={toggleInvoiceSelection}
                onSync={openSyncBankSlipDialog}
                onToggleDetails={(invoice) => void toggleBankSlipDetails(invoice)}
                onViewError={(invoice) => void openBankSlipErrorDialog(invoice)}
                saving={saving}
                selectedInvoiceIds={selectedInvoiceIds}
              />
            </div>
            <Pagination page={page} setPage={setPage} totalPages={totalPages} />
          </section>
        </>
      ) : null}
      {financeArea === "batches" ? batchManagementSection : null}

      {issueBatchDownloadPanelOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40">
          <div className="ml-auto flex h-full w-full max-w-6xl flex-col bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Baixar boletos
                </h2>
                <p className="text-sm text-slate-600">
                  Lotes de boletos gerados por instituicao
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                  disabled={issueBatchDownloadLoading}
                  onClick={() => void loadIssueBatchDownloadBatches()}
                  type="button"
                >
                  Atualizar
                </button>
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  onClick={() => setIssueBatchDownloadPanelOpen(false)}
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="grid gap-3 border-b border-slate-200 px-5 py-4">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setIssueBatchDownloadSearch(event.target.value)}
                placeholder="Pesquisar por instituicao, competencia ou data"
                type="search"
                value={issueBatchDownloadSearch}
              />
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                <span>Total de lotes: {issueBatchDownloadBatches.length}</span>
                <span>Resultado da busca: {filteredIssueBatchDownloads.length}</span>
                {issueBatchDownloadSummary ? <span>{issueBatchDownloadSummary}</span> : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <BatchList
                batches={filteredIssueBatchDownloads}
                busyBatchId={issueBatchActionId || issueBatchDownloadBatchId}
                canRetryBatch={canRetryIssueBatches}
                emptyText="Nenhum lote institucional encontrado."
                expandedBatchId={expandedIssueBatchId}
                itemsByBatchId={issueBatchItemsById}
                loading={issueBatchDownloadLoading}
                loadingItemsBatchId={issueBatchItemsLoadingId}
                onCancel={openCancelIssueBatchDialog}
                onDownload={(batch) => void handleDownloadIssueBatchPdfs(batch)}
                onRefresh={refreshIssueBatchFromCard}
                onRetry={openRetryIssueBatchDialog}
                onToggle={(batch) => void toggleIssueBatchDetails(batch)}
                title="Lotes disponíveis para download"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StudentInvoicesForStudent({
  student,
  user,
  onChanged,
}: {
  student: StudentDetail;
  user: ApiUser;
  onChanged: () => Promise<void>;
}) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [bankSlips, setBankSlips] = useState<
    Record<string, BankSlipListRecord | null | undefined>
  >({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState("");
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(student.enrollments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayDate());
  const [description, setDescription] = useState("");
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [legacyFinancialHistory, setLegacyFinancialHistory] =
    useState<LegacyFinancialHistoryResponse | null>(null);
  const [legacyFinancialLoading, setLegacyFinancialLoading] = useState(true);
  const [legacyFinancialPage, setLegacyFinancialPage] = useState(1);
  const [legacyFinancialStatus, setLegacyFinancialStatus] =
    useState<LegacyFinancialHistoryRecord["status"] | "">("");
  const [legacyFinancialYear, setLegacyFinancialYear] = useState<number | "">("");
  const [legacyFinancialOrder, setLegacyFinancialOrder] = useState<"asc" | "desc">(
    "desc",
  );
  const [expandedLegacyFinancialId, setExpandedLegacyFinancialId] = useState("");
  const [saving, setSaving] = useState(false);
  const issueBankSlipInFlightRef = useRef("");
  const [dialog, setDialog] = useState<{
    invoice: InvoiceRecord;
    mode: "cancel-invoice" | "issue-slip" | "cancel-slip";
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadInvoices();
  }, [student.id]);

  useEffect(() => {
    setLegacyFinancialPage(1);
    setExpandedLegacyFinancialId("");
  }, [student.id]);

  useEffect(() => {
    void loadLegacyFinancialHistory();
  }, [
    student.id,
    legacyFinancialPage,
    legacyFinancialStatus,
    legacyFinancialYear,
    legacyFinancialOrder,
  ]);

  async function loadInvoices() {
    setError("");
    setLoadingInvoices(true);
    try {
      const response = await api.listInvoicesForStudent(student.id);
      setInvoices(response.data);
      setBankSlips((current) => mergeBankSlipSummaries(response.data, current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar faturas");
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function loadLegacyFinancialHistory() {
    setLegacyFinancialLoading(true);
    try {
      const response = await api.listStudentLegacyFinancialHistory(student.id, {
        page: legacyFinancialPage,
        limit: LEGACY_FINANCIAL_PAGE_SIZE,
        status: legacyFinancialStatus,
        year: legacyFinancialYear,
        order: legacyFinancialOrder,
      });
      setLegacyFinancialHistory(response);
      if (
        response.pagination.totalPages > 0 &&
        legacyFinancialPage > response.pagination.totalPages
      ) {
        setLegacyFinancialPage(response.pagination.totalPages);
      }
    } catch (caught) {
      setLegacyFinancialHistory(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao carregar historico financeiro legado",
      );
    } finally {
      setLegacyFinancialLoading(false);
    }
  }

  function updateBankSlip(
    invoiceId: string,
    bankSlip: BankSlipListRecord | null | undefined,
  ) {
    setBankSlips((current) => ({ ...current, [invoiceId]: bankSlip }));
  }

  async function loadFullBankSlip(invoice: InvoiceRecord) {
    const current = bankSlips[invoice.id];
    if (!current || isFullBankSlip(current)) {
      return current;
    }
    updateBankSlip(invoice.id, undefined);
    try {
      const bankSlip = await api.getInvoiceBankSlip(invoice.id);
      updateBankSlip(invoice.id, bankSlip);
      return bankSlip;
    } catch (caught) {
      updateBankSlip(invoice.id, invoice.bankSlipSummary);
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar detalhe do boleto",
      );
      return invoice.bankSlipSummary;
    }
  }

  async function toggleBankSlipDetails(invoice: InvoiceRecord) {
    const willExpand = expandedInvoiceId !== invoice.id;
    setExpandedInvoiceId(willExpand ? invoice.id : "");
    if (willExpand) {
      await loadFullBankSlip(invoice);
    }
  }

  async function handlePreview() {
    if (!enrollmentId) {
      setError("Selecione uma matrícula");
      return;
    }
    setError("");
    try {
      const response = await api.previewInvoice(student.id, { enrollmentId });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao visualizar prévia");
    }
  }

  async function handleCreate() {
    if (!enrollmentId) {
      setError("Selecione uma matrícula");
      return;
    }
    let amountCents: number;
    try {
      amountCents = parseMoneyToCents(amount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Valor inválido");
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
      setCreateFormOpen(false);
      await loadInvoices();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao criar fatura");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(
    invoice: InvoiceRecord,
    reason: InvoiceCancellationReason,
    note: string,
  ) {
    if (!reason) {
      setError("Selecione um motivo válido para cancelar a fatura.");
      return;
    }
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
      setDialog(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssueBankSlip(invoice: InvoiceRecord) {
    if (issueBankSlipInFlightRef.current) {
      return;
    }
    issueBankSlipInFlightRef.current = invoice.id;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const bankSlip = await api.issueInvoiceBankSlip(invoice.id);
      updateBankSlip(invoice.id, bankSlip);
      setExpandedInvoiceId(invoice.id);
      setMessage("Boleto emitido");
      await loadInvoices();
      await onChanged();
      setDialog(null);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Erro ao emitir boleto";
      setError(
        text.includes("incerto") || text.includes("confirmar")
          ? "O sistema não conseguiu confirmar se o boleto foi criado no Sicredi. Não tente emitir novamente. Use a consulta de situação ou procure o administrador."
          : text,
      );
      if (shouldReloadInvoicesAfterIssueError(caught)) {
        await loadInvoices();
        await onChanged();
      } else {
        await loadInvoices();
      }
    } finally {
      setSaving(false);
      issueBankSlipInFlightRef.current = "";
    }
  }

  async function handleSyncBankSlip(invoice: InvoiceRecord) {
    const previous = bankSlips[invoice.id]?.status;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const bankSlip = await api.syncInvoiceBankSlip(invoice.id);
      updateBankSlip(invoice.id, bankSlip);
      setExpandedInvoiceId(invoice.id);
      setMessage(syncResultMessage(previous, bankSlip.status));
      await loadInvoices();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao consultar boleto");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelBankSlip(
    invoice: InvoiceRecord,
    reason: InvoiceCancellationReason,
    note: string,
  ) {
    if (!reason) {
      setError("Selecione um motivo válido para solicitar a baixa do boleto.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const bankSlip = await api.cancelInvoiceBankSlip(invoice.id, {
        reason,
        note: emptyToUndefined(note),
      });
      updateBankSlip(invoice.id, bankSlip);
      setExpandedInvoiceId(invoice.id);
      setMessage("Baixa solicitada. Aguarde confirmação bancária.");
      setDialog(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao solicitar baixa");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf(invoice: InvoiceRecord) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await api.downloadInvoiceBankSlipPdf(invoice.id);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeBankSlipFileName(result.fileName, invoice.id);
      link.click();
      URL.revokeObjectURL(url);
      setMessage("PDF do boleto baixado");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PDF indisponível");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLinhaDigitavel(invoiceId: string) {
    const bankSlip = bankSlips[invoiceId];
    const line = isFullBankSlip(bankSlip) ? bankSlip.linhaDigitavel : undefined;
    if (!line) {
      return;
    }
    try {
      await navigator.clipboard.writeText(line);
      setMessage("Linha digitável copiada");
    } catch {
      setError("Não foi possível copiar a linha digitável");
    }
  }

  const summary = useMemo(() => studentFinanceSummary(invoices), [invoices]);
  const amountCents = parseMoneyToCentsSafe(amount);
  const hasEligibleEnrollment = student.enrollments.length > 0;
  const isCreateFormValid =
    Boolean(enrollmentId) && typeof amountCents === "number" && amountCents > 0 && Boolean(dueDate);
  const selectedEnrollment = student.enrollments.find(
    (enrollment) => enrollment.id === enrollmentId,
  );
  const dueDateLabel = dueDate ? formatDate(dueDate) : "";

  return (
    <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Financeiro do acadêmico</h3>
          <p className="mt-1 text-xs text-slate-500">
            Faturas, boletos e situação financeira vinculados às matrículas.
          </p>
        </div>
        <button
          className={adminTheme.primaryButton}
          onClick={() => {
            setCreateFormOpen((current) => !current);
            setPreview(null);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {createFormOpen ? "Fechar formulário" : "Nova fatura"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StudentFinanceSummaryItem
          label="Total em aberto"
          tone="open"
          value={formatCents(summary.openAmountCents)}
        />
        <StudentFinanceSummaryItem
          label="Total vencido"
          tone="overdue"
          value={formatCents(summary.overdueAmountCents)}
        />
        <StudentFinanceSummaryItem
          label="Total pago"
          tone="paid"
          value={formatCents(summary.paidAmountCents)}
        />
        <StudentFinanceSummaryItem
          label="Faturas"
          tone="neutral"
          value={String(summary.totalInvoices)}
        />
        <StudentFinanceSummaryItem
          label="Situação financeira"
          tone={summary.overdueAmountCents > 0 ? "overdue" : "neutral"}
          value={summary.situation}
        />
      </div>

      {createFormOpen ? (
        <div className={cx(adminTheme.card, "p-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-950">Criar nova fatura</h4>
              <p className="mt-1 text-xs text-slate-500">
                Informe os dados da cobrança antes de visualizar a prévia.
              </p>
            </div>
            {!hasEligibleEnrollment ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                Nenhuma matrícula elegível
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Matrícula/ano letivo
              <select
                className={adminTheme.control}
                onChange={(event) => {
                  setEnrollmentId(event.target.value);
                  setPreview(null);
                }}
                value={enrollmentId}
              >
                <option value="">Selecione uma matrícula</option>
                {student.enrollments.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.id}>
                    {enrollment.academicYear.year} - {enrollment.institution.name}
                  </option>
                ))}
              </select>
              {!enrollmentId ? (
                <span className="text-xs font-normal text-amber-700">
                  Selecione a matrícula que receberá a fatura.
                </span>
              ) : null}
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Valor
              <input
                className={adminTheme.control}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Ex.: 150,00"
                value={amount}
              />
              {amount ? (
                <span
                  className={cx(
                    "text-xs font-normal",
                    typeof amountCents === "number" && amountCents > 0
                      ? "text-slate-500"
                      : "text-red-700",
                  )}
                >
                  {typeof amountCents === "number" && amountCents > 0
                    ? `Valor em reais: ${formatCents(amountCents)}`
                    : "Informe um valor válido em reais."}
                </span>
              ) : (
                <span className="text-xs font-normal text-slate-500">
                  Use vírgula ou ponto para centavos.
                </span>
              )}
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Vencimento
              <input
                className={adminTheme.control}
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
              {dueDateLabel ? (
                <span className="text-xs font-normal text-slate-500">
                  Data selecionada: {dueDateLabel}
                </span>
              ) : (
                <span className="text-xs font-normal text-red-700">
                  Informe o vencimento da fatura.
                </span>
              )}
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Descrição opcional
              <input
                className={adminTheme.control}
                maxLength={300}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ex.: Mensalidade de julho"
                value={description}
              />
              <span className="text-xs font-normal text-slate-500">
                Aparece no card e nos detalhes da fatura.
              </span>
            </label>
          </div>

          {selectedEnrollment ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Matrícula selecionada: {selectedEnrollment.academicYear.year} -{" "}
              {selectedEnrollment.institution.name}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={adminTheme.secondaryButton}
              disabled={!enrollmentId || saving}
              onClick={() => void handlePreview()}
              type="button"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              Visualizar prévia
            </button>
            <button
              className={adminTheme.primaryButton}
              disabled={!isCreateFormValid || saving}
              onClick={() => void handleCreate()}
              type="button"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {saving ? "Criando..." : "Criar fatura"}
            </button>
          </div>
          {preview ? <InvoicePreviewBox preview={preview} /> : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-950">Faturas</h4>
          {loadingInvoices ? (
            <span className="text-xs font-medium text-slate-500">Carregando faturas...</span>
          ) : null}
        </div>

        {loadingInvoices && invoices.length === 0 ? (
          <div className={cx(adminTheme.softPanel, "p-4 text-sm text-slate-600")}>
            Carregando faturas do acadêmico...
          </div>
        ) : invoices.length === 0 ? (
          <div className={cx(adminTheme.card, "grid gap-3 p-5 text-sm text-slate-600")}>
            <div>
              <p className="font-semibold text-slate-950">Nenhuma fatura criada</p>
              <p className="mt-1 text-slate-500">
                Crie a primeira fatura quando houver uma matrícula elegível.
              </p>
            </div>
            <button
              className={adminTheme.primaryButton}
              onClick={() => setCreateFormOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar primeira fatura
            </button>
          </div>
        ) : (
          invoices.map((invoice) => {
            const bankSlip = bankSlips[invoice.id];
            return (
              <StudentInvoiceCard
                bankSlip={bankSlip}
                busy={saving}
                expanded={expandedInvoiceId === invoice.id}
                invoice={invoice}
                onCancelInvoice={() => setDialog({ invoice, mode: "cancel-invoice" })}
                onCancelSlip={() => setDialog({ invoice, mode: "cancel-slip" })}
                onCopy={() => void handleCopyLinhaDigitavel(invoice.id)}
                onIssue={() => setDialog({ invoice, mode: "issue-slip" })}
                onPdf={() => void handleDownloadPdf(invoice)}
                onSync={() => void handleSyncBankSlip(invoice)}
                onToggleDetails={() => void toggleBankSlipDetails(invoice)}
                key={invoice.id}
              />
            );
          })
        )}
      </div>
      <LegacyFinancialHistorySection
        expandedRecordId={expandedLegacyFinancialId}
        loading={legacyFinancialLoading}
        onOrderChange={(nextOrder) => {
          setLegacyFinancialOrder(nextOrder);
          setLegacyFinancialPage(1);
          setExpandedLegacyFinancialId("");
        }}
        onPageChange={setLegacyFinancialPage}
        onStatusChange={(nextStatus) => {
          setLegacyFinancialStatus(nextStatus);
          setLegacyFinancialPage(1);
          setExpandedLegacyFinancialId("");
        }}
        onToggleDetails={(recordId) =>
          setExpandedLegacyFinancialId((current) =>
            current === recordId ? "" : recordId,
          )
        }
        onYearChange={(nextYear) => {
          setLegacyFinancialYear(nextYear);
          setLegacyFinancialPage(1);
          setExpandedLegacyFinancialId("");
        }}
        order={legacyFinancialOrder}
        pageSize={LEGACY_FINANCIAL_PAGE_SIZE}
        response={legacyFinancialHistory}
        status={legacyFinancialStatus}
        year={legacyFinancialYear}
      />
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {dialog ? (
        <StudentFinanceActionDialog
          invoice={dialog.invoice}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onConfirm={(reason, note) => {
            if (dialog.mode === "cancel-invoice") {
              void handleCancel(dialog.invoice, reason, note);
            } else if (dialog.mode === "cancel-slip") {
              void handleCancelBankSlip(dialog.invoice, reason, note);
            } else {
              void handleIssueBankSlip(dialog.invoice);
            }
          }}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function StudentFinanceSummaryItem({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "neutral" | "open" | "overdue" | "paid";
  value: string;
}) {
  const toneClass = {
    neutral: "border-slate-200 bg-white text-slate-950",
    open: "border-sky-100 bg-sky-50 text-sky-800",
    overdue: "border-red-100 bg-red-50 text-red-800",
    paid: "border-emerald-100 bg-emerald-50 text-emerald-800",
  }[tone];
  return (
    <div className={cx("rounded-xl border px-3 py-3", toneClass)}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-base font-semibold">{value}</p>
    </div>
  );
}

function LegacyFinancialHistorySection({
  expandedRecordId,
  loading,
  onOrderChange,
  onPageChange,
  onStatusChange,
  onToggleDetails,
  onYearChange,
  order,
  pageSize,
  response,
  status,
  year,
}: {
  expandedRecordId: string;
  loading: boolean;
  onOrderChange: (order: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onStatusChange: (status: LegacyFinancialHistoryRecord["status"] | "") => void;
  onToggleDetails: (recordId: string) => void;
  onYearChange: (year: number | "") => void;
  order: "asc" | "desc";
  pageSize: number;
  response: LegacyFinancialHistoryResponse | null;
  status: LegacyFinancialHistoryRecord["status"] | "";
  year: number | "";
}) {
  const records = response?.data ?? [];
  const summary = response?.summary ?? emptyLegacyFinancialSummary();
  const pagination = response?.pagination ?? {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0,
  };
  const totalPages = Math.max(pagination.totalPages, 1);
  const firstVisible =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastVisible = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <section className="grid gap-3 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">
            Histórico financeiro legado
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Somente leitura. Sem ações Sicredi para registros legados.
          </p>
        </div>
        {loading ? (
          <span className="text-xs font-medium text-slate-500">
            Carregando historico...
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        <LegacyFinancialSummaryItem label="Total" value={String(summary.totalRecords)} />
        <LegacyFinancialSummaryItem label="Pagos" value={String(summary.byStatus.PAGO)} />
        <LegacyFinancialSummaryItem label="Baixados" value={String(summary.byStatus.BAIXADO)} />
        <LegacyFinancialSummaryItem label="Pendentes" value={String(summary.byStatus.PENDENTE)} />
        <LegacyFinancialSummaryItem label="Vencidos" value={String(summary.byStatus.VENCIDO)} />
        <LegacyFinancialSummaryItem label="Nominal" value={formatCents(summary.nominalAmountCents)} />
        <LegacyFinancialSummaryItem label="Pago" value={formatCents(summary.paidAmountCents)} />
      </div>

      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Status
          <select
            className={adminTheme.control}
            onChange={(event) =>
              onStatusChange(event.target.value as LegacyFinancialHistoryRecord["status"] | "")
            }
            value={status}
          >
            <option value="">Todos</option>
            <option value="PAGO">Pago</option>
            <option value="BAIXADO">Baixado</option>
            <option value="PENDENTE">Pendente</option>
            <option value="VENCIDO">Vencido</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Ano
          <select
            className={adminTheme.control}
            onChange={(event) =>
              onYearChange(event.target.value ? Number(event.target.value) : "")
            }
            value={year}
          >
            <option value="">Todos</option>
            {summary.years.map((availableYear) => (
              <option key={availableYear} value={availableYear}>
                {availableYear}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Ordem
          <select
            className={adminTheme.control}
            onChange={(event) => onOrderChange(event.target.value as "asc" | "desc")}
            value={order}
          >
            <option value="desc">Mais recente primeiro</option>
            <option value="asc">Mais antigo primeiro</option>
          </select>
        </label>
      </div>

      {records.length === 0 ? (
        <div className={cx(adminTheme.softPanel, "p-4 text-sm text-slate-600")}>
          {loading
            ? "Carregando historico financeiro legado..."
            : "Nenhum histórico financeiro legado encontrado."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid gap-0 divide-y divide-slate-100">
            {records.map((record) => (
              <LegacyFinancialHistoryRow
                expanded={expandedRecordId === record.id}
                key={record.id}
                onToggleDetails={() => onToggleDetails(record.id)}
                record={record}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-3 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
            <span>
              Pagina {pagination.page} de {totalPages} · Exibindo {firstVisible}-{lastVisible} de {pagination.total}
            </span>
            <div className="flex gap-2">
              <button
                className={adminTheme.secondaryButton}
                disabled={loading || pagination.page <= 1}
                onClick={() => onPageChange(Math.max(pagination.page - 1, 1))}
                type="button"
              >
                Anterior
              </button>
              <button
                className={adminTheme.secondaryButton}
                disabled={loading || pagination.page >= totalPages}
                onClick={() => onPageChange(Math.min(pagination.page + 1, totalPages))}
                type="button"
              >
                Proxima
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function LegacyFinancialSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function LegacyFinancialHistoryRow({
  expanded,
  onToggleDetails,
  record,
}: {
  expanded: boolean;
  onToggleDetails: () => void;
  record: LegacyFinancialHistoryRecord;
}) {
  const paidValue =
    record.paidAmountCents === null || record.paidAmountCents === undefined
      ? "-"
      : formatCents(record.paidAmountCents);

  return (
    <article className="min-w-0 bg-white px-3 py-3 text-sm">
      <div className="grid min-w-0 gap-2 md:grid-cols-[7rem_8rem_8rem_8rem_9rem_auto] md:items-center">
        <span className="font-medium text-slate-900">
          {formatOptionalDate(record.dueDate)}
        </span>
        <span className={legacyFinancialStatusBadgeClass(record.status)}>
          {legacyFinancialStatusLabel(record.status)}
        </span>
        <span className="text-slate-700">{formatCents(record.nominalAmountCents)}</span>
        <span className="text-slate-700">{paidValue}</span>
        <span className="text-slate-500">
          {record.paidAt ? `Pago ${formatDate(record.paidAt)}` : "Pagamento -"}
        </span>
        <button
          className="justify-self-start rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 md:justify-self-end"
          onClick={onToggleDetails}
          type="button"
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      </div>
      {expanded ? <LegacyFinancialHistoryDetails record={record} /> : null}
    </article>
  );
}

function LegacyFinancialHistoryDetails({
  record,
}: {
  record: LegacyFinancialHistoryRecord;
}) {
  return (
    <div className="mt-3 grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-2 xl:grid-cols-4">
      <StudentInvoiceField
        label="ID financeiro legado"
        value={String(record.legacyFinancialId)}
      />
      <StudentInvoiceField label="Multa" value={formatCents(record.fineAmountCents)} />
      <StudentInvoiceField label="Juros" value={formatCents(record.interestAmountCents)} />
      <StudentInvoiceField
        label="Nosso número"
        value={record.nossoNumero?.trim() || "-"}
      />
      <StudentInvoiceField
        label="Linha digitável"
        valueClassName="break-all"
        value={record.linhaDigitavel?.trim() || "-"}
      />
      <StudentInvoiceField
        label="Código de barras"
        valueClassName="break-all"
        value={record.codigoBarras?.trim() || "-"}
      />
      <StudentInvoiceField
        label="Caminho legado do boleto"
        valueClassName="break-all"
        value={record.boletoPath?.trim() || "-"}
      />
      <StudentInvoiceField label="Origem" value="Sistema legado" />
      <p className="break-words font-medium text-slate-500 md:col-span-2 xl:col-span-4">
        Somente leitura. Sem ações Sicredi para registros legados.
      </p>
    </div>
  );
}

function emptyLegacyFinancialSummary(): LegacyFinancialHistoryResponse["summary"] {
  return {
    totalRecords: 0,
    byStatus: {
      PAGO: 0,
      BAIXADO: 0,
      PENDENTE: 0,
      VENCIDO: 0,
    },
    nominalAmountCents: 0,
    paidAmountCents: 0,
    years: [],
  };
}

function StudentInvoiceCard({
  bankSlip,
  busy,
  expanded,
  invoice,
  onCancelInvoice,
  onCancelSlip,
  onCopy,
  onIssue,
  onPdf,
  onSync,
  onToggleDetails,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
  busy: boolean;
  expanded: boolean;
  invoice: InvoiceRecord;
  onCancelInvoice: () => void;
  onCancelSlip: () => void;
  onCopy: () => void;
  onIssue: () => void;
  onPdf: () => void;
  onSync: () => void;
  onToggleDetails: () => void;
}) {
  const primaryAction = studentInvoicePrimaryAction(invoice, bankSlip);
  return (
    <InvoiceCompactRow
      bankSlip={bankSlip}
      busy={busy}
      expanded={expanded}
      expandedActions={
        <>
          {primaryAction === "issue" ? (
            <button
              className={adminTheme.primaryButton}
              disabled={busy}
              onClick={onIssue}
              type="button"
            >
              <Banknote className="h-4 w-4" aria-hidden="true" />
              {busy ? "Emitindo..." : issueBankSlipButtonLabel(bankSlip)}
            </button>
          ) : null}
          {primaryAction === "download" ? (
            <button
              className={adminTheme.primaryButton}
              disabled={busy}
              onClick={onPdf}
              type="button"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar boleto
            </button>
          ) : null}
          {primaryAction === "sync" ? (
            <button
              className={adminTheme.primaryButton}
              disabled={busy}
              onClick={onSync}
              type="button"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Consultar boleto
            </button>
          ) : null}

          {bankSlip && primaryAction !== "sync" ? (
            <button
              className={adminTheme.secondaryButton}
              disabled={busy}
              onClick={onSync}
              type="button"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Consultar boleto
            </button>
          ) : null}
          {isFullBankSlip(bankSlip) && bankSlip.linhaDigitavel ? (
            <button
              className={adminTheme.secondaryButton}
              disabled={busy}
              onClick={onCopy}
              type="button"
            >
              Copiar linha
            </button>
          ) : null}
          {canDownloadBankSlipPdf(bankSlip) && primaryAction !== "download" ? (
            <button
              className={adminTheme.secondaryButton}
              disabled={busy}
              onClick={onPdf}
              type="button"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar boleto
            </button>
          ) : null}
          {canRequestBankSlipCancellation(invoice, bankSlip) ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={busy}
              onClick={onCancelSlip}
              type="button"
            >
              Solicitar baixa
            </button>
          ) : null}
          {canCancelInvoiceDirectly(invoice, bankSlip) ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={busy}
              onClick={onCancelInvoice}
              type="button"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Cancelar fatura
            </button>
          ) : null}
        </>
      }
      expandedChildren={<InvoiceDetails bankSlip={bankSlip} invoice={invoice} />}
      invoice={invoice}
      onToggleDetails={onToggleDetails}
      showStudent={false}
    />
  );
}

function StudentInvoiceField({
  label,
  value,
  valueClassName = "truncate",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-white px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cx("mt-1 text-sm font-medium text-slate-900", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function StudentFinanceActionDialog({
  invoice,
  mode,
  onClose,
  onConfirm,
  saving,
}: {
  invoice: InvoiceRecord;
  mode: "cancel-invoice" | "issue-slip" | "cancel-slip";
  onClose: () => void;
  onConfirm: (reason: InvoiceCancellationReason, note: string) => void;
  saving: boolean;
}) {
  const [reason, setReason] = useState<InvoiceCancellationReason>(
    invoiceCancellationOptions[0]!.value,
  );
  const [note, setNote] = useState("");
  const needsReason = mode !== "issue-slip";
  const title =
    mode === "cancel-invoice"
      ? "Cancelar fatura"
      : mode === "cancel-slip"
        ? "Solicitar baixa do boleto"
        : "Emitir boleto";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
              Financeiro
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
          </div>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={saving} onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">{invoice.student.person.fullName}</p>
          <p>Valor: {invoice.amountFormatted}</p>
          <p>Vencimento: {formatDate(invoice.dueDate)}</p>
          {mode === "issue-slip" ? (
            <p className="mt-2 text-amber-800">
              O boleto será emitido sem juros, multa, desconto, QR Code ou Pix,
              preservando a regra financeira atual.
            </p>
          ) : null}
          {mode === "cancel-slip" ? (
            <p className="mt-2 text-amber-800">
              O pedido será registrado para o Sicredi. A baixa não é imediata e a
              fatura só será cancelada após confirmação bancária.
            </p>
          ) : null}
        </div>

        {needsReason ? (
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Motivo
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={saving}
              onChange={(event) =>
                setReason(event.target.value as InvoiceCancellationReason)
              }
              value={reason}
            >
              {invoiceCancellationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {needsReason ? (
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            Observacao opcional
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={saving}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={saving} onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="rounded-lg bg-[#0F2E2E] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving || (needsReason && !reason)}
            onClick={() => onConfirm(reason, note)}
            type="button"
          >
            {saving ? "Executando..." : "Confirmar"}
          </button>
        </div>
      </section>
    </div>
  );
}

function InvoicePreviewBox({ preview }: { preview: InvoicePreview }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-medium text-slate-950">
        {preview.eligible ? "Elegível para fatura" : "Bloqueado"}
      </p>
      {preview.blockingReason ? (
        <p>Motivo: {mapApiErrorMessage(preview.blockingReason)}</p>
      ) : null}
      <p>Ano letivo: {preview.enrollment.academicYear.year}</p>
      <p>Instituição: {preview.enrollment.institution.name}</p>
      <p>
        Curso/série/turno: {preview.enrollment.course} / {preview.enrollment.grade} /{" "}
        {preview.enrollment.shift.name}
      </p>
      <p>Diretoria ativa: {preview.student.activeBoardMembership ? "sim" : "não"}</p>
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

function legacyFinancialStatusLabel(status: LegacyFinancialHistoryRecord["status"]) {
  const labels: Record<LegacyFinancialHistoryRecord["status"], string> = {
    BAIXADO: "Baixado/cancelado",
    PAGO: "Pago",
    PENDENTE: "Pendente",
    VENCIDO: "Vencido",
  };
  return labels[status];
}

function legacyFinancialStatusBadgeClass(
  status: LegacyFinancialHistoryRecord["status"],
) {
  const base = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold";
  if (status === "PAGO") {
    return `${base} bg-emerald-50 text-emerald-700`;
  }
  if (status === "VENCIDO") {
    return `${base} bg-red-50 text-red-700`;
  }
  if (status === "PENDENTE") {
    return `${base} bg-amber-50 text-amber-700`;
  }
  return `${base} bg-slate-100 text-slate-700`;
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "-";
}

function studentFinanceSummary(invoices: InvoiceRecord[]) {
  const openAmountCents = invoices
    .filter((invoice) => invoice.status === "OPEN")
    .reduce((total, invoice) => total + invoice.amountCents, 0);
  const overdueAmountCents = invoices
    .filter((invoice) => invoice.status === "OPEN" && invoice.overdue)
    .reduce((total, invoice) => total + invoice.amountCents, 0);
  const paidAmountCents = invoices
    .filter((invoice) => invoice.status === "PAID")
    .reduce((total, invoice) => total + invoice.amountCents, 0);
  let situation = "Sem faturas";
  if (overdueAmountCents > 0) {
    situation = "Com vencidas";
  } else if (openAmountCents > 0) {
    situation = "Em aberto";
  } else if (paidAmountCents > 0) {
    situation = "Regular";
  }
  return {
    openAmountCents,
    overdueAmountCents,
    paidAmountCents,
    situation,
    totalInvoices: invoices.length,
  };
}

function studentInvoicePrimaryAction(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (canIssueBankSlip(invoice, bankSlip)) {
    return "issue";
  }
  if (canDownloadBankSlipPdf(bankSlip)) {
    return "download";
  }
  if (bankSlip) {
    return "sync";
  }
  return "none";
}

function parseMoneyToCentsSafe(value: string) {
  if (!value.trim()) {
    return null;
  }
  try {
    return parseMoneyToCents(value);
  } catch {
    return null;
  }
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function toSituationSlice(
  key: string,
  label: string,
  color: string,
  response: { pagination: { total: number }; summary?: InvoiceListSummary },
): FinanceSituationSlice {
  const summary = response.summary;
  const amountCents =
    key === "paid"
      ? summary?.paidAmountCents ?? 0
      : key === "cancelled"
      ? summary?.cancelledAmountCents ?? 0
      : key === "overdue"
      ? summary?.overdueAmountCents ?? 0
      : summary?.openAmountCents ?? 0;

  return {
    amountCents,
    color,
    count: response.pagination.total,
    key,
    label,
  };
}

function mergeBankSlipSummaries(
  invoices: InvoiceRecord[],
  current: Record<string, BankSlipListRecord | null | undefined>,
) {
  return Object.fromEntries(
    invoices.map((invoice) => {
      const existing = current[invoice.id];
      return [
        invoice.id,
        existing && isFullBankSlip(existing) ? existing : invoice.bankSlipSummary,
      ] as const;
    }),
  );
}

function isFullBankSlip(
  bankSlip: BankSlipListRecord | null | undefined,
): bankSlip is BankSlipRecord {
  return Boolean(bankSlip && "linhaDigitavel" in bankSlip);
}

export function bankSlipStatusLabel(status: BankSlipStatus) {
  const labels: Record<BankSlipStatus, string> = {
    PENDING_ISSUE: "Emitindo",
    ISSUED: "Emitido",
    PAID: "Pago",
    PENDING_CANCELLATION: "Baixa solicitada",
    CANCELLED: "Baixado",
    ISSUE_FAILED: "Falha na emissão",
    CANCELLATION_FAILED: "Falha na baixa",
    UNKNOWN: "Situação incerta",
  };
  return labels[status];
}

export function canSyncPaidDay(user: ApiUser) {
  return canAccessRestrictedAdmin(user);
}

export function canIssueBankSlip(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  return (
    invoice.status === "OPEN" &&
    !invoice.overdue &&
    (bankSlip === null || bankSlip?.status === "CANCELLED")
  );
}

function issueBankSlipButtonLabel(bankSlip: BankSlipListRecord | null | undefined) {
  return bankSlip?.status === "CANCELLED" ? "Emitir novo boleto" : "Emitir boleto";
}

function isIssueBatchRunning(batch: BankSlipIssueBatch) {
  return batch.status === "QUEUED" || batch.status === "PROCESSING";
}

function issueBatchCompletionMessage(batch: BankSlipIssueBatch) {
  if (batch.status === "CANCELLED") {
    return "Lote cancelado.";
  }
  const errors = batch.failedItems + batch.unknownItems;
  return `Emissao concluida: ${batch.issuedItems} boleto(s) emitido(s), ${errors} erro(s), ${batch.skippedItems} bloqueado(s).`;
}

function mergeBatchLists(
  current: BankSlipIssueBatch[],
  incoming: BankSlipIssueBatch[],
) {
  const byId = new Map(current.map((batch) => [batch.id, batch]));
  incoming.forEach((batch) => byId.set(batch.id, batch));
  return [...byId.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function BatchPreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="block truncate font-semibold text-slate-950">{value}</span>
    </p>
  );
}

function issueBatchItemInvoiceLabel(item: BankSlipIssueBatchItem) {
  return item.invoiceId ? item.invoiceId.slice(0, 8) : "Sem fatura";
}

function issueBatchDueDateLabel(issueBatch: BankSlipIssueBatch) {
  return formatDate(issueBatch.dueDate);
}

function filterIssueBatchDownloads(
  batches: BankSlipIssueBatch[],
  search: string,
) {
  const query = normalizeSearchText(search);
  if (!query) {
    return batches;
  }
  return batches.filter((batch) =>
    [
      issueBatchInstitutionName(batch),
      issueBatchAcademicYearLabel(batch),
      issueBatchCompetenceLabel(batch),
      formatDate(batch.createdAt),
      formatDateTime(batch.createdAt),
      formatDate(batch.dueDate),
      issueBatchStatusLabel(batch.status),
    ].some((value) => normalizeSearchText(value).includes(query)),
  );
}

function issueBatchInstitutionName(batch: BankSlipIssueBatch) {
  return batch.institution?.name ?? "Instituicao nao informada";
}

function issueBatchAcademicYearLabel(batch: BankSlipIssueBatch) {
  return extractYear(batch.competence) ?? extractYear(batch.dueDate) ?? extractYear(batch.createdAt) ?? "-";
}

function issueBatchCompetenceLabel(batch: BankSlipIssueBatch) {
  return formatMonthYear(batch.competence) ?? formatMonthYear(batch.dueDate) ?? "-";
}

function issueBatchTotalValueCents(batch: BankSlipIssueBatch) {
  return batch.metadata?.report?.issuedAmountCents ?? batch.totalValueCents;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractYear(value?: string | null) {
  if (!value) {
    return null;
  }
  const year = /^(\d{4})/.exec(value)?.[1] ?? /(\d{4})/.exec(value)?.[1];
  return year ?? null;
}

function formatMonthYear(value?: string | null) {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (match) {
    return `${match[2]}/${match[1]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function IssueBatchProgressPanel({
  batch,
  events,
  onViewDetails,
}: {
  batch: BankSlipIssueBatch;
  events: BankSlipIssueBatchItem[];
  onViewDetails: () => void;
}) {
  const running = isIssueBatchRunning(batch);
  const elapsedMs = issueBatchElapsedMs(batch);
  const estimatedRemainingMs = running ? issueBatchEstimatedRemainingMs(batch, elapsedMs) : 0;
  const errors = batch.failedItems + batch.unknownItems;
  const progress = batchProgress(batch);
  return (
    <div className="mt-3 grid gap-3 rounded border border-blue-100 bg-blue-50 p-4 text-sm text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">
            {running ? "Emitindo boletos..." : "Emissao concluida."}
          </p>
          <p className="text-xs text-slate-600">
            {progress.processedItems} de {progress.totalItems} processados • {progress.percent}%
          </p>
        </div>
        {!running ? (
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            onClick={onViewDetails}
            type="button"
          >
            Ver detalhes do lote
          </button>
        ) : null}
      </div>
      <div className="grid gap-1">
        <div className="h-2 overflow-hidden rounded bg-white">
          <div
            className="h-full rounded bg-blue-600 transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
          <span>{progress.processedItems} de {progress.totalItems}</span>
          <span>Tempo decorrido: {formatDuration(elapsedMs)}</span>
          {running && estimatedRemainingMs > 0 ? (
            <span>Estimativa restante: {formatDuration(estimatedRemainingMs)}</span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-emerald-100 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Emitidos</p>
          <p className="text-base font-semibold text-emerald-700">{batch.successItems}</p>
        </div>
        <div className="rounded border border-amber-100 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Bloqueados</p>
          <p className="text-base font-semibold text-amber-700">{batch.skippedItems}</p>
        </div>
        <div className="rounded border border-red-100 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Erros</p>
          <p className="text-base font-semibold text-red-700">{errors}</p>
        </div>
      </div>
      {events.length > 0 ? (
        <div className="grid gap-1 border-t border-blue-100 pt-2 text-xs">
          <p className="font-medium text-slate-700">Ultimos eventos</p>
          {events.map((item) => (
            <div className="flex flex-wrap items-center gap-2" key={item.id}>
              <span className={issueBatchEventTone(item.status)}>
                {issueBatchItemStatusLabel(item.status)}
              </span>
              <span>{item.studentName ?? item.studentId ?? item.invoiceId ?? "Aluno"}</span>
              {item.nossoNumero ? <span>Nosso numero: {item.nossoNumero}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function latestIssueBatchEvents(items: BankSlipIssueBatchItem[]) {
  return [...items]
    .filter((item) => item.status !== "QUEUED" && item.status !== "PROCESSING")
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 5);
}

function issueBatchElapsedMs(batch: BankSlipIssueBatch) {
  const startedAt = Date.parse(batch.startedAt ?? batch.createdAt);
  if (Number.isNaN(startedAt)) {
    return 0;
  }
  const endedAt = batch.finishedAt ? Date.parse(batch.finishedAt) : Date.now();
  if (Number.isNaN(endedAt) || endedAt < startedAt) {
    return 0;
  }
  return endedAt - startedAt;
}

function issueBatchEstimatedRemainingMs(batch: BankSlipIssueBatch, elapsedMs: number) {
  const progress = batchProgress(batch);
  if (progress.processedItems <= 0 || progress.processedItems >= progress.totalItems) {
    return 0;
  }
  const msPerItem = elapsedMs / progress.processedItems;
  return Math.round(msPerItem * (progress.totalItems - progress.processedItems));
}

function formatDuration(valueMs: number) {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

function issueBatchEventTone(status: BankSlipIssueBatchItem["status"]) {
  if (status === "ISSUED") {
    return "font-medium text-emerald-700";
  }
  if (status === "SKIPPED") {
    return "font-medium text-amber-700";
  }
  if (status === "FAILED" || status === "UNKNOWN") {
    return "font-medium text-red-700";
  }
  return "font-medium text-slate-700";
}

function issueBatchStatusLabel(status: BankSlipIssueBatch["status"]) {
  const labels: Record<BankSlipIssueBatch["status"], string> = {
    DRAFT: "Rascunho",
    QUEUED: "Na fila",
    PROCESSING: "Processando",
    COMPLETED: "Concluido",
    COMPLETED_WITH_ERRORS: "Concluido com erros",
    FAILED: "Falhou",
    CANCELLED: "Cancelado",
  };
  return labels[status];
}

function issueBatchItemStatusLabel(status: BankSlipIssueBatchItem["status"]) {
  const labels: Record<BankSlipIssueBatchItem["status"], string> = {
    QUEUED: "Na fila",
    PROCESSING: "Processando",
    ISSUED: "Emitido",
    SKIPPED: "Ignorado",
    FAILED: "Falhou",
    UNKNOWN: "Incerto",
    CANCELLED: "Cancelado",
  };
  return labels[status];
}

function institutionIssueStatusLabel(
  status: BankSlipIssueBatchPreview["items"][number]["institutionIssueStatus"],
  eligible: boolean,
) {
  const labels: Record<NonNullable<typeof status>, string> = {
    WILL_CREATE_INVOICE: "Criar fatura",
    EXISTING_INVOICE_ELIGIBLE: "Reutilizar fatura",
    ALREADY_PAID: "Ja pago",
    ACTIVE_BANK_SLIP: "Boleto ativo",
    INVOICE_AMOUNT_CONFLICT: "Conflito de valor",
    BLOCKED: "Bloqueado",
  };
  return status ? labels[status] : eligible ? "Elegivel" : "Bloqueado";
}

export function canRequestBankSlipCancellation(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  return invoice.status === "OPEN" && bankSlip?.status === "ISSUED";
}

function FinanceAreaHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-4")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className={cx(adminTheme.titleText, "text-base")}>{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        {actions ? <div className="min-w-0 shrink-0">{actions}</div> : null}
      </div>
    </section>
  );
}

export function canCancelInvoiceDirectly(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (invoice.status !== "OPEN") {
    return false;
  }
  return (
    !bankSlip ||
    bankSlip.status === "ISSUE_FAILED" ||
    bankSlip.status === "CANCELLED"
  );
}

export function canDownloadBankSlipPdf(
  bankSlip: BankSlipListRecord | null | undefined,
) {
  return (
    bankSlip?.status === "ISSUED" ||
    bankSlip?.status === "PAID" ||
    bankSlip?.status === "PENDING_CANCELLATION"
  );
}

function syncResultMessage(previous: BankSlipStatus | undefined, next: BankSlipStatus) {
  if (next === "PAID" && previous !== "PAID") {
    return "Pagamento confirmado";
  }
  if (next === "CANCELLED" && previous !== "CANCELLED") {
    return "Baixa confirmada";
  }
  return "Consulta concluída";
}

function safeBankSlipFileName(fileName: string, invoiceId: string) {
  const cleaned = fileName.replace(/[^a-zA-Z0-9_.-]/g, "");
  return cleaned && !/\d{11}/.test(cleaned) ? cleaned : `boleto-${invoiceId}.pdf`;
}

function safeZipFileName(fileName: string, fallback: string) {
  const cleaned = fileName.replace(/[^a-zA-Z0-9_.-]/g, "");
  return cleaned.endsWith(".zip") ? cleaned : fallback;
}

function numberHeader(headers: Headers, name: string, fallback: number) {
  const parsed = Number.parseInt(headers.get(name) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodedHeader(headers: Headers, name: string) {
  const value = headers.get(name);
  if (!value) {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function issueBatchEmptyDownloadMessage(firstFailure: string) {
  const normalized = firstFailure
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("autenticacao") || normalized.includes("autorizada")) {
    return "Nenhum boleto pôde ser baixado. O Sicredi recusou a autenticação das solicitações de PDF.";
  }
  return firstFailure
    ? `Nenhum boleto pôde ser baixado. ${firstFailure}.`
    : "Nenhum boleto pôde ser baixado.";
}

function parseMoneyToCents(input: string) {
  const sanitized = input.trim().replace(/^R\$\s?/, "").replace(/\s/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;
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

function formatMoneyInput(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const amount = Number.parseInt(digits, 10) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `invoice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentMonthRange() {
  const now = new Date();
  return monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

function currentMonthParts() {
  const now = new Date();
  return {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
}

function monthRange(year: number, month: number) {
  const safeMonth = Math.min(Math.max(month, 1), 12);
  const from = new Date(Date.UTC(year, safeMonth - 1, 1));
  const to = new Date(Date.UTC(year, safeMonth, 0));
  return {
    from: from.toISOString().slice(0, 10),
    label: from.toLocaleDateString("pt-BR", {
      month: "short",
      timeZone: "UTC",
    }).replace(".", ""),
    to: to.toISOString().slice(0, 10),
  };
}

function lastMonthRanges(year: number, month: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return monthRange(date.getUTCFullYear(), date.getUTCMonth() + 1);
  });
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function quickFilterFromInitialFilters(
  filters: InvoiceInitialFilters,
): InvoiceQuickFilter {
  if (filters.status === "OPEN" && filters.overdue === "overdue") {
    return "overdue";
  }
  if (filters.status === "OPEN") {
    return "open";
  }
  if (filters.status === "PAID") {
    return "paid";
  }
  if (filters.status === "CANCELLED") {
    return "cancelled";
  }
  return "all";
}

function emptyToUndefined(value?: string) {
  return value && value.length > 0 ? value : undefined;
}
