"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, FileText, Send, Upload, X } from "lucide-react";
import {
  api,
  type PreRegistrationOptions,
  type PublicPreRegistrationFiles,
  type PublicPreRegistrationPayload,
} from "../../lib/api";
import { maskCpf, maskPhone, onlyDigits } from "../../lib/formatters";

const emptyForm: PublicPreRegistrationPayload = {
  fullName: "",
  cpf: "",
  rg: "",
  birthDate: "",
  phone: "",
  email: "",
  addressStreet: "",
  addressNumber: "",
  addressNeighborhood: "",
  addressCity: "",
  guardianFullName: "",
  guardianCpf: "",
  guardianRg: "",
  academicYearId: "",
  institutionId: "",
  shiftId: "",
  course: "",
  grade: "",
  website: "",
};

const documentFields: Array<{
  field: keyof PublicPreRegistrationFiles;
  label: string;
}> = [
  { field: "cpfDocument", label: "CPF" },
  { field: "rgDocument", label: "RG" },
  { field: "proofOfAddressDocument", label: "Comprovante de residencia" },
  { field: "proofOfEnrollmentDocument", label: "Comprovante de matricula" },
];

const acceptedDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const acceptedDocumentExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const documentMaxSizeBytes = 8 * 1024 * 1024;

export default function PreCadastroPage() {
  const [form, setForm] = useState<PublicPreRegistrationPayload>(emptyForm);
  const [files, setFiles] = useState<PublicPreRegistrationFiles>({});
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof PublicPreRegistrationFiles, string>>
  >({});
  const [options, setOptions] = useState<PreRegistrationOptions>({
    academicYears: [],
    institutions: [],
    shifts: [],
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getPreRegistrationOptions()
      .then((response) => {
        if (!active) {
          return;
        }
        setOptions(response);
        const currentYear = response.academicYears.find((year) => year.isCurrent);
        setForm((current) => ({
          ...current,
          academicYearId:
            current.academicYearId ||
            currentYear?.id ||
            response.academicYears[0]?.id ||
            "",
        }));
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Erro ao carregar formulario",
          );
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

  function update(key: keyof PublicPreRegistrationPayload, value: string) {
    const masked =
      key === "cpf" || key === "guardianCpf"
        ? maskCpf(value)
        : key === "phone"
          ? maskPhone(value)
          : value;
    setForm((current) => ({ ...current, [key]: masked }));
  }

  function updateFile(field: keyof PublicPreRegistrationFiles, file?: File) {
    if (!file) {
      setFiles((current) => ({ ...current, [field]: undefined }));
      setFileErrors((current) => ({ ...current, [field]: undefined }));
      return;
    }
    const errorMessage = validateFile(file);
    if (errorMessage) {
      setFiles((current) => ({ ...current, [field]: undefined }));
      setFileErrors((current) => ({ ...current, [field]: errorMessage }));
      return;
    }
    setFiles((current) => ({ ...current, [field]: file }));
    setFileErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await api.createPublicPreRegistration(cleanPayload(form), files);
      setMessage(
        response.publicCode
          ? `Solicitacao recebida. Protocolo ${response.publicCode}.`
          : response.message,
      );
      setForm(emptyForm);
      setFiles({});
      setFileErrors({});
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel enviar a solicitacao",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F3F6F8] px-4 py-6 text-slate-950 sm:py-8">
      <form
        className="mx-auto grid max-w-4xl gap-5 rounded-xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_rgba(15,46,46,0.035)] sm:p-6"
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200/80 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Atretu
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
            Pre-cadastro
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Envie os dados para analise administrativa. O envio nao cria matricula
            definitiva, nao reserva vaga de onibus e nao gera cobranca.
          </p>
        </div>

        {message ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Section title="Dados pessoais">
          <Field
            label="Nome completo"
            onChange={(value) => update("fullName", value)}
            required
            value={form.fullName}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CPF"
              onChange={(value) => update("cpf", value)}
              placeholder="000.000.000-00"
              required
              value={form.cpf}
            />
            <Field
              label="RG"
              onChange={(value) => update("rg", value)}
              value={form.rg ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nascimento"
              onChange={(value) => update("birthDate", value)}
              required
              type="date"
              value={form.birthDate}
            />
            <Field
              label="Telefone"
              onChange={(value) => update("phone", value)}
              placeholder="(00) 00000-0000"
              value={form.phone ?? ""}
            />
          </div>
          <Field
            label="E-mail"
            onChange={(value) => update("email", value)}
            type="email"
            value={form.email ?? ""}
          />
          <SubsectionTitle>Endereco</SubsectionTitle>
          <Field
            label="Logradouro"
            onChange={(value) => update("addressStreet", value)}
            required
            value={form.addressStreet}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Numero"
              onChange={(value) => update("addressNumber", value)}
              required
              value={form.addressNumber}
            />
            <Field
              label="Bairro"
              onChange={(value) => update("addressNeighborhood", value)}
              required
              value={form.addressNeighborhood}
            />
            <Field
              label="Cidade"
              onChange={(value) => update("addressCity", value)}
              required
              value={form.addressCity}
            />
          </div>
          <SubsectionTitle>Responsavel opcional</SubsectionTitle>
          <Field
            label="Nome completo"
            onChange={(value) => update("guardianFullName", value)}
            value={form.guardianFullName ?? ""}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CPF"
              onChange={(value) => update("guardianCpf", value)}
              placeholder="000.000.000-00"
              value={form.guardianCpf ?? ""}
            />
            <Field
              label="RG"
              onChange={(value) => update("guardianRg", value)}
              value={form.guardianRg ?? ""}
            />
          </div>
        </Section>

        <Section title="Dados academicos">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Ano Letivo"
              loading={loading}
              onChange={(value) => update("academicYearId", value)}
              options={options.academicYears.map((year) => ({
                label: year.isCurrent ? `${year.year} atual` : String(year.year),
                value: year.id,
              }))}
              required
              value={form.academicYearId}
            />
            <Select
              label="Instituicao"
              loading={loading}
              onChange={(value) => update("institutionId", value)}
              options={options.institutions.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
              required
              value={form.institutionId}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Curso"
              onChange={(value) => update("course", value)}
              required
              value={form.course}
            />
            <Field
              label="Serie"
              onChange={(value) => update("grade", value)}
              required
              value={form.grade}
            />
          </div>
          <Select
            label="Turno"
            loading={loading}
            onChange={(value) => update("shiftId", value)}
            options={options.shifts.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            required
            value={form.shiftId}
          />
        </Section>

        <Section title="Documentos opcionais">
          <p className="text-sm leading-6 text-slate-600">
            Anexe PDF, JPG ou PNG quando ja tiver os documentos em maos.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {documentFields.map((item) => (
              <DocumentUpload
                error={fileErrors[item.field]}
                field={item.field}
                file={files[item.field]}
                key={item.field}
                label={item.label}
                onChange={updateFile}
              />
            ))}
          </div>
        </Section>

        <input
          autoComplete="off"
          className="hidden"
          onChange={(event) => update("website", event.target.value)}
          tabIndex={-1}
          value={form.website ?? ""}
        />

        <section className="grid gap-3 rounded-xl border border-[#C8DAD4] bg-[#F8FAFA]/85 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Envio</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Revise seus dados antes de enviar.
            </p>
          </div>
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#0F2E2E] bg-[#0F2E2E] px-4 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#174443] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 motion-reduce:transition-none sm:w-fit"
            disabled={sending || loading}
            type="submit"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar pre-cadastro"}
          </button>
        </section>
      </form>
    </main>
  );
}

function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 border-t border-slate-200 pt-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function SubsectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-1 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h3>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 h-10 w-full rounded-lg border border-slate-300/80 bg-white px-3 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition duration-150 placeholder:text-slate-400 focus:border-[#1F6F5F] focus:ring-4 focus:ring-[#1F6F5F]/15 disabled:bg-slate-50 disabled:text-slate-400 motion-reduce:transition-none"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function Select({
  label,
  loading,
  onChange,
  options,
  required,
  value,
}: {
  label: string;
  loading: boolean;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 h-10 w-full rounded-lg border border-slate-300/80 bg-white px-3 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition duration-150 focus:border-[#1F6F5F] focus:ring-4 focus:ring-[#1F6F5F]/15 disabled:bg-slate-50 disabled:text-slate-400 motion-reduce:transition-none"
        disabled={loading}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">Selecionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DocumentUpload({
  error,
  field,
  file,
  label,
  onChange,
}: {
  error?: string;
  field: keyof PublicPreRegistrationFiles;
  file?: File;
  label: string;
  onChange: (field: keyof PublicPreRegistrationFiles, file?: File) => void;
}) {
  const inputId = `pre-cadastro-${field}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-[#F8FAFA]/80 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600">
          <FileText aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{label}</p>
          {file ? (
            <div className="mt-1 min-w-0">
              <p className="break-words text-xs font-medium text-slate-700">
                {file.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatBytes(file.size)}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Nenhum arquivo selecionado
            </p>
          )}
        </div>
      </div>

      {file ? (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
          Arquivo selecionado
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
          id={inputId}
          onChange={(event) => {
            onChange(field, event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        <label
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300/90 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition duration-150 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1F6F5F]/15 peer-focus:ring-offset-2 motion-reduce:transition-none"
          htmlFor={inputId}
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          {file ? "Trocar" : "Selecionar arquivo"}
        </label>
        {file ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300/90 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-4 focus:ring-red-100 focus:ring-offset-2 motion-reduce:transition-none"
            onClick={() => onChange(field, undefined)}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Remover
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm leading-5 text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function validateFile(file: File) {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!acceptedDocumentExtensions.has(extension)) {
    return "Formato de arquivo nao permitido. Use PDF, JPG ou PNG.";
  }
  if (file.type && !acceptedDocumentTypes.has(file.type)) {
    return "Tipo de arquivo incompativel. Use PDF, JPG ou PNG.";
  }
  if (file.size <= 0) {
    return "Arquivo vazio nao permitido.";
  }
  if (file.size > documentMaxSizeBytes) {
    return "Arquivo excede o tamanho permitido de 8 MB.";
  }
  return "";
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function cleanPayload(
  form: PublicPreRegistrationPayload,
): PublicPreRegistrationPayload {
  const cleaned = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  ) as PublicPreRegistrationPayload;
  return {
    ...cleaned,
    cpf: onlyDigits(cleaned.cpf),
    guardianCpf: cleaned.guardianCpf ? onlyDigits(cleaned.guardianCpf) : undefined,
    phone: cleaned.phone ? onlyDigits(cleaned.phone) : undefined,
  };
}
