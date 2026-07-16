import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { InvoiceCancellationReason } from "@prisma/client";

export class InvoiceBankSlipParamsDto {
  @IsUUID()
  invoiceId!: string;
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
