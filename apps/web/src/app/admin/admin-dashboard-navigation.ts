import type { CollectionOperationalStatus } from "../../lib/api";
import type { AdminArea } from "./admin-navigation";

export type DomainKey = "institutions" | "shifts" | "buses" | "years";
export type FinanceArea = "invoices" | "collections" | "movements";
export type StudentStatusFilter = "active" | "suspended" | "terminated" | "all";
export type StudentBoardMembershipFilter = "all" | "active" | "inactive";
export type PreRegistrationInitialStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DashboardNavigationTarget = {
  area: AdminArea;
  academicYearId?: string;
  baseDomain?: DomainKey;
  boardMembership?: StudentBoardMembershipFilter;
  collectionFilters?: {
    academicYearId?: string;
    followUpFrom?: string;
    followUpTo?: string;
    institutionId?: string;
    operationalStatus?: CollectionOperationalStatus;
  };
  financeArea?: FinanceArea;
  invoiceFilters?: {
    academicYearId?: string;
    institutionId?: string;
    overdue?: "all" | "overdue" | "notOverdue";
    paidAtFrom?: string;
    paidAtTo?: string;
    status?: "OPEN" | "PAID" | "CANCELLED" | "";
  };
  institutionId?: string;
  preRegistrationStatus?: PreRegistrationInitialStatus;
  shiftId?: string;
  studentAction?: "new";
  studentStatus?: StudentStatusFilter;
};

export type StudentListUrlFilters = {
  academicYearId: string;
  boardMembership: StudentBoardMembershipFilter;
  institutionId: string;
  shiftId: string;
  status: StudentStatusFilter;
};

const adminAreas = new Set<AdminArea>([
  "account",
  "dashboard",
  "students",
  "reenrollments",
  "student-cards",
  "finance",
  "official-documents",
  "reports",
  "settings",
  "jobs",
  "legacy-import",
  "users",
  "permission-profiles",
  "pre-registrations",
  "years",
  "base",
]);

export function parseDashboardHref(href: string): DashboardNavigationTarget | null {
  const url = new URL(href, "http://atretu.local");
  const area = parseAdminArea(url.searchParams.get("area"));
  if (!area) {
    return null;
  }

  const academicYearId = valueOrUndefined(url.searchParams.get("academicYearId"));
  const baseDomain = parseDomainKey(url.searchParams.get("baseDomain"));
  const boardMembership = parseBoardMembershipFilter(
    url.searchParams.get("boardMembership"),
  );
  const financeArea = parseFinanceArea(url.searchParams.get("financeArea"));
  const institutionId = valueOrUndefined(url.searchParams.get("institutionId"));
  const shiftId = valueOrUndefined(url.searchParams.get("shiftId"));
  const preRegistrationStatus = parsePreRegistrationStatus(
    url.searchParams.get("preRegistrationStatus"),
  );
  const studentStatus = parseStudentStatusFilter(
    url.searchParams.get("studentStatus"),
  );
  const action = url.searchParams.get("action");
  const invoiceStatus = url.searchParams.get("invoiceStatus");
  const overdue = url.searchParams.get("overdue");
  const paidAtFrom = valueOrUndefined(url.searchParams.get("paidAtFrom"));
  const paidAtTo = valueOrUndefined(url.searchParams.get("paidAtTo"));
  const operationalStatus = url.searchParams.get("collectionOperationalStatus");
  const followUpFrom = valueOrUndefined(url.searchParams.get("followUpFrom"));
  const followUpTo = valueOrUndefined(url.searchParams.get("followUpTo"));

  return {
    area,
    academicYearId,
    baseDomain,
    boardMembership,
    collectionFilters:
      academicYearId ||
      institutionId ||
      operationalStatus ||
      followUpFrom ||
      followUpTo
        ? {
            academicYearId,
            followUpFrom,
            followUpTo,
            institutionId,
            operationalStatus: parseCollectionOperationalStatus(operationalStatus),
          }
        : undefined,
    financeArea,
    invoiceFilters:
      academicYearId ||
      institutionId ||
      invoiceStatus ||
      overdue ||
      paidAtFrom ||
      paidAtTo
        ? {
            academicYearId,
            institutionId,
            overdue: parseOverdueFilter(overdue),
            paidAtFrom,
            paidAtTo,
            status: parseInvoiceStatus(invoiceStatus),
          }
        : undefined,
    institutionId,
    preRegistrationStatus,
    shiftId,
    studentAction: action === "new" ? "new" : undefined,
    studentStatus,
  };
}

export function adminAreaHref(area: AdminArea) {
  return area === "dashboard" ? "/admin" : `/admin?area=${area}`;
}

export function dashboardTargetHref(target: DashboardNavigationTarget) {
  const search = new URLSearchParams();
  search.set("area", target.area);
  if (target.academicYearId) search.set("academicYearId", target.academicYearId);
  if (target.baseDomain) search.set("baseDomain", target.baseDomain);
  if (target.boardMembership && target.boardMembership !== "all") {
    search.set("boardMembership", target.boardMembership);
  }
  if (target.financeArea) search.set("financeArea", target.financeArea);
  if (target.institutionId) search.set("institutionId", target.institutionId);
  if (target.preRegistrationStatus) {
    search.set("preRegistrationStatus", target.preRegistrationStatus);
  }
  if (target.shiftId) search.set("shiftId", target.shiftId);
  if (target.studentAction) search.set("action", target.studentAction);
  if (target.studentStatus) {
    search.set("studentStatus", serializeStudentStatusFilter(target.studentStatus));
  }
  return `/admin?${search.toString()}`;
}

export function studentsListHref(filters: StudentListUrlFilters) {
  const search = new URLSearchParams();
  search.set("area", "students");
  if (filters.academicYearId) {
    search.set("academicYearId", filters.academicYearId);
  }
  if (filters.institutionId) {
    search.set("institutionId", filters.institutionId);
  }
  if (filters.shiftId) {
    search.set("shiftId", filters.shiftId);
  }
  if (
    filters.status !== "active" ||
    filters.academicYearId ||
    filters.institutionId ||
    filters.shiftId ||
    filters.boardMembership !== "all"
  ) {
    search.set("studentStatus", serializeStudentStatusFilter(filters.status));
  }
  if (filters.boardMembership !== "all") {
    search.set("boardMembership", filters.boardMembership);
  }
  return `/admin?${search.toString()}`;
}

export function parseStudentStatusFilter(
  value: string | null,
): StudentStatusFilter | undefined {
  switch (value?.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "suspended";
    case "TERMINATED":
      return "terminated";
    case "ALL":
      return "all";
    default:
      return undefined;
  }
}

export function serializeStudentStatusFilter(value: StudentStatusFilter) {
  return value.toUpperCase();
}

function parseAdminArea(value: string | null): AdminArea | undefined {
  return value && adminAreas.has(value as AdminArea)
    ? (value as AdminArea)
    : undefined;
}

function parseDomainKey(value: string | null): DomainKey | undefined {
  return value === "institutions" ||
    value === "shifts" ||
    value === "buses" ||
    value === "years"
    ? value
    : undefined;
}

function parseFinanceArea(value: string | null): FinanceArea | undefined {
  return value === "invoices" || value === "collections" || value === "movements"
    ? value
    : undefined;
}

function parseInvoiceStatus(
  value: string | null,
): "OPEN" | "PAID" | "CANCELLED" | undefined {
  return value === "OPEN" || value === "PAID" || value === "CANCELLED"
    ? value
    : undefined;
}

function parseOverdueFilter(
  value: string | null,
): "all" | "overdue" | "notOverdue" | undefined {
  return value === "all" || value === "overdue" || value === "notOverdue"
    ? value
    : undefined;
}

function parsePreRegistrationStatus(
  value: string | null,
): PreRegistrationInitialStatus | undefined {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED"
    ? value
    : undefined;
}

function parseBoardMembershipFilter(
  value: string | null,
): StudentBoardMembershipFilter | undefined {
  return value === "all" || value === "active" || value === "inactive"
    ? value
    : undefined;
}

function parseCollectionOperationalStatus(
  value: string | null,
): CollectionOperationalStatus | undefined {
  return value === "OVERDUE_NO_ACTION" ||
    value === "CONTACTED" ||
    value === "PROMISE_ACTIVE" ||
    value === "PROMISE_BROKEN" ||
    value === "FOLLOW_UP_SCHEDULED" ||
    value === "NO_CONTACT" ||
    value === "PARTIAL_PAYMENT_REVIEW" ||
    value === "RESOLVED_BY_PAYMENT" ||
    value === "CANCELLED"
    ? value
    : undefined;
}

function valueOrUndefined(value: string | null) {
  return value || undefined;
}
