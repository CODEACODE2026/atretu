import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { InvoiceCancellationReason } from "@prisma/client";

export class InvoiceBankSlipParamsDto {
  @IsUUID()
  invoiceId!: string;
}

export class BankSlipSyncRunParamsDto {
  @IsUUID()
  runId!: string;
}

export class BankSlipIssueBatchParamsDto {
  @IsUUID()
  batchId!: string;
}

export class CreateBankSlipIssueBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  invoiceIds!: string[];
}

export class ListBankSlipIssueBatchesDto {
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

export class ListBankSlipIssueBatchItemsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

export class CancelBankSlipIssueBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reason?: string;
}

export class RetryBankSlipIssueBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reason?: string;
}

export class ListBankSlipSyncRunsDto {
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

export class ListBankSlipSyncRunItemsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

export class SyncPaidBankSlipsDayDto {
  @IsDateString()
  date!: string;
}

export class RequestBankSlipCancellationDto {
  @IsEnum(InvoiceCancellationReason)
  reason!: InvoiceCancellationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}

export class RecoverIssuedBankSlipDto {
  @IsOptional()
  @IsUUID()
  bankSlipId?: string;

  @IsString()
  @Length(1, 10)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  seuNumero!: string;

  @IsString()
  @Length(1, 9)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  nossoNumero!: string;

  @IsString()
  @Length(1, 47)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  linhaDigitavel!: string;

  @IsString()
  @Length(1, 44)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  codigoBarras!: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  txid?: string;
}
