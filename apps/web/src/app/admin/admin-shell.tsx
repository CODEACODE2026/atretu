"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  BusFront,
  CalendarDays,
  Clock3,
  Database,
  ListFilter,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  type LucideIcon,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BaseRecord,
  type BusAssignmentRecord,
  type BusRecord,
  type DashboardQuickShortcut,
  type ListRecordsParams,
} from "../../lib/api";
import {
  canAccessGlobalOperationalAdmin,
  canAccessMigratedArea,
  canAccessOperationalAdmin,
  canAccessRestrictedAdmin,
  canAccessUserAdministration,
} from "../../lib/auth";
import { AccountPanel } from "./account-panel";
import { AcademicYearsPanel } from "./academic-years-panel";
import { ADMIN_NAV_ITEMS, type AdminArea } from "./admin-navigation";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminConfirmDialog,
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
  AdminSummaryCard,
} from "./components/admin-ui";
import { AdminSidebar } from "./components/admin-sidebar";
import { AdminTopbar } from "./components/admin-topbar";
import { MobileNavigation } from "./components/mobile-navigation";
import {
  adminAreaHref,
  dashboardTargetHref,
  parseDashboardHref,
  studentsListHref,
  type DashboardNavigationTarget,
  type DomainKey,
  type FinanceArea,
  type StudentListUrlFilters,
} from "./admin-dashboard-navigation";
import { DashboardPanel } from "./dashboard-panel";
import { FinancePanel } from "./finance-panel";
import { JobsMonitorPanel } from "./jobs-monitor-panel";
import { LegacyImportPanel } from "./legacy-import-panel";
import { OfficialDocumentsPanel } from "./official-documents-panel";
import { PermissionProfilesPanel } from "./permission-profiles-panel";
import { PreRegistrationsPanel } from "./pre-registrations-panel";
import { ReportsPanel } from "./reports-panel";
import { AssociationSettingsPanel } from "./settings/association-settings-panel";
import { StudentCardsPanel } from "./student-cards-panel";
import { ReenrollmentsPanel, StudentsPanel } from "./students-panel";
import { UsersPanel } from "./users-panel";

type StatusFilter = "active" | "inactive" | "all";
type SortField = "name" | "status" | "createdAt" | "updatedAt";
type RecordRow = BaseRecord | BusRecord;
type EditingRecord = RecordRow | null;
type PendingAction = {
  record: RecordRow;
  nextStatus: "ACTIVE" | "INACTIVE";
} | null;

const DOMAINS: Array<{
  key: DomainKey;
  label: string;
  singular: string;
  description: string;
  hasCapacity: boolean;
  icon: LucideIcon;
  recordsDomain: boolean;
}> = [
  {
    key: "institutions",
    label: "Instituições",
    singular: "instituição",
    description: "Unidades de ensino disponíveis para matrículas e consultas.",
    hasCapacity: false,
    icon: Building2,
    recordsDomain: true,
  },
  {
    key: "shifts",
    label: "Turnos",
    singular: "turno",
    description: "Períodos de atendimento usados nos cadastros acadêmicos.",
    hasCapacity: false,
    icon: Clock3,
    recordsDomain: true,
  },
  {
    key: "buses",
    label: "Ônibus",
    singular: "ônibus",
    description: "Veículos e capacidade operacional por ano letivo.",
    hasCapacity: true,
    icon: BusFront,
    recordsDomain: true,
  },
  {
    key: "years",
    label: "Anos letivos",
    singular: "ano letivo",
    description: "Períodos oficiais usados em matrículas, pré-cadastros e carteirinhas.",
    hasCapacity: false,
    icon: CalendarDays,
    recordsDomain: false,
  },
];
const DEFAULT_DOMAIN = DOMAINS[0]!;
const ACCOUNT_NAV_ITEM = {
  description: "Dados pessoais e seguranca",
  group: "administration",
  icon: UserRound,
  key: "account",
  label: "Minha Conta",
} as const satisfies {
  description: string;
  group: "administration";
  icon: LucideIcon;
  key: AdminArea;
  label: string;
};

export function AdminShell() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .me()
      .then((response) => {
        if (response.user.mustChangePassword) {
          router.replace("/first-access");
          return;
        }
        if (active) {
          setUser(response.user);
        }
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setAuthError("");

    try {
      await api.logout();
      router.replace("/login");
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : "Erro ao sair");
    }
  }

  function handleRequireLogin(message?: string) {
    if (typeof window !== "undefined" && message) {
      window.sessionStorage.setItem("atretu_login_notice", message);
    }
    setUser(null);
    router.replace("/login");
  }

  if (authLoading) {
    return (
      <main className={`min-h-screen p-6 ${adminTheme.appBackground}`}>
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AdminWorkspace
      authError={authError}
      onLogout={handleLogout}
      onRequireLogin={handleRequireLogin}
      onUserChange={setUser}
      user={user}
    />
  );
}

function AdminWorkspace({
  authError,
  onLogout,
  onRequireLogin,
  onUserChange,
  user,
}: {
  authError: string;
  onLogout: () => void;
  onRequireLogin: (message?: string) => void;
  onUserChange: (user: ApiUser) => void;
  user: ApiUser;
}) {
  const router = useRouter();
  const [area, setArea] = useState<AdminArea>(() => {
    if (typeof window === "undefined") {
      return "dashboard";
    }
    return parseDashboardHref(window.location.href)?.area ?? "dashboard";
  });
  const [financeInitialArea, setFinanceInitialArea] =
    useState<FinanceArea>("invoices");
  const [baseInitialDomain, setBaseInitialDomain] =
    useState<DomainKey>("institutions");
  const [dashboardTarget, setDashboardTarget] =
    useState<DashboardNavigationTarget | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabletViewport, setTabletViewport] = useState(false);
  const effectiveSidebarCollapsed = sidebarCollapsed || tabletViewport;
  const visibleTabs = ADMIN_NAV_ITEMS.filter((tab) => canAccessArea(tab.key));
  const fallbackArea = visibleTabs[0]?.key ?? "account";
  const hasOperationalAccess = visibleTabs.length > 0;
  const effectiveArea = canAccessArea(area) ? area : fallbackArea;
  const currentItem =
    effectiveArea === "account"
      ? ACCOUNT_NAV_ITEM
      : (visibleTabs.find((tab) => tab.key === effectiveArea) ??
        (hasOperationalAccess
          ? visibleTabs[0] ?? ACCOUNT_NAV_ITEM
          : ACCOUNT_NAV_ITEM));
  const shortcutTargets: Record<
    string,
    { area: AdminArea; baseDomain?: DomainKey; financeArea?: FinanceArea }
  > = {
    buses: { area: "base", baseDomain: "buses" },
    collections: { area: "finance", financeArea: "collections" },
    finance: { area: "finance", financeArea: "invoices" },
    "official-documents": { area: "official-documents" },
    "pre-registrations": { area: "pre-registrations" },
    "permission-profiles": { area: "permission-profiles" },
    "student-cards": { area: "student-cards" },
    students: { area: "students" },
    users: { area: "users" },
    settings: { area: "settings" },
  };

  useEffect(() => {
    function handleSessionInvalid() {
      onRequireLogin("Sessao expirada. Entre novamente.");
    }

    window.addEventListener("atretu:session-invalid", handleSessionInvalid);
    return () => {
      window.removeEventListener(
        "atretu:session-invalid",
        handleSessionInvalid,
      );
    };
  }, [onRequireLogin]);

  useEffect(() => {
    if (!canAccessArea(area)) {
      setArea(fallbackArea);
      router.replace(adminAreaHref(fallbackArea));
    }
  }, [area, fallbackArea, router]);

  useEffect(() => {
    function applyUrlNavigationContext() {
      const target = parseDashboardHref(window.location.href);
      if (target) {
        applyNavigationTarget(target);
      }
    }

    applyUrlNavigationContext();
    window.addEventListener("popstate", applyUrlNavigationContext);
    return () => {
      window.removeEventListener("popstate", applyUrlNavigationContext);
    };
  }, [hasOperationalAccess]);

  useEffect(() => {
    const query = window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)",
    );

    function syncTabletViewport() {
      setTabletViewport(query.matches);
    }

    syncTabletViewport();
    query.addEventListener("change", syncTabletViewport);
    return () => {
      query.removeEventListener("change", syncTabletViewport);
    };
  }, []);

  function handleAreaChange(nextArea: AdminArea) {
    if (!canAccessArea(nextArea)) {
      setDashboardTarget(null);
      setMobileNavigationOpen(false);
      setArea(fallbackArea);
      router.push(adminAreaHref(fallbackArea));
      return;
    }
    setDashboardTarget(null);
    if (nextArea === "finance") {
      setFinanceInitialArea("invoices");
    }
    if (nextArea === "base") {
      setBaseInitialDomain("institutions");
    }
    setMobileNavigationOpen(false);
    setArea(nextArea);
    router.push(adminAreaHref(nextArea));
  }

  function handleDashboardShortcut(shortcut: DashboardQuickShortcut) {
    if (shortcut.href) {
      handleDashboardHref(shortcut.href);
      return;
    }
    const target = shortcutTargets[shortcut.key];
    if (!target) {
      return;
    }
    const href = dashboardTargetHref(target);
    router.push(href);
    applyNavigationTarget({ ...target, area: target.area });
  }

  function handleDashboardHref(href: string) {
    const target = parseDashboardHref(href);
    if (!target) {
      return;
    }
    router.push(target.area === "students" ? dashboardTargetHref(target) : href);
    applyNavigationTarget(target);
  }

  function handleClearDashboardContext(nextArea: AdminArea) {
    setDashboardTarget(null);
    router.replace(adminAreaHref(nextArea));
  }

  const handleStudentsListFiltersChange = useCallback((filters: StudentListUrlFilters) => {
    const nextTarget: DashboardNavigationTarget = {
      area: "students",
      academicYearId: filters.academicYearId || undefined,
      boardMembership: filters.boardMembership,
      institutionId: filters.institutionId || undefined,
      shiftId: filters.shiftId || undefined,
      studentStatus: filters.status,
    };
    setDashboardTarget(nextTarget);
    router.replace(studentsListHref(filters));
  }, [router]);

  function applyNavigationTarget(target: DashboardNavigationTarget) {
    if (!canAccessArea(target.area)) {
      setDashboardTarget(null);
      setMobileNavigationOpen(false);
      setArea(fallbackArea);
      router.replace(adminAreaHref(fallbackArea));
      return;
    }
    setDashboardTarget(target);
    if (target.financeArea) {
      setFinanceInitialArea(target.financeArea);
    }
    if (target.baseDomain) {
      setBaseInitialDomain(target.baseDomain);
    }
    setMobileNavigationOpen(false);
    setArea(target.area);
  }

  function canAccessArea(nextArea: AdminArea) {
    if (nextArea === "account") {
      return true;
    }
    if (
      nextArea === "dashboard" ||
      nextArea === "students" ||
      nextArea === "reenrollments" ||
      nextArea === "official-documents" ||
      nextArea === "base" ||
      nextArea === "reports" ||
      nextArea === "student-cards" ||
      nextArea === "pre-registrations" ||
      nextArea === "finance"
    ) {
      return canAccessMigratedArea(user, nextArea);
    }
    if (nextArea === "users" || nextArea === "permission-profiles") {
      return canAccessUserAdministration(user);
    }
    const hasLegacyOperationalAccess = canAccessOperationalAdmin(user);
    if (!hasLegacyOperationalAccess) {
      return false;
    }
    const navItem = ADMIN_NAV_ITEMS.find((item) => item.key === nextArea);
    return !navItem || !("restricted" in navItem) || canAccessRestrictedAdmin(user);
  }

  return (
    <main className={`min-h-screen text-slate-950 ${adminTheme.appBackground}`}>
      <AdminSidebar
        activeArea={effectiveArea}
        collapsed={effectiveSidebarCollapsed}
        items={visibleTabs}
        onAccount={() => handleAreaChange("account")}
        onLogout={onLogout}
        onNavigate={handleAreaChange}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        user={user}
      />
      <MobileNavigation
        activeArea={effectiveArea}
        items={visibleTabs}
        onAccount={() => handleAreaChange("account")}
        onClose={() => setMobileNavigationOpen(false)}
        onLogout={onLogout}
        onNavigate={handleAreaChange}
        open={mobileNavigationOpen}
        user={user}
      />

      <div
        className={
          effectiveSidebarCollapsed
            ? "min-h-screen min-w-0 transition-[margin] duration-200 md:ml-20"
            : "min-h-screen min-w-0 transition-[margin] duration-200 md:ml-72"
        }
      >
        <AdminTopbar
          currentItem={currentItem}
          onAccount={() => handleAreaChange("account")}
          onLogout={onLogout}
          onMobileMenu={() => setMobileNavigationOpen(true)}
          onToggleSidebar={() => {
            if (tabletViewport) {
              setMobileNavigationOpen(true);
              return;
            }
            setSidebarCollapsed((value) => !value);
          }}
          sidebarCollapsed={effectiveSidebarCollapsed}
          user={user}
        />

        <section className={adminTheme.page}>
          {!hasOperationalAccess ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-800 shadow-sm">
              <div className="flex gap-3">
                <ShieldAlert
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  Seu perfil esta autenticado, mas nao possui acesso operacional
                  nesta Sprint. Minha Conta permanece disponivel.
                </span>
              </div>
            </div>
          ) : null}

          {authError ? (
            <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-700 shadow-sm">
              {authError}
            </div>
          ) : null}

          {effectiveArea === "dashboard" ? (
            <DashboardPanel
              isShortcutAvailable={(shortcut) =>
                Boolean(shortcut.href || shortcutTargets[shortcut.key])
              }
              onNavigateHref={handleDashboardHref}
              onShortcut={handleDashboardShortcut}
            />
          ) : null}
          {effectiveArea === "students" ? (
            <StudentsPanel
              initialAcademicYearId={dashboardTarget?.academicYearId}
              initialAction={dashboardTarget?.studentAction}
              initialBoardMembershipFilter={dashboardTarget?.boardMembership}
              initialInstitutionId={dashboardTarget?.institutionId}
              initialShiftId={dashboardTarget?.shiftId}
              initialStatusFilter={dashboardTarget?.studentStatus}
              onClearNavigationContext={() => handleClearDashboardContext("students")}
              onListFiltersChange={handleStudentsListFiltersChange}
              user={user}
            />
          ) : null}
          {effectiveArea === "reenrollments" ? <ReenrollmentsPanel /> : null}
          {effectiveArea === "student-cards" ? <StudentCardsPanel user={user} /> : null}
          {effectiveArea === "finance" ? (
            <FinancePanel
              initialArea={financeInitialArea}
              initialCollectionFilters={dashboardTarget?.collectionFilters}
              initialInvoiceFilters={dashboardTarget?.invoiceFilters}
              user={user}
            />
          ) : null}
          {effectiveArea === "official-documents" ? <OfficialDocumentsPanel user={user} /> : null}
          {effectiveArea === "reports" ? <ReportsPanel user={user} /> : null}
          {effectiveArea === "settings" ? <AssociationSettingsPanel /> : null}
          {effectiveArea === "jobs" ? <JobsMonitorPanel /> : null}
          {effectiveArea === "legacy-import" ? <LegacyImportPanel /> : null}
          {effectiveArea === "users" ? <UsersPanel currentUser={user} /> : null}
          {effectiveArea === "permission-profiles" ? <PermissionProfilesPanel /> : null}
          {effectiveArea === "account" ? (
            <AccountPanel
              onRequireLogin={onRequireLogin}
              onUserChange={onUserChange}
            />
          ) : null}
          {effectiveArea === "pre-registrations" ? (
            <PreRegistrationsPanel
              initialAcademicYearId={dashboardTarget?.academicYearId}
              initialInstitutionId={dashboardTarget?.institutionId}
              initialStatus={dashboardTarget?.preRegistrationStatus}
              onClearNavigationContext={() =>
                handleClearDashboardContext("pre-registrations")
              }
              user={user}
            />
          ) : null}
          {effectiveArea === "years" ? <AcademicYearsPanel user={user} /> : null}
          {effectiveArea === "base" ? (
            <BaseRecordsPanel
              initialAcademicYearId={dashboardTarget?.academicYearId}
              initialDomain={baseInitialDomain}
              user={user}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function BaseRecordsPanel({
  initialAcademicYearId,
  initialDomain = "institutions",
  user,
}: {
  initialAcademicYearId?: string;
  initialDomain?: DomainKey;
  user: ApiUser;
}) {
  const [domain, setDomain] = useState<DomainKey>(initialDomain);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [selectedBus, setSelectedBus] = useState<BusRecord | null>(null);
  const [busAssignments, setBusAssignments] = useState<BusAssignmentRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<SortField>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editing, setEditing] = useState<EditingRecord>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const canManageBaseRecords = canAccessOperationalAdmin(user);
  const canManageGlobalBaseRecords = canAccessGlobalOperationalAdmin(user);
  const canManageCurrentDomain = canManageGlobalBaseRecords;
  const canViewBusAssignments = canManageBaseRecords;
  const canShowRecordActions =
    canManageCurrentDomain || (domain === "buses" && canViewBusAssignments);
  const accessibleDomains = useMemo(
    () =>
      canManageBaseRecords
        ? DOMAINS
        : DOMAINS.filter((item) => item.recordsDomain),
    [canManageBaseRecords],
  );

  const currentDomain = useMemo(
    () =>
      accessibleDomains.find((item) => item.key === domain) ??
      accessibleDomains[0] ??
      DEFAULT_DOMAIN,
    [accessibleDomains, domain],
  );

  useEffect(() => {
    void loadYears();
  }, []);

  useEffect(() => {
    setDomain(initialDomain);
  }, [initialDomain]);

  useEffect(() => {
    if (!accessibleDomains.some((item) => item.key === domain)) {
      setDomain(accessibleDomains[0]?.key ?? DEFAULT_DOMAIN.key);
    }
  }, [accessibleDomains, domain]);

  useEffect(() => {
    if (!initialAcademicYearId) {
      return;
    }
    setAcademicYearId(initialAcademicYearId);
    setPage(1);
  }, [initialAcademicYearId]);

  useEffect(() => {
    setEditing(null);
    setName("");
    setCapacity("");
    setSelectedBus(null);
    setBusAssignments([]);
    setPage(1);
    setMessage("");
    setError("");
  }, [domain]);

  useEffect(() => {
    void loadRecords();
  }, [domain, status, sort, order, page, academicYearId]);

  async function loadYears() {
    try {
      const response = await api.listAcademicYears({ status: "all" });
      setYears(response.data);
      const current = response.data.find((year) => year.isCurrent);
      if (current && !initialAcademicYearId) {
        setAcademicYearId(current.id);
      }
    } catch {
      setYears([]);
    }
  }

  async function loadRecords(nextSearch = search) {
    if (!currentDomain.recordsDomain) {
      setRecords([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const params: ListRecordsParams = {
      page,
      limit: 10,
      search: nextSearch,
      status,
      sort,
      order,
      academicYearId: domain === "buses" ? academicYearId : undefined,
    };

    try {
      const response =
        domain === "institutions"
          ? await api.listInstitutions(params)
          : domain === "shifts"
            ? await api.listShifts(params)
            : await api.listBuses(params);

      setRecords(response.data);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
      if (selectedBus && domain === "buses") {
        const refreshed = response.data.find(
          (record) => record.id === selectedBus.id,
        );
        setSelectedBus(isBusRecord(refreshed) ? refreshed : null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar registros",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openBus(record: RecordRow) {
    if (!("capacity" in record)) {
      return;
    }
    setSelectedBus(record);
    setError("");
    try {
      const response = await api.listBusAssignments(record.id, {
        academicYearId,
        status: "active",
        limit: 100,
      });
      setBusAssignments(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao carregar vinculados",
      );
    }
  }

  function startEdit(record: RecordRow) {
    setEditing(record);
    setName(record.name);
    setCapacity("capacity" in record ? String(record.capacity) : "");
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setCapacity("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (currentDomain.hasCapacity) {
        const parsedCapacity = Number(capacity);
        if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
          throw new Error(
            "Capacidade deve ser um número inteiro maior que zero",
          );
        }

        if (editing) {
          await api.updateBus(editing.id, { name, capacity: parsedCapacity });
        } else {
          await api.createBus({ name, capacity: parsedCapacity });
        }
      } else if (domain === "institutions") {
        if (editing) {
          await api.updateInstitution(editing.id, { name });
        } else {
          await api.createInstitution({ name });
        }
      } else if (editing) {
        await api.updateShift(editing.id, { name });
      } else {
        await api.createShift({ name });
      }

      setMessage(`${currentDomain.singular} salvo com sucesso`);
      resetForm();
      await loadRecords();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!pendingAction) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { record, nextStatus } = pendingAction;
      if (domain === "institutions") {
        if (nextStatus === "ACTIVE") {
          await api.reactivateInstitution(record.id);
        } else {
          await api.inactivateInstitution(record.id);
        }
      } else if (domain === "shifts") {
        if (nextStatus === "ACTIVE") {
          await api.reactivateShift(record.id);
        } else {
          await api.inactivateShift(record.id);
        }
      } else if (nextStatus === "ACTIVE") {
        await api.reactivateBus(record.id);
      } else {
        await api.inactivateBus(record.id);
      }

      setMessage(
        nextStatus === "ACTIVE"
          ? `${currentDomain.singular} reativado`
          : `${currentDomain.singular} inativado`,
      );
      setPendingAction(null);
      await loadRecords();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao alterar status",
      );
    } finally {
      setSaving(false);
    }
  }

  const CurrentDomainIcon = currentDomain.icon;
  const activeRecords = records.filter(
    (record) => record.status === "ACTIVE",
  ).length;
  const inactiveRecords = records.filter(
    (record) => record.status === "INACTIVE",
  ).length;
  const busRecords = records.filter(isBusRecord);
  const totalCapacity = busRecords.reduce(
    (sum, record) => sum + record.capacity,
    0,
  );
  const occupiedSeats = busRecords.reduce(
    (sum, record) => sum + (record.occupiedSeats ?? 0),
    0,
  );
  const selectedYearLabel =
    years.find((item) => item.id === academicYearId)?.year ?? "Todos";
  const tableColumnCount = currentDomain.hasCapacity
    ? canShowRecordActions
      ? 7
      : 6
    : canShowRecordActions
      ? 4
      : 3;

  return (
    <div className="grid min-w-0 gap-5">
      <AdminModuleHeader
        description="Gerencie instituições, turnos, ônibus e anos letivos em uma experiência única, com filtros consistentes e ações agrupadas."
        eyebrow="Operação administrativa"
        icon={Database}
        title="Cadastros base"
      />

      <section className={cx(adminTheme.card, "min-w-0 overflow-hidden p-4")}>
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-wrap gap-2">
            {accessibleDomains.map((item) => (
              <button
                className={
                  item.key === domain
                    ? cx(adminTheme.primaryButton, "h-10")
                    : adminTheme.secondaryButton
                }
                key={item.key}
                onClick={() => setDomain(item.key)}
                type="button"
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {currentDomain.recordsDomain ? (
            <form
              className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end xl:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                void loadRecords(search);
              }}
            >
              <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:w-80">
                Pesquisar
                <input
                  className={cx(adminTheme.control, "min-w-0")}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar"
                  type="search"
                  value={search}
                />
              </label>
              <button
                className={cx(adminTheme.primaryButton, "h-10 justify-center")}
                type="submit"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                Buscar
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {currentDomain.recordsDomain ? (
        <>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <AdminSummaryCard
              description={`Total carregado em ${currentDomain.label.toLowerCase()}.`}
              icon={CurrentDomainIcon}
              label="Registros na página"
              tone="blue"
              value={records.length}
            />
            <AdminSummaryCard
              description="Itens disponíveis para uso operacional."
              icon={UsersRound}
              label="Ativos"
              tone="green"
              value={activeRecords}
            />
            <AdminSummaryCard
              description={
                currentDomain.hasCapacity
                  ? `${occupiedSeats}/${totalCapacity} lugares ocupados.`
                  : "Itens mantidos fora dos fluxos ativos."
              }
              icon={ListFilter}
              label={currentDomain.hasCapacity ? "Ocupação" : "Inativos"}
              tone={currentDomain.hasCapacity ? "orange" : "slate"}
              value={
                currentDomain.hasCapacity
                  ? `${occupiedSeats}/${totalCapacity || 0}`
                  : inactiveRecords
              }
            />
          </div>

          <div
            className={
              canManageCurrentDomain
                ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
                : "grid min-w-0 gap-5"
            }
          >
            {canManageCurrentDomain ? (
              <form
              className={cx(adminTheme.card, "min-w-0 p-4")}
              onSubmit={handleSubmit}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                  <Plus aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-950">
                    {editing ? "Editar" : "Novo"} {currentDomain.singular}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {currentDomain.description}
                  </p>
                </div>
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Nome
                <input
                  className={cx(adminTheme.control, "mt-1 w-full")}
                  maxLength={140}
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>

          {currentDomain.hasCapacity ? (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Capacidade total
              <input
                className={cx(adminTheme.control, "mt-1 w-full")}
                min={1}
                onChange={(event) => setCapacity(event.target.value)}
                required
                type="number"
                value={capacity}
              />
            </label>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              className={cx(adminTheme.primaryButton, "justify-center")}
              disabled={saving}
              type="submit"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {editing ? (
              <button
                className={cx(adminTheme.secondaryButton, "justify-center")}
                onClick={resetForm}
                type="button"
              >
                Cancelar
              </button>
            ) : null}
          </div>
              </form>
            ) : null}

        <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
          <AdminSectionHeader
            action={
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <button
                  className={adminTheme.secondaryButton}
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  type="button"
                >
                  Anterior
                </button>
                <span className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700">
                  {page}/{totalPages}
                </span>
                <button
                  className={adminTheme.secondaryButton}
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(current + 1, totalPages))
                  }
                  type="button"
                >
                  Próxima
                </button>
              </div>
            }
            description={`${currentDomain.label} filtrados por status, ordenação e busca.`}
            title="Registros cadastrados"
          />

          <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200/80 bg-slate-50/50 p-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
              <select
                aria-label="Status"
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
                value={status}
              >
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="all">Todos</option>
              </select>
              {currentDomain.hasCapacity ? (
                <select
                  aria-label="Ano letivo"
                  className={cx(adminTheme.control, "min-w-0")}
                  onChange={(event) => {
                    setAcademicYearId(event.target.value);
                    setSelectedBus(null);
                    setBusAssignments([]);
                    setPage(1);
                  }}
                  value={academicYearId}
                >
                  <option value="">Ano letivo</option>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.isCurrent ? `${year.year} atual` : year.year}
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                aria-label="Ordenar por"
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) => setSort(event.target.value as SortField)}
                value={sort}
              >
                <option value="name">Nome</option>
                <option value="status">Status</option>
                <option value="createdAt">Criação</option>
                <option value="updatedAt">Atualização</option>
              </select>
              <select
                aria-label="Direção da ordenação"
                className={cx(adminTheme.control, "min-w-0")}
                onChange={(event) =>
                  setOrder(event.target.value as "asc" | "desc")
                }
                value={order}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
            <div className="min-w-0 text-sm text-slate-600 xl:text-right">
              {currentDomain.hasCapacity
                ? `Ano letivo: ${selectedYearLabel}`
                : "Filtros aplicados ao cadastro atual"}
            </div>
          </div>

          {message ? (
            <AdminFeedback tone="green">{message}</AdminFeedback>
          ) : null}
          {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}

          <div className="hidden max-w-full min-w-0 lg:block">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col
                  className={currentDomain.hasCapacity ? "w-[25%]" : "w-[46%]"}
                />
                {currentDomain.hasCapacity ? (
                  <>
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[8%]" />
                  </>
                ) : null}
                <col
                  className={currentDomain.hasCapacity ? "w-[10%]" : "w-[16%]"}
                />
                <col
                  className={currentDomain.hasCapacity ? "w-[14%]" : "w-[18%]"}
                />
                {canShowRecordActions ? (
                  <col
                    className={currentDomain.hasCapacity ? "w-[31%]" : "w-[20%]"}
                  />
                ) : null}
              </colgroup>
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  {currentDomain.hasCapacity ? (
                    <th className="px-1 py-3 text-center font-semibold">
                      Cap.
                    </th>
                  ) : null}
                  {currentDomain.hasCapacity ? (
                    <>
                      <th className="px-1 py-3 text-center font-semibold">
                        Ocup.
                      </th>
                      <th className="px-1 py-3 text-center font-semibold">
                        Disp.
                      </th>
                    </>
                  ) : null}
                  <th className="px-2 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Atualizado</th>
                  {canShowRecordActions ? (
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                      Ações
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={tableColumnCount}>
                      <AdminEmptyState loading title="Carregando registros" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={tableColumnCount}>
                      <AdminEmptyState
                        description="Ajuste os filtros ou cadastre um novo registro."
                        title="Nenhum registro encontrado"
                      />
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr
                      className="transition-colors hover:bg-slate-50/70"
                      key={record.id}
                    >
                      <td className="px-3 py-3 font-medium text-slate-950">
                        <span
                          className="block max-w-full break-words leading-5"
                          title={record.name}
                        >
                          {record.name}
                        </span>
                      </td>
                      {currentDomain.hasCapacity ? (
                        <td className="px-2 py-3 text-center text-slate-700">
                          {"capacity" in record ? record.capacity : ""}
                        </td>
                      ) : null}
                      {currentDomain.hasCapacity ? (
                        <>
                          <td className="px-2 py-3 text-center text-slate-700">
                            {"occupiedSeats" in record
                              ? (record.occupiedSeats ?? 0)
                              : ""}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {"availableSeats" in record ? (
                              <span
                                className={cx(
                                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  record.isFull
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                                )}
                              >
                                {record.availableSeats ?? record.capacity}
                              </span>
                            ) : null}
                          </td>
                        </>
                      ) : null}
                      <td className="px-3 py-3">
                        <AdminStatusBadge
                          tone={record.status === "ACTIVE" ? "green" : "slate"}
                        >
                          {record.status === "ACTIVE" ? "Ativo" : "Inativo"}
                        </AdminStatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {new Date(record.updatedAt).toLocaleDateString("pt-BR")}
                      </td>
                      {canShowRecordActions ? (
                        <td className="px-3 py-3">
                          <div className="flex flex-nowrap justify-end gap-1.5">
                            {canManageCurrentDomain ? (
                              <button
                                aria-label={`Editar ${record.name}`}
                                className={cx(
                                  adminTheme.secondaryButton,
                                  "h-8 px-2",
                                )}
                                onClick={() => startEdit(record)}
                                title={`Editar ${record.name}`}
                                type="button"
                              >
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                                <span className="sr-only">Editar</span>
                              </button>
                            ) : null}
                            {currentDomain.hasCapacity && canViewBusAssignments ? (
                              <button
                                className={cx(
                                  adminTheme.secondaryButton,
                                  "h-8 px-2 text-xs",
                                )}
                                onClick={() => void openBus(record)}
                                type="button"
                              >
                                Vinculados
                              </button>
                            ) : null}
                            {canManageCurrentDomain ? (
                              <button
                                className={cx(
                                  adminTheme.secondaryButton,
                                  "h-8 px-2 text-xs",
                                )}
                                onClick={() =>
                                  setPendingAction({
                                    record,
                                    nextStatus:
                                      record.status === "ACTIVE"
                                        ? "INACTIVE"
                                        : "ACTIVE",
                                  })
                                }
                                type="button"
                              >
                                {record.status === "ACTIVE"
                                  ? "Inativar"
                                  : "Reativar"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 lg:hidden">
            {loading ? (
              <AdminEmptyState loading title="Carregando registros" />
            ) : records.length === 0 ? (
              <AdminEmptyState
                description="Ajuste os filtros ou cadastre um novo registro."
                title="Nenhum registro encontrado"
              />
            ) : (
              records.map((record) => (
                <article
                  className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
                  key={record.id}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-950">
                        {record.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Atualizado em{" "}
                        {new Date(record.updatedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <AdminStatusBadge
                      tone={record.status === "ACTIVE" ? "green" : "slate"}
                    >
                      {record.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </AdminStatusBadge>
                  </div>
                  {currentDomain.hasCapacity && "capacity" in record ? (
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <span>Capacidade: {record.capacity}</span>
                      <span>Ocupados: {record.occupiedSeats ?? 0}</span>
                      <span>
                        Livres: {record.availableSeats ?? record.capacity}
                      </span>
                    </div>
                  ) : null}
                  {canShowRecordActions ? (
                    <div className="flex flex-wrap gap-2">
                      {canManageCurrentDomain ? (
                        <button
                          className={adminTheme.secondaryButton}
                          onClick={() => startEdit(record)}
                          type="button"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          Editar
                        </button>
                      ) : null}
                      {currentDomain.hasCapacity && canViewBusAssignments ? (
                        <button
                          className={adminTheme.secondaryButton}
                          onClick={() => void openBus(record)}
                          type="button"
                        >
                          Vinculados
                        </button>
                      ) : null}
                      {canManageCurrentDomain ? (
                        <button
                          className={adminTheme.secondaryButton}
                          onClick={() =>
                            setPendingAction({
                              record,
                              nextStatus:
                                record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                          type="button"
                        >
                          {record.status === "ACTIVE" ? "Inativar" : "Reativar"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {selectedBus ? (
        <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {selectedBus.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Capacidade {selectedBus.capacity} / Ocupados{" "}
                {selectedBus.occupiedSeats ?? 0} / Disponíveis{" "}
                {selectedBus.availableSeats ?? selectedBus.capacity}
              </p>
            </div>
            <button
              className={adminTheme.secondaryButton}
              onClick={() => {
                setSelectedBus(null);
                setBusAssignments([]);
              }}
              type="button"
            >
              Fechar
            </button>
          </div>
          <div className="hidden max-w-full overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Acadêmico</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Instituição</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Série</th>
                  <th className="px-4 py-3">Entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {busAssignments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      Nenhum acadêmico vinculado neste ano letivo
                    </td>
                  </tr>
                ) : (
                  busAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {assignment.student.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.student.cpfMasked}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.enrollment.institution.name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.enrollment.course}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.enrollment.grade}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(assignment.startedAt).toLocaleDateString(
                          "pt-BR",
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 lg:hidden">
            {busAssignments.length === 0 ? (
              <AdminEmptyState title="Nenhum acadêmico vinculado neste ano letivo" />
            ) : (
              busAssignments.map((assignment) => (
                <article
                  className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
                  key={assignment.id}
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">
                      {assignment.student.fullName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      CPF {assignment.student.cpfMasked}
                    </p>
                  </div>
                  <div className="grid gap-1 text-xs text-slate-600">
                    <span>{assignment.enrollment.institution.name}</span>
                    <span>
                      {assignment.enrollment.course} •{" "}
                      {assignment.enrollment.grade}
                    </span>
                    <span>
                      Entrada em{" "}
                      {new Date(assignment.startedAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {pendingAction ? (
        <AdminConfirmDialog
          confirmLabel={
            pendingAction.nextStatus === "ACTIVE" ? "Reativar" : "Inativar"
          }
          description={`${
            pendingAction.nextStatus === "ACTIVE" ? "Reativar" : "Inativar"
          } ${pendingAction.record.name}?`}
          disabled={saving}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmStatusChange()}
          title="Confirmar alteração"
          tone={pendingAction.nextStatus === "ACTIVE" ? "green" : "orange"}
        />
      ) : null}
        </>
      ) : (
        <AcademicYearsPanel embedded user={user} />
      )}
    </div>
  );
}

function isBusRecord(record: RecordRow | undefined): record is BusRecord {
  return Boolean(
    record && "capacity" in record && typeof record.capacity === "number",
  );
}
