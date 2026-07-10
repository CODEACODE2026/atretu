"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  api,
  type PreRegistrationOptions,
  type PublicPreRegistrationFiles,
  type PublicPreRegistrationPayload,
} from "../../lib/api";

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

export default function PreCadastroPage() {
  const [form, setForm] = useState<PublicPreRegistrationPayload>(emptyForm);
  const [files, setFiles] = useState<PublicPreRegistrationFiles>({});
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
    setForm((current) => ({ ...current, [key]: value }));
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
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <form
        className="mx-auto grid max-w-4xl gap-5 rounded border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Atretu</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Pre-cadastro
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
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

        <Section title="Identificacao">
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
              value={form.phone ?? ""}
            />
          </div>
          <Field
            label="E-mail"
            onChange={(value) => update("email", value)}
            type="email"
            value={form.email ?? ""}
          />
        </Section>

        <Section title="Endereco">
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
        </Section>

        <Section title="Responsavel opcional">
          <Field
            label="Nome completo"
            onChange={(value) => update("guardianFullName", value)}
            value={form.guardianFullName ?? ""}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CPF"
              onChange={(value) => update("guardianCpf", value)}
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
          <div className="grid gap-3 sm:grid-cols-2">
            {documentFields.map((item) => (
              <label
                className="block text-sm font-medium text-slate-700"
                key={item.field}
              >
                {item.label}
                <input
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="mt-1 block w-full text-xs text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                  onChange={(event) =>
                    setFiles((current) => ({
                      ...current,
                      [item.field]: event.target.files?.[0],
                    }))
                  }
                  type="file"
                />
              </label>
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

        <button
          className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={sending || loading}
          type="submit"
        >
          {sending ? "Enviando..." : "Enviar pre-cadastro"}
        </button>
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

function Field({
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
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
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
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

function cleanPayload(
  form: PublicPreRegistrationPayload,
): PublicPreRegistrationPayload {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  ) as PublicPreRegistrationPayload;
}
