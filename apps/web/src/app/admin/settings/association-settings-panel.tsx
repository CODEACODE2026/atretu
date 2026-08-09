"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Building2, ImageUp, RotateCcw, Save } from "lucide-react";
import {
  api,
  type AssociationSettings,
  type UpdateAssociationSettingsBody,
} from "../../../lib/api";
import { mapApiErrorMessage } from "../../../lib/formatters";
import { adminTheme, cx } from "../admin-theme";
import {
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
} from "../components/admin-ui";

const EMPTY_FORM: UpdateAssociationSettingsBody = {
  city: "",
  cnpj: "",
  complement: "",
  displayName: "",
  district: "",
  email: "",
  legalName: "",
  number: "",
  postalCode: "",
  primaryPhone: "",
  secondaryPhone: "",
  state: "",
  street: "",
  website: "",
};

export function AssociationSettingsPanel() {
  const [settings, setSettings] = useState<AssociationSettings | null>(null);
  const [form, setForm] = useState<UpdateAssociationSettingsBody>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getAssociationSettings()
      .then((response) => {
        if (!active) {
          return;
        }
        setSettings(response);
        setForm(toForm(response));
        setFeedback(null);
      })
      .catch((caught) => {
        if (active) {
          setFeedback({
            tone: "red",
            text: mapApiErrorMessage(
              caught instanceof Error ? caught.message : undefined,
            ),
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let url: string | null = null;
    if (!settings?.logoStorageKey) {
      setLogoUrl(null);
      return undefined;
    }
    let active = true;
    api
      .downloadAssociationLogo(settings.logoStorageKey)
      .then((file) => {
        if (!active) {
          return;
        }
        url = URL.createObjectURL(file.blob);
        setLogoUrl(url);
      })
      .catch(() => {
        if (active) {
          setLogoUrl(null);
        }
      });
    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [settings?.logoStorageKey]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(settings ? toForm(settings) : EMPTY_FORM),
    [form, settings],
  );

  function updateField<K extends keyof UpdateAssociationSettingsBody>(
    key: K,
    value: UpdateAssociationSettingsBody[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await api.updateAssociationSettings(form);
      setSettings(updated);
      setForm(toForm(updated));
      setFeedback({ tone: "green", text: "Configurações institucionais salvas." });
    } catch (caught) {
          setFeedback({
            tone: "red",
            text: mapApiErrorMessage(
              caught instanceof Error ? caught.message : undefined,
            ),
          });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    setFeedback(null);
    try {
      const updated = await api.updateAssociationLogo(file);
      setSettings(updated);
      setForm(toForm(updated));
      setFeedback({ tone: "green", text: "Logo oficial atualizada." });
    } catch (caught) {
      setFeedback({
        tone: "red",
        text: mapApiErrorMessage(
          caught instanceof Error ? caught.message : undefined,
        ),
      });
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    if (settings) {
      setForm(toForm(settings));
      setFeedback(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminModuleHeader
        description="Fonte central dos dados usados em documentos oficiais, cabeçalhos, rodapés e identidade institucional."
        eyebrow="Configurações"
        icon={Building2}
        title="Configurações Institucionais"
        actions={
          settings ? (
            <AdminStatusBadge tone={settings.logoStorageKey ? "green" : "orange"}>
              {settings.logoStorageKey ? "Logo configurada" : "Logo pendente"}
            </AdminStatusBadge>
          ) : null
        }
      />

      <form className={cx(adminTheme.card, "overflow-hidden")} onSubmit={handleSubmit}>
        {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback> : null}
        <AdminSectionHeader
          description="Somente Super Admin pode alterar estes dados."
          title="Dados oficiais da associação"
        />
        {loading ? (
          <div className="p-4 text-sm text-slate-600">Carregando configurações...</div>
        ) : (
          <div className="space-y-6 p-4">
            <FieldGroup title="Identificação">
              <TextField
                label="Nome institucional"
                onChange={(value) => updateField("legalName", value)}
                required
                value={form.legalName}
              />
              <TextField
                label="Nome de exibição"
                onChange={(value) => updateField("displayName", value)}
                value={form.displayName ?? ""}
              />
              <TextField
                label="CNPJ"
                onChange={(value) => updateField("cnpj", value)}
                required
                value={form.cnpj}
              />
            </FieldGroup>

            <FieldGroup title="Endereço">
              <TextField
                label="Logradouro"
                onChange={(value) => updateField("street", value)}
                required
                value={form.street}
              />
              <TextField
                label="Número"
                onChange={(value) => updateField("number", value)}
                required
                value={form.number}
              />
              <TextField
                label="Complemento"
                onChange={(value) => updateField("complement", value)}
                value={form.complement ?? ""}
              />
              <TextField
                label="Bairro"
                onChange={(value) => updateField("district", value)}
                required
                value={form.district}
              />
              <TextField
                label="CEP"
                onChange={(value) => updateField("postalCode", value)}
                required
                value={form.postalCode}
              />
              <TextField
                label="Cidade"
                onChange={(value) => updateField("city", value)}
                required
                value={form.city}
              />
              <TextField
                label="UF"
                maxLength={2}
                onChange={(value) => updateField("state", value.toUpperCase())}
                required
                value={form.state}
              />
            </FieldGroup>

            <FieldGroup title="Contato">
              <TextField
                label="Telefone principal"
                onChange={(value) => updateField("primaryPhone", value)}
                required
                value={form.primaryPhone}
              />
              <TextField
                label="Telefone secundário"
                onChange={(value) => updateField("secondaryPhone", value)}
                value={form.secondaryPhone ?? ""}
              />
              <TextField
                label="E-mail"
                onChange={(value) => updateField("email", value)}
                required
                type="email"
                value={form.email}
              />
              <TextField
                label="Site"
                onChange={(value) => updateField("website", value)}
                value={form.website ?? ""}
              />
            </FieldGroup>

            <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-20 w-28 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt="Logo oficial atual"
                        className="max-h-16 max-w-24 object-contain"
                        src={logoUrl}
                      />
                    ) : (
                      <ImageUp aria-hidden="true" className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950">
                      Identidade visual
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      PNG, JPEG ou WebP ate 2 MB. Cada envio cria uma nova versão.
                    </p>
                    {settings?.logoFileName ? (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        Atual: {settings.logoFileName}
                      </p>
                    ) : null}
                  </div>
                </div>
                <label className={cx(buttonClass("secondary"), uploading ? "opacity-70" : "cursor-pointer")}>
                  <ImageUp aria-hidden="true" className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Alterar logo"}
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={handleLogoChange}
                    type="file"
                  />
                </label>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                className={buttonClass("secondary")}
                disabled={!dirty || saving}
                onClick={handleReset}
                type="button"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Cancelar
              </button>
              <button
                className={buttonClass("primary")}
                disabled={!dirty || saving}
                type="submit"
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function FieldGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-slate-950">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function TextField({
  label,
  maxLength,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="min-w-0 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function buttonClass(variant: "primary" | "secondary") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  );
}

function toForm(settings: AssociationSettings): UpdateAssociationSettingsBody {
  return {
    city: settings.city,
    cnpj: settings.cnpj,
    complement: settings.complement ?? "",
    displayName: settings.displayName ?? "",
    district: settings.district,
    email: settings.email,
    legalName: settings.legalName,
    number: settings.number,
    postalCode: settings.postalCode,
    primaryPhone: settings.primaryPhone,
    secondaryPhone: settings.secondaryPhone ?? "",
    state: settings.state,
    street: settings.street,
    website: settings.website ?? "",
  };
}
