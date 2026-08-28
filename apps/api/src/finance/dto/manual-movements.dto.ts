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
} from "class-validator";
import {
  ManualFinancialMovementCategory,
  ManualFinancialMovementStatus,
  ManualFinancialMovementType,
} from "@prisma/client";
import { MAX_INVOICE_AMOUNT_CENTS } from "../money.js";

export class ManualFinancialMovementParamsDto {
  @IsUUID()
  movementId!: string;
}

export class ManualFinancialMovementAttachmentParamsDto extends ManualFinancialMovementParamsDto {
  @IsUUID()
  attachmentId!: string;
}

export class ListManualFinancialMovementsDto {
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
  @IsEnum(ManualFinancialMovementType)
  type?: ManualFinancialMovementType;

  @IsOptional()
  @IsEnum(ManualFinancialMovementCategory)
  category?: ManualFinancialMovementCategory;

  @IsOptional()
  @IsEnum(ManualFinancialMovementStatus)
  status?: ManualFinancialMovementStatus;

  @IsOptional()
  @IsDateString()
  transactionDateFrom?: string;

  @IsOptional()
  @IsDateString()
  transactionDateTo?: string;

  @IsOptional()
  @IsDateString()
  competenceFrom?: string;

  @IsOptional()
  @IsDateString()
  competenceTo?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class ListManualMovementStudentOptionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit = 10;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;
}

export class CreateManualFinancialMovementDto {
  @IsEnum(ManualFinancialMovementType)
  type!: ManualFinancialMovementType;

  @IsEnum(ManualFinancialMovementCategory)
  category!: ManualFinancialMovementCategory;

  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  description!: string;

  @Type(() => Number)
  @IsInt({ message: "Valor deve ser um inteiro em centavos" })
  @Min(1, { message: "Valor deve ser maior que zero" })
  @Max(MAX_INVOICE_AMOUNT_CENTS)
  amountCents!: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsDateString()
  competenceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  supplierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : value,
  )
  supplierDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  notes?: string;
}

export class UpdateManualFinancialMovementDto {
  @IsOptional()
  @IsEnum(ManualFinancialMovementCategory)
  category?: ManualFinancialMovementCategory;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Valor deve ser um inteiro em centavos" })
  @Min(1, { message: "Valor deve ser maior que zero" })
  @Max(MAX_INVOICE_AMOUNT_CENTS)
  amountCents?: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsDateString()
  competenceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  supplierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : value,
  )
  supplierDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  notes?: string;
}

export class MarkManualFinancialMovementPaidDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class CancelManualFinancialMovementDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reason?: string;
}
