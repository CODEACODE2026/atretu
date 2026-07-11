import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { InvoiceCancellationReason, InvoiceStatus } from "@prisma/client";
import { MAX_INVOICE_AMOUNT_CENTS } from "../money.js";

export enum InvoiceOverdueFilter {
  ALL = "all",
  OVERDUE = "overdue",
  NOT_OVERDUE = "notOverdue",
}

export enum InvoiceSort {
  DUE_DATE = "dueDate",
  CREATED_AT = "createdAt",
  AMOUNT = "amount",
  STUDENT_NAME = "studentName",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListInvoicesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(InvoiceOverdueFilter)
  overdue = InvoiceOverdueFilter.ALL;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsEnum(InvoiceSort)
  sort = InvoiceSort.DUE_DATE;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.ASC;
}

export class InvoicePreviewDto {
  @IsUUID()
  enrollmentId!: string;
}

export class CreateInvoiceDto extends InvoicePreviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INVOICE_AMOUNT_CENTS)
  amountCents!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  description?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  idempotencyKey!: string;
}

export class CancelInvoiceDto {
  @IsEnum(InvoiceCancellationReason)
  reason!: InvoiceCancellationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}
