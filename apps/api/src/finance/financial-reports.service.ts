import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  BankSlipStatus,
  InvoiceStatus,
  ManualFinancialMovementStatus,
  ManualFinancialMovementType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { FinancialMonthlyReportDto } from "./dto/financial-reports.dto.js";

const SAO_PAULO_UTC_OFFSET_HOURS = 3;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

type CategoryRow = {
  category: string;
  count: bigint | number;
  totalCents: bigint | number | null;
};

type MonthRow = {
  expenseCents: bigint | number | null;
  incomeCents: bigint | number | null;
  invoiceCents: bigint | number | null;
  month: string;
};

@Injectable()
export class FinancialReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async monthly(query: FinancialMonthlyReportDto) {
    const selected = resolveReportMonth(query, new Date());
    const comparisonStart = periodFromStart(addMonths(selected.start, -11));
    const comparisonEndExclusive = periodFromStart(addMonths(selected.start, 1));
    const [invoiceTotal, incomeTotal, expenseTotal, expenseCategories, incomeCategories, comparisonRows] =
      await Promise.all([
        this.sumPaidInvoices(selected),
        this.sumManualMovements(selected, ManualFinancialMovementType.INCOME),
        this.sumManualMovements(selected, ManualFinancialMovementType.EXPENSE),
        this.groupManualMovementCategories(selected, ManualFinancialMovementType.EXPENSE),
        this.groupManualMovementCategories(selected, ManualFinancialMovementType.INCOME),
        this.comparison(comparisonStart, comparisonEndExclusive),
      ]);
    const totalRevenueCents = invoiceTotal + incomeTotal;
    const resultCents = totalRevenueCents - expenseTotal;

    return {
      period: {
        month: selected.month,
        year: selected.year,
        label: monthLabel(selected.start),
        timezone: "America/Sao_Paulo",
        startDate: dateKey(selected.start),
        endDateExclusive: dateKey(addMonths(selected.start, 1)),
      },
      rules: {
        invoiceRevenueDate: "BankSlip.paidAt com BankSlip.status = PAID e Invoice.status = PAID",
        manualIncomeDate: "ManualFinancialMovement.transactionDate com type = INCOME e status = RECEIVED",
        manualExpenseDate: "ManualFinancialMovement.paidAt com type = EXPENSE e status = PAID",
      },
      summary: {
        invoiceRevenueCents: invoiceTotal,
        manualIncomeCents: incomeTotal,
        totalRevenueCents,
        expenseCents: expenseTotal,
        resultCents,
        invoiceRevenueFormatted: formatReportAmount(invoiceTotal),
        manualIncomeFormatted: formatReportAmount(incomeTotal),
        totalRevenueFormatted: formatReportAmount(totalRevenueCents),
        expenseFormatted: formatReportAmount(expenseTotal),
        resultFormatted: formatReportAmount(Math.abs(resultCents)),
        resultStatus: resultCents >= 0 ? "POSITIVE" : "NEGATIVE",
      },
      comparison: buildComparison(comparisonStart, comparisonRows),
      expenseCategories: withPercentages(expenseCategories, expenseTotal),
      incomeCategories: withPercentages(incomeCategories, incomeTotal),
    };
  }

  private async sumPaidInvoices(period: ReportPeriod) {
    const rows = await this.prisma.$queryRaw<Array<{ totalCents: bigint | number | null }>>(
      Prisma.sql`
        SELECT COALESCE(SUM(COALESCE(bs.paid_amount_cents, i.amount_cents)), 0) AS "totalCents"
        FROM invoices i
        JOIN bank_slips bs ON bs.invoice_id = i.id
        WHERE i.status = ${InvoiceStatus.PAID}::"InvoiceStatus"
          AND bs.status = ${BankSlipStatus.PAID}::"BankSlipStatus"
          AND bs.paid_at >= ${period.startUtc}
          AND bs.paid_at < ${period.endUtc}
      `,
    );
    return toNumber(rows[0]?.totalCents);
  }

  private async sumManualMovements(
    period: ReportPeriod,
    type: ManualFinancialMovementType,
  ) {
    const where = manualMovementWhere(period, type);
    const result = await this.prisma.manualFinancialMovement.aggregate({
      where,
      _sum: { amountCents: true },
    });
    return result._sum.amountCents ?? 0;
  }

  private async groupManualMovementCategories(
    period: ReportPeriod,
    type: ManualFinancialMovementType,
  ) {
    const rows = await this.prisma.manualFinancialMovement.groupBy({
      by: ["category"],
      where: manualMovementWhere(period, type),
      _count: { _all: true },
      _sum: { amountCents: true },
      orderBy: { category: "asc" },
    });
    return rows.map((row) => ({
      category: row.category,
      count: row._count._all,
      totalCents: row._sum.amountCents ?? 0,
    }));
  }

  private async comparison(start: ReportPeriod, endExclusive: ReportPeriod) {
    return this.prisma.$queryRaw<MonthRow[]>(
      Prisma.sql`
        WITH months AS (
          SELECT generate_series(${start.date}::date, (${endExclusive.date}::date - INTERVAL '1 month'), INTERVAL '1 month')::date AS month_start
        ),
        invoice_totals AS (
          SELECT date_trunc('month', bs.paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS month_start,
                 SUM(COALESCE(bs.paid_amount_cents, i.amount_cents)) AS total
          FROM invoices i
          JOIN bank_slips bs ON bs.invoice_id = i.id
          WHERE i.status = ${InvoiceStatus.PAID}::"InvoiceStatus"
            AND bs.status = ${BankSlipStatus.PAID}::"BankSlipStatus"
            AND bs.paid_at >= ${start.startUtc}
            AND bs.paid_at < ${endExclusive.startUtc}
          GROUP BY 1
        ),
        manual_income AS (
          SELECT date_trunc('month', transaction_date)::date AS month_start,
                 SUM(amount_cents) AS total
          FROM manual_financial_movements
          WHERE type = ${ManualFinancialMovementType.INCOME}::"ManualFinancialMovementType"
            AND status = ${ManualFinancialMovementStatus.RECEIVED}::"ManualFinancialMovementStatus"
            AND transaction_date >= ${start.date}::date
            AND transaction_date < ${endExclusive.date}::date
          GROUP BY 1
        ),
        manual_expense AS (
          SELECT date_trunc('month', paid_at)::date AS month_start,
                 SUM(amount_cents) AS total
          FROM manual_financial_movements
          WHERE type = ${ManualFinancialMovementType.EXPENSE}::"ManualFinancialMovementType"
            AND status = ${ManualFinancialMovementStatus.PAID}::"ManualFinancialMovementStatus"
            AND paid_at >= ${start.date}::date
            AND paid_at < ${endExclusive.date}::date
          GROUP BY 1
        )
        SELECT to_char(months.month_start, 'YYYY-MM') AS month,
               COALESCE(invoice_totals.total, 0) AS "invoiceCents",
               COALESCE(manual_income.total, 0) AS "incomeCents",
               COALESCE(manual_expense.total, 0) AS "expenseCents"
        FROM months
        LEFT JOIN invoice_totals ON invoice_totals.month_start = months.month_start
        LEFT JOIN manual_income ON manual_income.month_start = months.month_start
        LEFT JOIN manual_expense ON manual_expense.month_start = months.month_start
        ORDER BY months.month_start ASC
      `,
    );
  }
}

type ReportPeriod = ReturnType<typeof resolveReportMonth>;

export function resolveReportMonth(
  query: FinancialMonthlyReportDto,
  now: Date,
) {
  const current = saoPauloParts(now);
  const year = Number(query.year ?? current.year);
  const month = Number(query.month ?? current.month);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new BadRequestException("Ano invalido");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new BadRequestException("Mes invalido");
  }
  const start = new Date(Date.UTC(year, month - 1, 1, SAO_PAULO_UTC_OFFSET_HOURS));
  const end = addMonths(start, 1);
  return {
    date: dateKey(start),
    endUtc: end,
    month,
    start,
    startUtc: start,
    year,
  };
}

function periodFromStart(start: Date) {
  return {
    date: dateKey(start),
    endUtc: addMonths(start, 1),
    month: start.getUTCMonth() + 1,
    start,
    startUtc: start,
    year: start.getUTCFullYear(),
  };
}

function manualMovementWhere(
  period: ReportPeriod,
  type: ManualFinancialMovementType,
): Prisma.ManualFinancialMovementWhereInput {
  const next = addMonths(period.start, 1);
  if (type === ManualFinancialMovementType.INCOME) {
    return {
      type,
      status: ManualFinancialMovementStatus.RECEIVED,
      transactionDate: { gte: period.start, lt: next },
    };
  }
  return {
    type,
    status: ManualFinancialMovementStatus.PAID,
    paidAt: { gte: period.start, lt: next },
  };
}

function buildComparison(start: ReportPeriod, rows: MonthRow[]) {
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  return Array.from({ length: 12 }, (_, index) => {
    const monthStart = addMonths(start.start, index);
    const key = dateKey(monthStart).slice(0, 7);
    const row = byMonth.get(key);
    const invoiceRevenueCents = toNumber(row?.invoiceCents);
    const manualIncomeCents = toNumber(row?.incomeCents);
    const revenueCents = invoiceRevenueCents + manualIncomeCents;
    const expenseCents = toNumber(row?.expenseCents);
    const resultCents = revenueCents - expenseCents;
    return {
      month: key,
      label: monthLabel(monthStart),
      revenueCents,
      expenseCents,
      resultCents,
      revenueFormatted: formatReportAmount(revenueCents),
      expenseFormatted: formatReportAmount(expenseCents),
      resultFormatted: formatReportAmount(Math.abs(resultCents)),
      resultStatus: resultCents >= 0 ? "POSITIVE" : "NEGATIVE",
    };
  });
}

function withPercentages(rows: CategoryRow[], totalCents: number) {
  return rows.map((row) => {
    const amount = toNumber(row.totalCents);
    return {
      category: row.category,
      count: Number(row.count),
      totalCents: amount,
      totalFormatted: formatReportAmount(amount),
      percentage: totalCents > 0 ? Math.round((amount / totalCents) * 10000) / 100 : 0,
    };
  });
}

function saoPauloParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(value);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month") };
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth() + months,
    1,
    SAO_PAULO_UTC_OFFSET_HOURS,
  ));
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthLabel(value: Date) {
  return MONTH_LABEL_FORMATTER.format(value).replace(".", "");
}

function toNumber(value: bigint | number | null | undefined) {
  return typeof value === "bigint" ? Number(value) : value ?? 0;
}

function formatReportAmount(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(amountCents / 100);
}
