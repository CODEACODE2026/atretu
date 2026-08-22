"use client";

import type {
  AcademicYear,
  BaseRecord,
  BusRecord,
  StudentPayload,
} from "../../../lib/api";
import { maskCep, maskCpf, maskPhone } from "../../../lib/formatters";
import { adminTheme, cx } from "../admin-theme";

export const createEmptyPerson: StudentPayload["person"] = {
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
  addressZipCode: "",
  addressState: "",
  addressComplement: "",
};

export const createEmptyEnrollment: StudentPayload["enrollment"] = {
  academicYearId: "",
  institutionId: "",
  shiftId: "",
  course: "",
  grade: "",
};

export function StudentPersonalFields({
  person,
  setPerson,
}: {
  person: StudentPayload["person"];
  setPerson: (person: StudentPayload["person"]) => void;
}) {
  function update(key: keyof StudentPayload["person"], value: string) {
    const nextValue =
      key === "cpf"
        ? maskCpf(value)
        : key === "phone"
          ? maskPhone(value)
          : value;
    setPerson({ ...person, [key]: nextValue });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Nome completo"
          onChange={(value) => update("fullName", value)}
          required
          value={person.fullName}
        />
        <Field
          label="CPF"
          onChange={(value) => update("cpf", value)}
          placeholder="000.000.000-00"
          required
          value={person.cpf}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="RG"
          onChange={(value) => update("rg", value)}
          value={person.rg ?? ""}
        />
        <Field
          label="Nascimento"
          onChange={(value) => update("birthDate", value)}
          required
          type="date"
          value={person.birthDate}
        />
        <Field
          label="Telefone"
          onChange={(value) => update("phone", value)}
          placeholder="(00) 00000-0000"
          value={person.phone ?? ""}
        />
      </div>
      <Field
        label="E-mail"
        onChange={(value) => update("email", value)}
        type="email"
        value={person.email ?? ""}
      />
    </div>
  );
}

export function StudentAddressFields({
  person,
  setPerson,
}: {
  person: StudentPayload["person"];
  setPerson: (person: StudentPayload["person"]) => void;
}) {
  function update(key: keyof StudentPayload["person"], value: string) {
    setPerson({
      ...person,
      [key]: key === "addressZipCode" ? maskCep(value) : value,
    });
  }

  return (
    <div className="grid gap-4">
      <Field
        label="Logradouro"
        onChange={(value) => update("addressStreet", value)}
        required
        value={person.addressStreet}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Numero"
          onChange={(value) => update("addressNumber", value)}
          required
          value={person.addressNumber}
        />
        <Field
          label="Bairro"
          onChange={(value) => update("addressNeighborhood", value)}
          required
          value={person.addressNeighborhood}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_96px]">
        <Field
          label="Cidade"
          onChange={(value) => update("addressCity", value)}
          required
          value={person.addressCity}
        />
        <Field
          label="UF"
          maxLength={2}
          onChange={(value) => update("addressState", value.toUpperCase())}
          value={person.addressState ?? ""}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="CEP"
          onChange={(value) => update("addressZipCode", value)}
          placeholder="00000-000"
          value={person.addressZipCode ?? ""}
        />
        <Field
          label="Complemento"
          onChange={(value) => update("addressComplement", value)}
          value={person.addressComplement ?? ""}
        />
      </div>
    </div>
  );
}

export function StudentAcademicFields({
  disabled = false,
  enrollment,
  institutions,
  setEnrollment,
  shifts,
  years,
}: {
  disabled?: boolean;
  enrollment: StudentPayload["enrollment"];
  institutions: BaseRecord[];
  setEnrollment: (enrollment: StudentPayload["enrollment"]) => void;
  shifts: BaseRecord[];
  years: AcademicYear[];
}) {
  function update(key: keyof StudentPayload["enrollment"], value: string) {
    setEnrollment({ ...enrollment, [key]: value });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledSelect
          label="Ano letivo"
          disabled={disabled}
          onChange={(value) => update("academicYearId", value)}
          options={years.map((year) => ({
            label: year.isCurrent ? `${year.year} atual` : String(year.year),
            value: year.id,
          }))}
          required
          value={enrollment.academicYearId}
        />
        <LabeledSelect
          label="Instituicao"
          disabled={disabled}
          onChange={(value) => update("institutionId", value)}
          options={institutions.map((item) => ({
            label: item.name,
            value: item.id,
          }))}
          required
          value={enrollment.institutionId}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="Curso"
          disabled={disabled}
          onChange={(value) => update("course", value)}
          required
          value={enrollment.course}
        />
        <Field
          label="Serie"
          disabled={disabled}
          onChange={(value) => update("grade", value)}
          required
          value={enrollment.grade}
        />
        <LabeledSelect
          label="Turno"
          disabled={disabled}
          onChange={(value) => update("shiftId", value)}
          options={shifts.map((item) => ({ label: item.name, value: item.id }))}
          required
          value={enrollment.shiftId}
        />
      </div>
    </div>
  );
}

export function StudentGuardianFields({
  guardian,
  setGuardian,
}: {
  guardian?: StudentPayload["guardian"];
  setGuardian: (guardian?: StudentPayload["guardian"]) => void;
}) {
  const current = guardian ?? { fullName: "", cpf: "", rg: "" };
  function update(key: keyof NonNullable<StudentPayload["guardian"]>, value: string) {
    setGuardian({ ...current, [key]: key === "cpf" ? maskCpf(value) : value });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          O responsavel e opcional. Preencha apenas quando existir uma referencia
          administrativa para o academico.
        </p>
        <button
          className={adminTheme.secondaryButton}
          onClick={() => setGuardian(undefined)}
          type="button"
        >
          Limpar responsavel
        </button>
      </div>
      <Field
        label="Nome completo"
        onChange={(value) => update("fullName", value)}
        value={current.fullName}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="CPF"
          onChange={(value) => update("cpf", value)}
          placeholder="000.000.000-00"
          value={current.cpf ?? ""}
        />
        <Field
          label="RG"
          onChange={(value) => update("rg", value)}
          value={current.rg ?? ""}
        />
      </div>
    </div>
  );
}

export function StudentTransportFields({
  busId,
  buses,
  error,
  loading,
  selectedAcademicYear,
  setBusId,
}: {
  busId: string;
  buses: BusRecord[];
  error: string;
  loading: boolean;
  selectedAcademicYear: boolean;
  setBusId: (value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className={cx(adminTheme.softPanel, "p-4")}>
        <p className="text-sm font-semibold text-slate-950">
          Transporte no cadastro
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          O ônibus é opcional no cadastro e pode ser ajustado depois no perfil do
          acadêmico.
        </p>
      </div>
      <LabeledSelect
        disabled={loading || !selectedAcademicYear}
        label="Ônibus opcional"
        onChange={setBusId}
        options={buses.map((bus) => ({
          label: `${bus.name} - ${bus.availableSeats ?? bus.capacity}/${bus.capacity} vagas`,
          value: bus.id,
        }))}
        placeholder={
          loading
            ? "Carregando onibus..."
            : selectedAcademicYear
              ? "Sem onibus no cadastro"
              : "Selecione o ano letivo primeiro"
        }
        value={busId}
      />
      {!loading && selectedAcademicYear && buses.length === 0 && !error ? (
        <p className="text-sm text-slate-500">Nenhum onibus com vaga disponivel.</p>
      ) : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

export function Field({
  disabled = false,
  label,
  maxLength,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  disabled?: boolean;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        className={cx(adminTheme.control, "mt-1 w-full")}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

export function LabeledSelect({
  disabled = false,
  label,
  onChange,
  options,
  placeholder = "Selecionar",
  required,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <select
        className={cx(adminTheme.control, "mt-1 w-full")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
