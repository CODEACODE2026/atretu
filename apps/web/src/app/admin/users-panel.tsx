"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import {
  api,
  type AdminUser,
  type BaseRecord,
  type CreateAdminUserBody,
  type ListAdminUsersParams,
  type RoleCode,
  type UserStatus,
} from "../../lib/api";
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

type AssignableRole = Exclude<RoleCode, "GESTOR">;
type UserFormMode = "create" | "edit" | "institutions";
type UserFormState = {
  email: string;
  institutionIds: string[];
  name: string;
  role: AssignableRole;
};
type UserDialogState = {
  mode: UserFormMode;
  user?: AdminUser;
};
type PendingAction = {
  type: "block" | "unblock" | "reset-password";
  user: AdminUser;
} | null;
type TemporaryPasswordState = {
  password: string;
  userName: string;
};
type SummaryState = {
  active: number;
  inactive: number;
  secretaria: number;
  superAdmin: number;
};

const DEFAULT_LIMIT = 10;
const ASSIGNABLE_ROLES: AssignableRole[] = ["SUPER_ADMIN", "SECRETARIA"];
const EMPTY_FORM: UserFormState = {
  email: "",
  institutionIds: [],
  name: "",
  role: "SECRETARIA",
};

export function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [pagination, setPagination] = useState({
    limit: DEFAULT_LIMIT,
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<SummaryState>({
    active: 0,
    inactive: 0,
    secretaria: 0,
    superAdmin: 0,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | AssignableRole>("");
  const [status, setStatus] = useState<"" | UserStatus>("");
  const [institutionId, setInstitutionId] = useState("");
  const [neverLoggedIn, setNeverLoggedIn] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [withoutInstitution, setWithoutInstitution] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "green" | "red" | "orange";
    text: string;
  } | null>(null);
  const [dialog, setDialog] = useState<UserDialogState | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [temporaryPassword, setTemporaryPassword] =
    useState<TemporaryPasswordState | null>(null);

  useEffect(() => {
    void loadInstitutions();
    void loadSummary();
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [
    institutionId,
    mustChangePassword,
    neverLoggedIn,
    page,
    role,
    search,
    status,
    withoutInstitution,
  ]);

  const activeFilters = useMemo(() => {
    return [
      search ? `Busca: ${search}` : "",
      role ? `Perfil: ${roleLabel(role)}` : "",
      status ? `Status: ${statusLabel(status)}` : "",
      institutionId
        ? `Instituição: ${institutionName(institutions, institutionId)}`
        : "",
      neverLoggedIn ? "Nunca logou" : "",
      mustChangePassword ? "Primeiro acesso pendente" : "",
      withoutInstitution ? "Sem instituição" : "",
    ].filter(Boolean);
  }, [
    institutionId,
    institutions,
    mustChangePassword,
    neverLoggedIn,
    role,
    search,
    status,
    withoutInstitution,
  ]);

  async function loadInstitutions() {
    try {
      const response = await api.listInstitutions({
        limit: 100,
        sort: "name",
        status: "active",
      });
      setInstitutions(response.data);
    } catch (caught) {
      setFeedback({
        tone: "orange",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar instituições.",
      });
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const [active, inactive, superAdmin, secretaria] = await Promise.all([
        api.listAdminUsers({ limit: 1, status: "ACTIVE" }),
        api.listAdminUsers({ limit: 1, status: "INACTIVE" }),
        api.listAdminUsers({ limit: 1, role: "SUPER_ADMIN" }),
        api.listAdminUsers({ limit: 1, role: "SECRETARIA" }),
      ]);
      setSummary({
        active: active.pagination.total,
        inactive: inactive.pagination.total,
        secretaria: secretaria.pagination.total,
        superAdmin: superAdmin.pagination.total,
      });
    } catch {
      setSummary({
        active: 0,
        inactive: 0,
        secretaria: 0,
        superAdmin: 0,
      });
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setFeedback(null);
    try {
      const params: ListAdminUsersParams = {
        institutionId,
        limit: DEFAULT_LIMIT,
        mustChangePassword: mustChangePassword || undefined,
        neverLoggedIn: neverLoggedIn || undefined,
        order: "asc",
        page,
        role: role || undefined,
        search,
        sort: "name",
        status: status || undefined,
        withoutInstitution: withoutInstitution || undefined,
      };
      const response = await api.listAdminUsers(params);
      setUsers(response.data);
      setPagination(response.pagination);
    } catch (caught) {
      setUsers([]);
      setFeedback({
        tone: "red",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar usuários.",
      });
    } finally {
      setLoading(false);
    }
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setRole("");
    setStatus("");
    setInstitutionId("");
    setNeverLoggedIn(false);
    setMustChangePassword(false);
    setWithoutInstitution(false);
    setPage(1);
  }

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setInstitutionSearch("");
    setDialog({ mode: "create" });
  }

  function openEditDialog(user: AdminUser) {
    setForm({
      email: user.email,
      institutionIds: user.institutionIds,
      name: user.name,
      role: assignableRoleOrDefault(user.roles[0]),
    });
    setInstitutionSearch("");
    setDialog({ mode: "edit", user });
  }

  function openInstitutionsDialog(user: AdminUser) {
    setForm({
      email: user.email,
      institutionIds: user.institutionIds,
      name: user.name,
      role: assignableRoleOrDefault(user.roles[0]),
    });
    setInstitutionSearch("");
    setDialog({ mode: "institutions", user });
  }

  async function submitUserDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      if (dialog.mode === "create") {
        const body: CreateAdminUserBody = {
          email: form.email.trim(),
          institutionIds: sortedIds(form.institutionIds),
          name: form.name.trim(),
          role: form.role,
        };
        const response = await api.createAdminUser(body);
        setTemporaryPassword({
          password: response.temporaryPassword,
          userName: response.user.name,
        });
        setDialog(null);
        setFeedback({
          tone: "green",
          text: "Usuário criado. A senha temporária está disponível apenas agora.",
        });
      } else if (dialog.mode === "edit" && dialog.user) {
        const nextInstitutionIds = sortedIds(form.institutionIds);
        const currentInstitutionIds = sortedIds(dialog.user.institutionIds);
        await api.updateAdminUser(dialog.user.id, {
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
        });
        if (!sameIds(nextInstitutionIds, currentInstitutionIds)) {
          await api.updateAdminUserInstitutions(
            dialog.user.id,
            nextInstitutionIds,
          );
        }
        setDialog(null);
        setFeedback({ tone: "green", text: "Usuário atualizado." });
      } else if (dialog.mode === "institutions" && dialog.user) {
        await api.updateAdminUserInstitutions(
          dialog.user.id,
          sortedIds(form.institutionIds),
        );
        setDialog(null);
        setFeedback({ tone: "green", text: "Instituições atualizadas." });
      }
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (caught) {
      setFeedback({
        tone: "red",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar a alteração.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) {
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (pendingAction.type === "block") {
        await api.blockAdminUser(pendingAction.user.id);
        setFeedback({ tone: "green", text: "Usuário bloqueado." });
      } else if (pendingAction.type === "unblock") {
        await api.unblockAdminUser(pendingAction.user.id);
        setFeedback({ tone: "green", text: "Usuário desbloqueado." });
      } else {
        const response = await api.resetAdminUserPassword(pendingAction.user.id);
        setTemporaryPassword({
          password: response.temporaryPassword,
          userName: response.user.name,
        });
        setFeedback({
          tone: "green",
          text: "Nova senha temporária gerada. Ela será exibida apenas agora.",
        });
      }
      setPendingAction(null);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (caught) {
      setFeedback({
        tone: "red",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível concluir a ação.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryPassword) {
      return;
    }
    try {
      await navigator.clipboard.writeText(temporaryPassword.password);
      setFeedback({ tone: "green", text: "Senha temporária copiada." });
    } catch {
      setFeedback({
        tone: "orange",
        text: "Não foi possível copiar automaticamente. Selecione a senha manualmente.",
      });
    }
  }

  const filteredDialogInstitutions = institutions.filter((institution) =>
    institution.name.toLowerCase().includes(institutionSearch.toLowerCase()),
  );

  return (
    <>
      <AdminModuleHeader
        actions={
          <button
            className={adminTheme.primaryButton}
            onClick={openCreateDialog}
            type="button"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Novo usuário
          </button>
        }
        description="Gerencie contas, perfis, status de acesso e vínculos institucionais sem expor senhas ou dados sensíveis."
        eyebrow="Administração"
        icon={UserCog}
        title="Usuários"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          description="Contas liberadas para autenticação."
          icon={CheckCircle2}
          label="Ativos"
          tone="green"
          value={summaryLoading ? "..." : summary.active}
        />
        <AdminSummaryCard
          description="Contas impedidas de entrar."
          icon={Ban}
          label="Bloqueados"
          tone="red"
          value={summaryLoading ? "..." : summary.inactive}
        />
        <AdminSummaryCard
          description="Perfil com acesso administrativo."
          icon={ShieldCheck}
          label="SUPER_ADMIN"
          tone="blue"
          value={summaryLoading ? "..." : summary.superAdmin}
        />
        <AdminSummaryCard
          description="Perfil operacional por instituição."
          icon={UsersRound}
          label="SECRETARIA"
          tone="orange"
          value={summaryLoading ? "..." : summary.secretaria}
        />
      </section>

      <section className={adminTheme.card}>
        <AdminSectionHeader
          action={
            activeFilters.length > 0 ? (
              <button
                className={adminTheme.secondaryButton}
                onClick={resetFilters}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Limpar filtros
              </button>
            ) : null
          }
          description="Busca, filtros, paginação e ações administrativas."
          title="Lista de usuários"
        />

        {feedback ? (
          <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback>
        ) : null}

        <div className="grid gap-4 p-4">
          <form
            className="grid items-end gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,1fr))_auto]"
            onSubmit={applySearch}
          >
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Busca
              <span className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  className={cx(adminTheme.control, "w-full pl-9")}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Nome ou e-mail"
                  value={searchInput}
                />
              </span>
            </label>

            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Perfil
              <select
                className={cx(adminTheme.control, "w-full")}
                onChange={(event) => {
                  setPage(1);
                  setRole(event.target.value as "" | AssignableRole);
                }}
                value={role}
              >
                <option value="">Todos</option>
                {ASSIGNABLE_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {roleLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className={cx(adminTheme.control, "w-full")}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as "" | UserStatus);
                }}
                value={status}
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Bloqueado</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Instituição
              <select
                className={cx(adminTheme.control, "w-full")}
                onChange={(event) => {
                  setPage(1);
                  setInstitutionId(event.target.value);
                }}
                value={institutionId}
              >
                <option value="">Todas</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className={cx(adminTheme.secondaryButton, "w-full lg:w-auto")}
              type="submit"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Buscar
            </button>
          </form>

          <div
            aria-label="Filtros rápidos"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Filtros rápidos
            </span>
            <FilterToggle
              checked={neverLoggedIn}
              label="Nunca logou"
              onChange={(checked) => {
                setPage(1);
                setNeverLoggedIn(checked);
              }}
            />
            <FilterToggle
              checked={mustChangePassword}
              label="Primeiro acesso pendente"
              onChange={(checked) => {
                setPage(1);
                setMustChangePassword(checked);
              }}
            />
            <FilterToggle
              checked={withoutInstitution}
              label="Sem instituição"
              onChange={(checked) => {
                setPage(1);
                setWithoutInstitution(checked);
              }}
            />
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <span
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                  key={filter}
                >
                  {filter}
                </span>
              ))}
            </div>
          ) : null}

          {users.length === 0 ? (
            <AdminEmptyState
              description={
                loading
                  ? "Buscando usuários administrativos."
                  : "Ajuste os filtros ou crie um novo usuário."
              }
              loading={loading}
              title={loading ? "Carregando usuários" : "Nenhum usuário encontrado"}
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <th className="w-[22%] border-b border-slate-200 px-3 py-3">
                        Usuário
                      </th>
                      <th className="w-[11%] border-b border-slate-200 px-3 py-3">
                        Perfil
                      </th>
                      <th className="w-[11%] border-b border-slate-200 px-3 py-3">
                        Status
                      </th>
                      <th className="w-[16%] border-b border-slate-200 px-3 py-3">
                        Instituições
                      </th>
                      <th className="w-[14%] border-b border-slate-200 px-3 py-3">
                        Acesso
                      </th>
                      <th className="w-[10%] border-b border-slate-200 px-3 py-3">
                        Criado
                      </th>
                      <th className="w-[16%] border-b border-slate-200 px-3 py-3 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <UserTableRow
                        key={user.id}
                        onBlock={() => setPendingAction({ type: "block", user })}
                        onEdit={() => openEditDialog(user)}
                        onInstitutions={() => openInstitutionsDialog(user)}
                        onResetPassword={() =>
                          setPendingAction({ type: "reset-password", user })
                        }
                        onUnblock={() =>
                          setPendingAction({ type: "unblock", user })
                        }
                        user={user}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {users.map((user) => (
                  <UserMobileCard
                    key={user.id}
                    onBlock={() => setPendingAction({ type: "block", user })}
                    onEdit={() => openEditDialog(user)}
                    onInstitutions={() => openInstitutionsDialog(user)}
                    onResetPassword={() =>
                      setPendingAction({ type: "reset-password", user })
                    }
                    onUnblock={() => setPendingAction({ type: "unblock", user })}
                    user={user}
                  />
                ))}
              </div>

              <PaginationControls
                page={pagination.page}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPage={(nextPage) => setPage(nextPage)}
              />
            </>
          )}
        </div>
      </section>

      {dialog ? (
        <UserFormDialog
          dialog={dialog}
          filteredInstitutions={filteredDialogInstitutions}
          form={form}
          institutionSearch={institutionSearch}
          institutions={institutions}
          onCancel={() => setDialog(null)}
          onChange={setForm}
          onInstitutionSearch={setInstitutionSearch}
          onSubmit={submitUserDialog}
          saving={saving}
        />
      ) : null}

      {pendingAction ? (
        <AdminConfirmDialog
          confirmLabel={pendingActionLabel(pendingAction.type)}
          description={pendingActionDescription(pendingAction)}
          disabled={saving}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmAction()}
          tone={pendingAction.type === "block" ? "red" : "orange"}
          title={pendingActionTitle(pendingAction.type)}
        />
      ) : null}

      {temporaryPassword ? (
        <TemporaryPasswordDialog
          onClose={() => setTemporaryPassword(null)}
          onCopy={() => void copyTemporaryPassword()}
          password={temporaryPassword.password}
          userName={temporaryPassword.userName}
        />
      ) : null}
    </>
  );
}

function UserTableRow({
  onBlock,
  onEdit,
  onInstitutions,
  onResetPassword,
  onUnblock,
  user,
}: {
  onBlock: () => void;
  onEdit: () => void;
  onInstitutions: () => void;
  onResetPassword: () => void;
  onUnblock: () => void;
  user: AdminUser;
}) {
  return (
    <tr className="align-middle text-slate-700">
      <td className="border-b border-slate-100 px-3 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950">{user.name}</p>
          <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-slate-500">
            <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
        </div>
      </td>
      <td className="border-b border-slate-100 px-3 py-3">
        <RoleBadges roles={user.roles} />
      </td>
      <td className="border-b border-slate-100 px-3 py-3">
        <UserStatusBadges user={user} />
      </td>
      <td className="border-b border-slate-100 px-3 py-3">
        <InstitutionTags user={user} />
      </td>
      <td className="border-b border-slate-100 px-3 py-3 text-xs leading-5 text-slate-600">
        <p className="whitespace-nowrap">
          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Nunca logou"}
        </p>
        {user.mustChangePassword ? (
          <p className="mt-1 font-semibold text-amber-700">
            Primeiro acesso pendente
          </p>
        ) : null}
      </td>
      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-xs text-slate-600">
        {formatDate(user.createdAt)}
      </td>
      <td className="border-b border-slate-100 px-3 py-3">
        <UserActions
          onBlock={onBlock}
          onEdit={onEdit}
          onInstitutions={onInstitutions}
          onResetPassword={onResetPassword}
          onUnblock={onUnblock}
          user={user}
        />
      </td>
    </tr>
  );
}

function UserMobileCard({
  onBlock,
  onEdit,
  onInstitutions,
  onResetPassword,
  onUnblock,
  user,
}: {
  onBlock: () => void;
  onEdit: () => void;
  onInstitutions: () => void;
  onResetPassword: () => void;
  onUnblock: () => void;
  user: AdminUser;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!actionsOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [actionsOpen]);

  return (
    <article className={cx(adminTheme.softPanel, "p-4")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold text-slate-950">{user.name}</p>
          <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
        </div>
        <UserStatusBadges user={user} />
      </div>
      <div className="mt-3 grid gap-3 text-sm text-slate-600">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Perfil
          </p>
          <RoleBadges roles={user.roles} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Instituições
          </p>
          <InstitutionTags user={user} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoBlock
            label="Último acesso"
            value={
              user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Nunca logou"
            }
          />
          <InfoBlock label="Criado em" value={formatDate(user.createdAt)} />
        </div>
      </div>
      <div className="relative mt-4 flex justify-end">
        <button
          aria-controls={`user-actions-${user.id}`}
          aria-expanded={actionsOpen}
          className={cx(adminTheme.secondaryButton, "w-full justify-center sm:w-auto")}
          onClick={() => setActionsOpen((current) => !current)}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          Ações
        </button>
        {actionsOpen ? (
          <div
            className="absolute bottom-12 right-0 z-10 grid w-full min-w-56 gap-1 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg sm:w-64"
            id={`user-actions-${user.id}`}
            role="menu"
          >
            <UserMobileAction
              icon={Pencil}
              label="Editar usuário"
              onClick={() => {
                setActionsOpen(false);
                onEdit();
              }}
            />
            <UserMobileAction
              icon={Building2}
              label="Gerenciar instituições"
              onClick={() => {
                setActionsOpen(false);
                onInstitutions();
              }}
            />
            <UserMobileAction
              icon={KeyRound}
              label="Redefinir senha"
              onClick={() => {
                setActionsOpen(false);
                onResetPassword();
              }}
            />
            <UserMobileAction
              icon={user.status === "INACTIVE" ? Unlock : LockKeyhole}
              label={
                user.status === "INACTIVE"
                  ? "Desbloquear usuário"
                  : "Bloquear usuário"
              }
              onClick={() => {
                setActionsOpen(false);
                if (user.status === "INACTIVE") {
                  onUnblock();
                } else {
                  onBlock();
                }
              }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function UserActions({
  onBlock,
  onEdit,
  onInstitutions,
  onResetPassword,
  onUnblock,
  user,
}: {
  onBlock: () => void;
  onEdit: () => void;
  onInstitutions: () => void;
  onResetPassword: () => void;
  onUnblock: () => void;
  user: AdminUser;
}) {
  const inactive = user.status === "INACTIVE";
  return (
    <div className="flex flex-nowrap justify-end gap-1.5">
      <button
        aria-label={`Editar usuário ${user.name}`}
        className={cx(adminTheme.iconButton, "h-8 w-8")}
        onClick={onEdit}
        title="Editar usuário"
        type="button"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={`Gerenciar instituições de ${user.name}`}
        className={cx(adminTheme.iconButton, "h-8 w-8")}
        onClick={onInstitutions}
        title="Gerenciar instituições"
        type="button"
      >
        <Building2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={`Redefinir senha de ${user.name}`}
        className={cx(adminTheme.iconButton, "h-8 w-8")}
        onClick={onResetPassword}
        title="Redefinir senha"
        type="button"
      >
        <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={
          inactive ? `Desbloquear usuário ${user.name}` : `Bloquear usuário ${user.name}`
        }
        className={cx(adminTheme.iconButton, "h-8 w-8")}
        onClick={inactive ? onUnblock : onBlock}
        title={inactive ? "Desbloquear usuário" : "Bloquear usuário"}
        type="button"
      >
        {inactive ? (
          <Unlock aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function UserMobileAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15"
      onClick={onClick}
      role="menuitem"
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4 text-slate-500" />
      {label}
    </button>
  );
}

function UserFormDialog({
  dialog,
  filteredInstitutions,
  form,
  institutionSearch,
  institutions,
  onCancel,
  onChange,
  onInstitutionSearch,
  onSubmit,
  saving,
}: {
  dialog: UserDialogState;
  filteredInstitutions: BaseRecord[];
  form: UserFormState;
  institutionSearch: string;
  institutions: BaseRecord[];
  onCancel: () => void;
  onChange: (next: UserFormState) => void;
  onInstitutionSearch: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const institutionsOnly = dialog.mode === "institutions";
  const title =
    dialog.mode === "create"
      ? "Novo usuário"
      : institutionsOnly
        ? "Instituições"
        : "Editar usuário";

  function updateInstitution(id: string, checked: boolean) {
    const nextIds = checked
      ? sortedIds([...form.institutionIds, id])
      : form.institutionIds.filter((item) => item !== id);
    onChange({ ...form, institutionIds: nextIds });
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <form
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {dialog.mode === "create"
                ? "Preencha os dados. A senha temporária será gerada pelo backend."
                : institutionsOnly
                  ? "Substitua os vínculos institucionais do usuário."
                  : "Atualize os dados permitidos e os vínculos institucionais."}
            </p>
          </div>
          <button
            aria-label="Fechar"
            className={adminTheme.iconButton}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[68vh] gap-4 overflow-y-auto px-5 py-4">
          {!institutionsOnly ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Nome
                <input
                  className={adminTheme.control}
                  maxLength={120}
                  minLength={2}
                  onChange={(event) =>
                    onChange({ ...form, name: event.target.value })
                  }
                  required
                  value={form.name}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Email
                <input
                  className={adminTheme.control}
                  maxLength={180}
                  onChange={(event) =>
                    onChange({ ...form, email: event.target.value })
                  }
                  required
                  type="email"
                  value={form.email}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Perfil
                <select
                  className={adminTheme.control}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      role: event.target.value as AssignableRole,
                    })
                  }
                  value={form.role}
                >
                  {ASSIGNABLE_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <section className={adminTheme.softPanel}>
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                Instituições
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Selecione por nome. IDs nunca são editados manualmente.
              </p>
            </div>
            <div className="grid gap-3 p-4">
              <input
                className={adminTheme.control}
                onChange={(event) => onInstitutionSearch(event.target.value)}
                placeholder="Pesquisar instituição"
                value={institutionSearch}
              />
              <div className="flex flex-wrap gap-2">
                {form.institutionIds.length === 0 ? (
                  <span className="text-sm text-slate-500">Sem instituição</span>
                ) : (
                  form.institutionIds.map((id) => (
                    <span
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                      key={id}
                    >
                      {institutionName(institutions, id)}
                    </span>
                  ))
                )}
              </div>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                {filteredInstitutions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma instituição encontrada.
                  </p>
                ) : (
                  filteredInstitutions.map((institution) => (
                    <label
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                      key={institution.id}
                    >
                      <input
                        checked={form.institutionIds.includes(institution.id)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0F2E2E]"
                        onChange={(event) =>
                          updateInstitution(institution.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {institution.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className={adminTheme.secondaryButton}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={adminTheme.primaryButton}
            disabled={saving}
            type="submit"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TemporaryPasswordDialog({
  onClose,
  onCopy,
  password,
  userName,
}: {
  onClose: () => void;
  onCopy: () => void;
  password: string;
  userName: string;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
      <section
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex gap-3 p-5">
          <span className={cx(adminTheme.atretuMark, "grid h-10 w-10 place-items-center rounded-xl")}>
            <KeyRound aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">
              Senha temporária
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Esta senha será exibida apenas uma vez.
            </p>
            <p className="mt-1 text-sm text-slate-500">{userName}</p>
          </div>
        </div>
        <div className="px-5 pb-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-semibold text-slate-950">
            <span className="break-all">{password}</span>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className={adminTheme.secondaryButton}
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
          <button className={adminTheme.primaryButton} onClick={onCopy} type="button">
            <Copy aria-hidden="true" className="h-4 w-4" />
            Copiar
          </button>
        </div>
      </section>
    </div>
  );
}

function FilterToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
        checked
          ? "border-[#1F6F5F] bg-[#F2F8F6] text-[#0F2E2E]"
          : "border-slate-200 bg-white/90 text-slate-600",
      )}
    >
      <input
        checked={checked}
        className="h-4 w-4 rounded border-slate-300 text-[#0F2E2E]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function PaginationControls({
  onPage,
  page,
  total,
  totalPages,
}: {
  onPage: (page: number) => void;
  page: number;
  total: number;
  totalPages: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {total} usuário{total === 1 ? "" : "s"} encontrado
        {total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center justify-end gap-2">
        <button
          className={adminTheme.secondaryButton}
          disabled={page <= 1}
          onClick={() => onPage(Math.max(page - 1, 1))}
          type="button"
        >
          Anterior
        </button>
        <span className="min-w-20 text-center text-sm font-semibold text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          className={adminTheme.secondaryButton}
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(page + 1, totalPages))}
          type="button"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

function RoleBadges({ roles }: { roles: RoleCode[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <AdminStatusBadge
          key={role}
          tone={
            role === "SUPER_ADMIN" ? "blue" : role === "SECRETARIA" ? "orange" : "slate"
          }
        >
          {roleLabel(role)}
        </AdminStatusBadge>
      ))}
    </div>
  );
}

function UserStatusBadges({ user }: { user: AdminUser }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AdminStatusBadge tone={user.status === "ACTIVE" ? "green" : "red"}>
        {statusLabel(user.status)}
      </AdminStatusBadge>
      {user.mustChangePassword ? (
        <AdminStatusBadge tone="orange">Primeiro acesso</AdminStatusBadge>
      ) : null}
    </div>
  );
}

function InstitutionTags({ user }: { user: AdminUser }) {
  if (user.institutions.length === 0) {
    return <span className="text-sm text-slate-500">Sem instituição</span>;
  }
  const visibleInstitutions = user.institutions.slice(0, 1);
  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleInstitutions.map((institution) => (
        <span
          className="max-w-[11rem] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
          key={institution.id}
          title={institution.name}
        >
          {institution.name}
        </span>
      ))}
      {user.institutions.length > visibleInstitutions.length ? (
        <span
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500"
          title={user.institutions
            .slice(visibleInstitutions.length)
            .map((institution) => institution.name)
            .join(", ")}
        >
          +{user.institutions.length - visibleInstitutions.length}
        </span>
      ) : null}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-slate-700">{value}</p>
    </div>
  );
}

function roleLabel(role: RoleCode) {
  if (role === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }
  if (role === "SECRETARIA") {
    return "SECRETARIA";
  }
  return "GESTOR";
}

function statusLabel(status: UserStatus) {
  return status === "ACTIVE" ? "Ativo" : "Bloqueado";
}

function institutionName(institutions: BaseRecord[], id: string) {
  return institutions.find((institution) => institution.id === id)?.name ?? "Selecionada";
}

function assignableRoleOrDefault(role?: RoleCode): AssignableRole {
  return role === "SUPER_ADMIN" || role === "SECRETARIA" ? role : "SECRETARIA";
}

function sortedIds(ids: string[]) {
  return Array.from(new Set(ids)).sort();
}

function sameIds(left: string[], right: string[]) {
  const sortedLeft = sortedIds(left);
  const sortedRight = sortedIds(right);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((id, index) => id === sortedRight[index])
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function pendingActionTitle(type: NonNullable<PendingAction>["type"]) {
  if (type === "block") {
    return "Bloquear usuário";
  }
  if (type === "unblock") {
    return "Desbloquear usuário";
  }
  return "Gerar nova senha temporária";
}

function pendingActionLabel(type: NonNullable<PendingAction>["type"]) {
  if (type === "block") {
    return "Bloquear";
  }
  if (type === "unblock") {
    return "Desbloquear";
  }
  return "Gerar senha";
}

function pendingActionDescription(action: NonNullable<PendingAction>) {
  if (action.type === "block") {
    return `O usuário ${action.user.name} perderá acesso nas próximas requisições autenticadas.`;
  }
  if (action.type === "unblock") {
    return `O usuário ${action.user.name} poderá autenticar novamente, mas sessões antigas não são reaproveitadas.`;
  }
  return `Uma nova senha temporária será criada para ${action.user.name} e exibida uma única vez.`;
}
