"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleSlash,
  Layers3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  type PermissionCatalogItem,
  type PermissionKey,
  type PermissionProfile,
} from "../../lib/api";
import { formatDateTime } from "../../lib/formatters/date";
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
import {
  permissionLabel,
  permissionModuleLabel,
  visiblePermissionCatalog,
} from "./permission-labels";

type StatusFilter = "active" | "inactive" | "all";
type ProfileFormState = {
  description: string;
  isActive: boolean;
  name: string;
  permissions: PermissionKey[];
};
type DialogState = { mode: "create" | "edit"; profile?: PermissionProfile } | null;
type PendingAction = {
  action: "inactivate" | "reactivate";
  profile: PermissionProfile;
} | null;

const DEFAULT_LIMIT = 10;
const EMPTY_FORM: ProfileFormState = {
  description: "",
  isActive: true,
  name: "",
  permissions: [],
};

export function PermissionProfilesPanel() {
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [pagination, setPagination] = useState({
    limit: DEFAULT_LIMIT,
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "green" | "red" | "orange";
    text: string;
  } | null>(null);
  const [formNotice, setFormNotice] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [page, search, status]);

  const groupedCatalog = useMemo(() => {
    const grouped = new Map<string, PermissionCatalogItem[]>();
    for (const permission of visiblePermissionCatalog(catalog)) {
      const current = grouped.get(permission.module) ?? [];
      current.push(permission);
      grouped.set(permission.module, current);
    }
    return Array.from(grouped.entries());
  }, [catalog]);

  const summary = useMemo(() => {
    return {
      active: profiles.filter((profile) => profile.isActive).length,
      inactive: profiles.filter((profile) => !profile.isActive).length,
      total: pagination.total,
    };
  }, [pagination.total, profiles]);

  async function loadCatalog() {
    try {
      const response = await api.listPermissionProfileCatalog();
      setCatalog(response);
    } catch (caught) {
      setFeedback({
        tone: "orange",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar o catálogo de permissões.",
      });
    }
  }

  async function loadProfiles() {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await api.listAdminPermissionProfiles({
        limit: DEFAULT_LIMIT,
        order: "asc",
        page,
        search,
        sort: "name",
        status,
      });
      setProfiles(response.data);
      setPagination(response.pagination);
    } catch (caught) {
      setProfiles([]);
      setFeedback({
        tone: "red",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar perfis de permissões.",
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

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setFormNotice("");
    setDialog({ mode: "create" });
  }

  function openEditDialog(profile: PermissionProfile) {
    setForm({
      description: profile.description ?? "",
      isActive: profile.isActive,
      name: profile.name,
      permissions: profile.permissions,
    });
    setFormNotice("");
    setDialog({ mode: "edit", profile });
  }

  async function submitProfileDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) {
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const body = {
        description: form.description.trim() || null,
        isActive: form.isActive,
        name: form.name.trim(),
        permissions: form.permissions,
      };
      if (dialog.mode === "create") {
        await api.createPermissionProfile(body);
        setFeedback({ tone: "green", text: "Perfil criado." });
      } else if (dialog.profile) {
        await api.updatePermissionProfile(dialog.profile.id, body);
        setFeedback({ tone: "green", text: "Perfil atualizado." });
      }
      setDialog(null);
      await loadProfiles();
    } catch (caught) {
      setFeedback({
        tone: "red",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar o perfil.",
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
      if (pendingAction.action === "inactivate") {
        await api.inactivatePermissionProfile(pendingAction.profile.id);
        setFeedback({ tone: "green", text: "Perfil inativado." });
      } else {
        await api.reactivatePermissionProfile(pendingAction.profile.id);
        setFeedback({ tone: "green", text: "Perfil reativado." });
      }
      setPendingAction(null);
      await loadProfiles();
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

  function togglePermission(permissionKey: PermissionKey) {
    setForm((current) => {
      const selected = current.permissions.includes(permissionKey);
      if (selected) {
        const dependents = selectedDependents(permissionKey, current.permissions, catalog);
        if (dependents.length > 0) {
          setFormNotice(
            `${permissionLabel(permissionKey)} é obrigatória porque ${dependents
              .map((dependent) => permissionLabel(dependent))
              .join(", ")} depende dela.`,
          );
          return current;
        }
        setFormNotice("");
        return {
          ...current,
          permissions: current.permissions.filter((key) => key !== permissionKey),
        };
      }
      const nextPermissions = resolvePermissionDependencies(
        [...current.permissions, permissionKey],
        catalog,
      );
      const addedDependencies = nextPermissions.filter(
        (key) => key !== permissionKey && !current.permissions.includes(key),
      );
      setFormNotice(
        addedDependencies.length > 0
          ? `Também marquei ${addedDependencies
              .map((dependency) => permissionLabel(dependency))
              .join(", ")} por dependência.`
          : "",
      );
      return {
        ...current,
        permissions: nextPermissions,
      };
    });
  }

  function setModulePermissions(
    permissions: PermissionCatalogItem[],
    selected: boolean,
  ) {
    const permissionKeys = permissions.map((permission) => permission.key);
    setForm((current) => {
      if (selected) {
        const nextPermissions = resolvePermissionDependencies(
          [...current.permissions, ...permissionKeys],
          catalog,
        );
        const addedDependencies = nextPermissions.filter(
          (key) => !current.permissions.includes(key) && !permissionKeys.includes(key),
        );
        setFormNotice(
          addedDependencies.length > 0
            ? `Também marquei dependências fora do módulo: ${addedDependencies
                .map((dependency) => permissionLabel(dependency))
                .join(", ")}.`
            : "",
        );
        return { ...current, permissions: nextPermissions };
      }
      const remaining = current.permissions.filter(
        (permissionKey) => !permissionKeys.includes(permissionKey),
      );
      const nextPermissions = resolvePermissionDependencies(remaining, catalog);
      const preserved = nextPermissions.filter((key) => permissionKeys.includes(key));
      setFormNotice(
        preserved.length > 0
          ? `Mantive ${preserved
              .map((dependency) => permissionLabel(dependency))
              .join(", ")} por dependência de permissões ainda selecionadas.`
          : "",
      );
      return { ...current, permissions: nextPermissions };
    });
  }

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
            Novo perfil
          </button>
        }
        description="Cadastre perfis administrativos e selecione permissões oficiais do catálogo para uso futuro nos acessos operacionais."
        eyebrow="Administração"
        icon={ShieldCheck}
        title="Perfis de Permissão"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AdminSummaryCard
          description="Total conforme filtros atuais."
          icon={Layers3}
          label="Perfis"
          tone="blue"
          value={summary.total}
        />
        <AdminSummaryCard
          description="Disponíveis para vincular a usuários."
          icon={CheckCircle2}
          label="Ativos"
          tone="green"
          value={summary.active}
        />
        <AdminSummaryCard
          description="Mantidos no histórico administrativo."
          icon={CircleSlash}
          label="Inativos"
          tone="orange"
          value={summary.inactive}
        />
      </section>

      <section className={adminTheme.card}>
        <AdminSectionHeader
          description="A gestão é exclusiva de SUPER_ADMIN. Administradores comuns continuam sem acesso a esta tela."
          title="Perfis cadastrados"
        />
        {feedback ? (
          <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback>
        ) : null}

        <div className="grid gap-3 border-b border-slate-200/80 p-4 lg:grid-cols-[1fr_180px_auto]">
          <form className="flex min-w-0 gap-2" onSubmit={applySearch}>
            <input
              className={cx(adminTheme.control, "min-w-0 flex-1")}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar perfil"
              value={searchInput}
            />
            <button className={adminTheme.secondaryButton} type="submit">
              <Search aria-hidden="true" className="h-4 w-4" />
              Buscar
            </button>
          </form>
          <select
            className={adminTheme.control}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as StatusFilter);
            }}
            value={status}
          >
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="all">Todos</option>
          </select>
          <button
            className={adminTheme.secondaryButton}
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setStatus("active");
              setPage(1);
            }}
            type="button"
          >
            Limpar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Permissões</th>
                <th className="px-4 py-3">Usuários</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Atualizado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((profile) => (
                <tr key={profile.id} className="align-top">
                  <td className="max-w-xs px-4 py-4">
                    <p className="font-semibold text-slate-950">{profile.name}</p>
                    {profile.description ? (
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        {profile.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {profile.permissions.length} selecionadas
                  </td>
                  <td className="px-4 py-4 text-slate-600">{profile.usersCount}</td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge tone={profile.isActive ? "green" : "orange"}>
                      {profile.isActive ? "Ativo" : "Inativo"}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {formatDateTime(profile.updatedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className={adminTheme.iconButton}
                        onClick={() => openEditDialog(profile)}
                        title="Editar perfil"
                        type="button"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        className={adminTheme.secondaryButton}
                        onClick={() =>
                          setPendingAction({
                            action: profile.isActive ? "inactivate" : "reactivate",
                            profile,
                          })
                        }
                        type="button"
                      >
                        {profile.isActive ? "Inativar" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {profiles.length === 0 ? (
          <div className="p-4">
            <AdminEmptyState
              description={
                loading
                  ? "Consultando perfis administrativos."
                  : "Nenhum perfil encontrado para os filtros atuais."
              }
              loading={loading}
              title={loading ? "Carregando perfis" : "Sem perfis"}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 text-sm text-slate-600">
          <span>
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className={adminTheme.secondaryButton}
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
              type="button"
            >
              Anterior
            </button>
            <button
              className={adminTheme.secondaryButton}
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Próxima
            </button>
          </div>
        </div>
      </section>

      {dialog ? (
        <ProfileDialog
          catalogGroups={groupedCatalog}
          form={form}
          notice={formNotice}
          onClose={() => setDialog(null)}
          onSubmit={submitProfileDialog}
          onSetModulePermissions={setModulePermissions}
          onTogglePermission={togglePermission}
          saving={saving}
          setForm={setForm}
          title={dialog.mode === "create" ? "Novo perfil" : "Editar perfil"}
        />
      ) : null}

      {pendingAction ? (
        <AdminConfirmDialog
          confirmLabel={
            pendingAction.action === "inactivate" ? "Inativar" : "Reativar"
          }
          description={`Confirmar alteração de status do perfil ${pendingAction.profile.name}?`}
          disabled={saving}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
          title="Alterar status"
        />
      ) : null}
    </>
  );
}

function ProfileDialog({
  catalogGroups,
  form,
  notice,
  onClose,
  onSubmit,
  onSetModulePermissions,
  onTogglePermission,
  saving,
  setForm,
  title,
}: {
  catalogGroups: Array<[string, PermissionCatalogItem[]]>;
  form: ProfileFormState;
  notice: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSetModulePermissions: (
    permissions: PermissionCatalogItem[],
    selected: boolean,
  ) => void;
  onTogglePermission: (permissionKey: PermissionKey) => void;
  saving: boolean;
  setForm: (
    next: ProfileFormState | ((current: ProfileFormState) => ProfileFormState),
  ) => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-6">
      <form
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onSubmit={onSubmit}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        </div>
        <div className="grid max-h-[calc(92vh-8rem)] gap-5 overflow-y-auto p-5 lg:grid-cols-[320px_1fr]">
          <div className="grid content-start gap-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Nome
              <input
                className={adminTheme.control}
                maxLength={120}
                minLength={2}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={form.name}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Descrição
              <textarea
                className={cx(adminTheme.control, "h-24 resize-none py-2")}
                maxLength={240}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={form.description}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                checked={form.isActive}
                className="h-4 w-4 rounded border-slate-300 text-[#0F2E2E]"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Perfil ativo
            </label>
          </div>

          <div className="grid gap-4">
            {notice ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {notice}
              </p>
            ) : null}
            {catalogGroups.map(([module, permissions]) => (
              <section
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                key={module}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase text-slate-500">
                    {permissionModuleLabel(module)}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      className="text-xs font-semibold text-[#0F2E2E] hover:underline"
                      onClick={() => onSetModulePermissions(permissions, true)}
                      type="button"
                    >
                      Selecionar módulo
                    </button>
                    <button
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                      onClick={() => onSetModulePermissions(permissions, false)}
                      type="button"
                    >
                      Limpar módulo
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => (
                    <label
                      className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      key={permission.key}
                    >
                      <input
                        checked={form.permissions.includes(permission.key)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0F2E2E]"
                        onChange={() => onTogglePermission(permission.key)}
                        type="checkbox"
                      />
                      <span>{permissionLabel(permission.key)}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            className={adminTheme.secondaryButton}
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button className={adminTheme.primaryButton} disabled={saving} type="submit">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

function resolvePermissionDependencies(
  permissionKeys: PermissionKey[],
  catalog: PermissionCatalogItem[],
) {
  const catalogByKey = new Map(catalog.map((permission) => [permission.key, permission]));
  const resolved = new Set<PermissionKey>();
  const pending = [...permissionKeys];
  while (pending.length > 0) {
    const permissionKey = pending.pop()!;
    if (resolved.has(permissionKey)) {
      continue;
    }
    resolved.add(permissionKey);
    for (const dependency of catalogByKey.get(permissionKey)?.dependencies ?? []) {
      pending.push(dependency);
    }
  }
  return Array.from(resolved).sort();
}

function selectedDependents(
  permissionKey: PermissionKey,
  selectedPermissions: PermissionKey[],
  catalog: PermissionCatalogItem[],
) {
  return selectedPermissions.filter((selected) => {
    if (selected === permissionKey) {
      return false;
    }
    return resolvePermissionDependencies([selected], catalog).includes(permissionKey);
  });
}
