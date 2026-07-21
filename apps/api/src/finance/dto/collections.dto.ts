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
import {
  CollectionActionType,
  CollectionChannel,
} from "@prisma/client";
import { MAX_INVOICE_AMOUNT_CENTS } from "../money.js";

export enum CollectionAgingBucket {
  DAYS_1_30 = "DAYS_1_30",
  DAYS_31_60 = "DAYS_31_60",
  DAYS_61_90 = "DAYS_61_90",
  DAYS_90_PLUS = "DAYS_90_PLUS",
}

export enum CollectionOperationalStatus {
  OVERDUE_NO_ACTION = "OVERDUE_NO_ACTION",
  CONTACTED = "CONTACTED",
  PROMISE_ACTIVE = "PROMISE_ACTIVE",
  PROMISE_BROKEN = "PROMISE_BROKEN",
  FOLLOW_UP_SCHEDULED = "FOLLOW_UP_SCHEDULED",
  NO_CONTACT = "NO_CONTACT",
  PARTIAL_PAYMENT_REVIEW = "PARTIAL_PAYMENT_REVIEW",
  RESOLVED_BY_PAYMENT = "RESOLVED_BY_PAYMENT",
  CANCELLED = "CANCELLED",
}

export enum CollectionPriority {
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export class CollectionFiltersDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsEnum(CollectionAgingBucket)
  agingBucket?: CollectionAgingBucket;

  @IsOptional()
  @IsEnum(CollectionOperationalStatus)
  operationalStatus?: CollectionOperationalStatus;

  @IsOptional()
  @IsEnum(CollectionActionType)
  actionType?: CollectionActionType;

  @IsOptional()
  @IsDateString()
  followUpFrom?: string;

  @IsOptional()
  @IsDateString()
  followUpTo?: string;
}

export class ListCollectionCasesDto extends CollectionFiltersDto {
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
}

export class CollectionInvoiceParamsDto {
  @IsUUID()
  invoiceId!: string;
}

export class CreateCollectionActionDto {
  @IsEnum(CollectionActionType)
  actionType!: CollectionActionType;

  @IsOptional()
  @IsEnum(CollectionChannel)
  channel?: CollectionChannel;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  contactedName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  contactedDocumentMasked?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INVOICE_AMOUNT_CENTS)
  promisedAmountCents?: number;

  @IsOptional()
  @IsDateString()
  promiseDueDate?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}
