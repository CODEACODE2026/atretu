"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  api,
  ApiRequestError,
  type AccountUser,
  type BaseRecord,
} from "../../lib/api";
import { formatDateTime } from "../../lib/formatters/date";
import { getPrimaryRoleLabel } from "../../lib/auth";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
} from "./components/admin-ui";

type PasswordDialogState = {
  confirmPassword: string;
  currentPassword: string;
  error: string;
  newPassword: string;
  saving: boolean;
  showConfirm: boolean;
  showCurrent: boolean;
  showNew: boolean;
};

const initialPasswordDialogState: PasswordDialogState = {
  confirmPassword: "",
  currentPassword: "",
  error: "",
  newPassword: "",
  saving: false,
  showConfirm: false,
  showCurrent: false,
  showNew: false,
};

export function AccountPanel({
  onRequireLogin,
  onUserChange,
}: {
  onRequireLogin: (message?: string) => void;
  onUserChange: (user: AccountUser) => void;
}) {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "green" | "red"; text: string } | null>(
    null,
  );
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  useEffect(() => {
    void loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await api.getAccount();
      setAccount(response.user);
      setName(response.user.name);
      onUserChange(response.user);
      try {
        const institutionResponse = await api.listInstitutions({
          limit: 100,
          status: "all",
        });
        setInstitutions(institutionResponse.data);
      } catch {
        setInstitutions([]);
      }
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        onRequireLogin("Sessao expirada. Entre novamente.");
        return;
      }
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Erro ao carregar conta",
      });
    } finally {
      setLoading(false);
    }
  }

  const trimmedName = name.trim();
  const nameChanged = account ? trimmedName !== account.name : false;
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= 120;
  const saveDisabled = !nameChanged || !nameValid || saving;
  const institutionLabels = useMemo(() => {
    const ids = account?.institutionIds ?? [];
    if (ids.length === 0) {
      return [];
    }
    const names = new Map(institutions.map((institution) => [institution.id, institution.name]));
    return ids.map((id) => names.get(id) ?? `Instituicao ${id.slice(0, 8)}`);
  }, [account?.institutionIds, institutions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await api.updateAccount({ name: trimmedName });
      setAccount(response.user);
      setName(response.user.name);
      onUserChange(response.user);
      setFeedback({ tone: "green", text: "Nome atualizado." });
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Erro ao salvar nome",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(account?.name ?? "");
    setFeedback(null);
  }

  if (loading) {
    return <AdminEmptyState loading title="Carregando Minha Conta..." />;
  }

  if (!account) {
    return (
      <section className={adminTheme.card}>
        <AdminFeedback tone="red">
          {feedback?.text ?? "Nao foi possivel carregar sua conta."}
        </AdminFeedback>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <AdminModuleHeader
        actions={
          <button
            className={adminTheme.secondaryButton}
            onClick={() => setPasswordDialogOpen(true)}
            type="button"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            Alterar senha
          </button>
        }
        description="Consulte seus dados de acesso e mantenha seu nome e senha atualizados."
        eyebrow="Conta"
        icon={UserRound}
        title="Minha Conta"
      />

      <section className={adminTheme.card}>
        <AdminSectionHeader
          description="Apenas o nome pode ser alterado por aqui."
          title="Dados pessoais"
        />
        {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback> : null}
        <form className="grid gap-4 p-4" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Nome
            <input
              autoComplete="name"
              className={adminTheme.control}
              maxLength={120}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>

          <ReadOnlyField label="E-mail" value={account.email} />

          <div className="flex flex-wrap gap-2">
            <button className={adminTheme.primaryButton} disabled={saveDisabled} type="submit">
              <Save aria-hidden="true" className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              className={adminTheme.secondaryButton}
              disabled={!nameChanged || saving}
              onClick={handleCancel}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>

      <section className={adminTheme.card}>
        <AdminSectionHeader
          description="Alteracoes de senha encerram a sessao atual."
          title="Acesso e seguranca"
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Perfil principal" value={getPrimaryRoleLabel(account)} />
          <InfoTile
            label="Status"
            value={
              <AdminStatusBadge tone={account.status === "ACTIVE" ? "green" : "red"}>
                {account.status === "ACTIVE" ? "Ativo" : "Bloqueado"}
              </AdminStatusBadge>
            }
          />
          <InfoTile
            label="Primeiro acesso"
            value={account.mustChangePassword ? "Troca pendente" : "Concluido"}
          />
          <InfoTile
            label="Ultimo acesso"
            value={account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Nao informado"}
          />
        </div>
      </section>

      <section className={adminTheme.card}>
        <AdminSectionHeader
          description="Estes dados sao definidos por administradores."
          title="Instituicoes e permissoes"
        />
        <div className="grid gap-4 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-950">Perfis</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {account.roles.map((role) => (
                <AdminStatusBadge key={role} tone={role === "SUPER_ADMIN" ? "blue" : "slate"}>
                  {role}
                </AdminStatusBadge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-950">Instituicoes</p>
            {institutionLabels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {institutionLabels.map((label) => (
                  <span
                    className="rounded-full border border-[#D8E9E4] bg-[#F8FAFA] px-3 py-1 text-xs font-medium text-[#14534D]"
                    key={label}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Nenhuma instituicao vinculada.</p>
            )}
          </div>

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Perfis, instituicoes, status e permissoes sao alterados apenas pela
            administracao.
          </p>
        </div>
      </section>

      {passwordDialogOpen ? (
        <PasswordDialog
          onClose={() => setPasswordDialogOpen(false)}
          onSuccess={() => {
            setPasswordDialogOpen(false);
            onRequireLogin("Senha alterada. Entre novamente com sua nova senha.");
          }}
        />
      ) : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {value}
      </p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200/70 bg-[#F8FAFA]/85 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm font-semibold text-slate-950">{value}</div>
    </article>
  );
}

function PasswordDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PasswordDialogState>(initialPasswordDialogState);
  const confirmationMismatch =
    state.confirmPassword.length > 0 && state.confirmPassword !== state.newPassword;
  const canSubmit =
    state.currentPassword.length > 0 &&
    state.newPassword.length > 0 &&
    state.confirmPassword.length > 0 &&
    !confirmationMismatch &&
    !state.saving;

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function updateField<K extends keyof PasswordDialogState>(
    key: K,
    value: PasswordDialogState[K],
  ) {
    setState((current) => ({ ...current, [key]: value, error: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setState((current) => ({ ...current, saving: true, error: "" }));
    try {
      await api.changeOwnPassword({
        confirmPassword: state.confirmPassword,
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
      });
      setState(initialPasswordDialogState);
      onSuccess();
    } catch (caught) {
      setState({
        ...initialPasswordDialogState,
        error: caught instanceof Error ? caught.message : "Erro ao alterar senha",
      });
    }
  }

  function handleClose() {
    setState(initialPasswordDialogState);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        aria-labelledby="change-password-title"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#D8E9E4] bg-[#F8FAFA] text-[#14534D]">
              <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950" id="change-password-title">
                Alterar senha
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                A sessao sera encerrada apos a confirmacao.
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar alteracao de senha"
            className={adminTheme.iconButton}
            onClick={handleClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {state.error ? <AdminFeedback tone="red">{state.error}</AdminFeedback> : null}

        <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
          <PasswordField
            autoComplete="current-password"
            id="current-password"
            inputRef={firstInputRef}
            label="Senha atual"
            onChange={(value) => updateField("currentPassword", value)}
            onToggle={() => updateField("showCurrent", !state.showCurrent)}
            show={state.showCurrent}
            value={state.currentPassword}
          />
          <PasswordField
            autoComplete="new-password"
            id="new-password"
            label="Nova senha"
            onChange={(value) => updateField("newPassword", value)}
            onToggle={() => updateField("showNew", !state.showNew)}
            show={state.showNew}
            value={state.newPassword}
          />
          <PasswordRequirements password={state.newPassword} />
          <PasswordField
            autoComplete="new-password"
            describedBy={confirmationMismatch ? "confirm-password-error" : undefined}
            id="confirm-password"
            label="Confirmar nova senha"
            onChange={(value) => updateField("confirmPassword", value)}
            onToggle={() => updateField("showConfirm", !state.showConfirm)}
            show={state.showConfirm}
            value={state.confirmPassword}
          />
          {confirmationMismatch ? (
            <p className="text-sm text-red-700" id="confirm-password-error">
              A confirmacao precisa ser igual a nova senha.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button className={adminTheme.secondaryButton} onClick={handleClose} type="button">
              Cancelar
            </button>
            <button className={adminTheme.primaryButton} disabled={!canSubmit} type="submit">
              {state.saving ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function PasswordField({
  autoComplete,
  describedBy,
  id,
  inputRef,
  label,
  onChange,
  onToggle,
  show,
  value,
}: {
  autoComplete: string;
  describedBy?: string;
  id: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  show: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <span className="relative">
        <input
          aria-describedby={describedBy}
          autoComplete={autoComplete}
          className={cx(adminTheme.control, "w-full pr-11")}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          ref={inputRef}
          required
          type={show ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15"
          onClick={onToggle}
          type="button"
        >
          {show ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
        </button>
      </span>
    </label>
  );
}

export function PasswordRequirements({ password }: { password: string }) {
  const items = [
    { label: "12 caracteres", valid: password.length >= 12 },
    { label: "letra maiuscula", valid: /[A-Z]/.test(password) },
    { label: "letra minuscula", valid: /[a-z]/.test(password) },
    { label: "numero", valid: /\d/.test(password) },
    { label: "caractere especial", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">Requisitos da senha</p>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs">
        {items.map((item) => (
          <li
            className={cx(
              "rounded-full border px-2 py-1",
              item.valid
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500",
            )}
            key={item.label}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
