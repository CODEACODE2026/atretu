import type React from "react";
import { AlertTriangle, CalendarDays, Landmark, ReceiptText, UserRound } from "lucide-react";
import { type InvoiceRecord } from "../../../lib/api";
import { formatDate, formatDateTime } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";
import {
  bankSlipDisplayNumber,
  bankSlipPresentation,
  formatLinhaDigitavelDisplay,
  formatOptionalFinanceCents,
  isFullBankSlipRecord,
  type BankSlipListRecord,
} from "./finance-display-utils";
import { BankSlipStatusBadge, InvoiceStatusBadge } from "./invoice-status-badge";

export function InvoiceDetails({
  bankSlip,
  invoice,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
  invoice: InvoiceRecord;
}) {
  const slipPresentation = bankSlipPresentation(bankSlip);

  return (
    <section className={cx(adminTheme.softPanel, "mt-4 grid gap-4 p-4")} aria-label="Detalhes da fatura">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Detalhes da fatura</h3>
          <p className="mt-1 text-sm text-slate-600">
            Dados financeiros, acadêmicos e bancários desta cobrança.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InvoiceStatusBadge invoice={invoice} />
          <BankSlipStatusBadge bankSlip={bankSlip} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DetailGroup icon={ReceiptText} title="Fatura">
          <DetailLine label="Valor" value={invoice.amountFormatted} />
          <DetailLine label="Vencimento" value={formatDate(invoice.dueDate)} />
          <DetailLine label="Descrição" value={invoice.description || "Sem descrição"} />
          <DetailLine label="Criada em" value={formatDateTime(invoice.createdAt)} />
          <DetailLine label="Atualizada em" value={formatDateTime(invoice.updatedAt)} />
          {invoice.cancelledAt ? <DetailLine label="Cancelada em" value={formatDateTime(invoice.cancelledAt)} /> : null}
        </DetailGroup>

        <DetailGroup icon={UserRound} title="Acadêmico">
          <DetailLine label="Nome" value={invoice.student.person.fullName} />
          <DetailLine label="CPF" value={invoice.student.person.cpfMasked} />
          <DetailLine label="Matrícula" value={invoice.enrollment.id.slice(0, 8)} />
          <DetailLine label="Situação" value={invoice.student.status === "ACTIVE" ? "Ativo" : invoice.student.status} />
        </DetailGroup>

        <DetailGroup icon={Landmark} title="Matrícula e instituição">
          <DetailLine label="Ano letivo" value={String(invoice.enrollment.academicYear.year)} />
          <DetailLine label="Instituição" value={invoice.enrollment.institution.name} />
          <DetailLine label="Curso" value={invoice.enrollment.course} />
          <DetailLine label="Série" value={invoice.enrollment.grade} />
          <DetailLine label="Turno" value={invoice.enrollment.shift.name} />
        </DetailGroup>
      </div>

      <DetailGroup icon={CalendarDays} title="Boleto">
        {bankSlip === undefined ? (
          <p className="text-sm text-slate-500">Carregando dados do boleto...</p>
        ) : !bankSlip ? (
          <p className="text-sm text-slate-600">
            Esta fatura ainda não possui boleto emitido.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailLine label="Situação" value={slipPresentation.label} />
            <DetailLine label="Nosso número" value={bankSlipDisplayNumber(bankSlip)} />
            <DetailLine label="Emissão" value={formatDateTime(bankSlip.issuedAt)} />
            <DetailLine label="Última consulta" value={formatDateTime(bankSlip.lastCheckedAt)} />
            <DetailLine label="Pagamento" value={formatDateTime(bankSlip.paidAt)} />
            <DetailLine label="Baixa confirmada" value={formatDateTime(bankSlip.cancelledAt)} />
            {isFullBankSlipRecord(bankSlip) ? (
              <>
                <DetailLine label="Ambiente" value={bankSlip.environment === "PRODUCTION" ? "Produção" : "Homologação"} />
                <DetailLine label="Seu número" value={bankSlip.seuNumero} />
                <DetailLine label="Valor pago" value={formatOptionalFinanceCents(bankSlip.paidAmountCents)} />
                <DetailLine label="Baixa solicitada" value={formatDateTime(bankSlip.cancellationRequestedAt)} />
                <DetailLine label="PDF arquivado" value={formatDateTime(bankSlip.pdfStoredAt)} />
                {bankSlip.linhaDigitavel ? (
                  <DetailLine
                    className="md:col-span-2 xl:col-span-3"
                    label="Linha digitável"
                    value={formatLinhaDigitavelDisplay(bankSlip.linhaDigitavel)}
                    wrap
                  />
                ) : null}
                {bankSlip.codigoBarras ? (
                  <DetailLine
                    className="md:col-span-2 xl:col-span-3"
                    label="Código de barras"
                    value={bankSlip.codigoBarras}
                    wrap
                  />
                ) : null}
                {bankSlip.providerStatus ? (
                  <DetailLine label="Situação bancária" value={bankSlip.providerStatus} />
                ) : null}
                {bankSlip.providerErrorMessage ? (
                  <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex gap-2">
                      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{bankSlip.providerErrorMessage}</p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </DetailGroup>
    </section>
  );
}

function DetailGroup({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof ReceiptText;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#1F6F5F]" />
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      </div>
      <div className="grid min-w-0 gap-2">{children}</div>
    </section>
  );
}

function DetailLine({
  className,
  label,
  value,
  wrap = false,
}: {
  className?: string;
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <p className={cx("min-w-0 text-sm text-slate-700", className)}>
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className={cx("font-medium text-slate-950", wrap && "break-all")}>{value || "-"}</span>
    </p>
  );
}
