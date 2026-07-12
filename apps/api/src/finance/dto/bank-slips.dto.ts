import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
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
