import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  OfficialDocumentDynamicSignatureMode,
  OfficialDocumentModelStatus,
  OfficialDocumentType,
} from "@prisma/client";
import { FileDisposition } from "../../documents/dto/documents.dto.js";

export class OfficialDocumentTypeParamDto {
  @IsEnum(OfficialDocumentType)
  type!: OfficialDocumentType;
}

export class DownloadOfficialDocumentDto {
  @IsOptional()
  @IsEnum(FileDisposition)
  @Transform(({ value }) => (value === "" ? undefined : value))
  disposition: FileDisposition = FileDisposition.ATTACHMENT;
}

export class IssueOfficialDocumentDto {
  @IsOptional()
  @IsDateString()
  finalClearanceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  bankAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  bankAccountType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  bankAgency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  bankName?: string;

  @IsOptional()
  @IsDateString()
  firstInstallmentDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000000)
  installmentAmountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  installmentCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  pixKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000000)
  refundAmountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000000)
  totalAmountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reason?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  notificationDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  regularizationDeadlineDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  notes?: string;
}

export class IssueInstitutionalOfficialDocumentDto {
  @IsOptional()
  @IsDateString()
  approvalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  notes?: string;
}

export class CreateOfficialDocumentModelDto {
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  description?: string;

  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  category!: string;

  @IsString()
  @MaxLength(20000)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  content!: string;

  @IsOptional()
  @IsEnum(OfficialDocumentDynamicSignatureMode)
  signatureMode?: OfficialDocumentDynamicSignatureMode;
}

export class UpdateOfficialDocumentModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  content?: string;

  @IsOptional()
  @IsEnum(OfficialDocumentDynamicSignatureMode)
  signatureMode?: OfficialDocumentDynamicSignatureMode;
}

export class UpdateOfficialDocumentModelStatusDto {
  @IsEnum(OfficialDocumentModelStatus)
  status!: OfficialDocumentModelStatus;
}

export class IssueDynamicOfficialDocumentDto {
  @IsOptional()
  @IsObject()
  inputs?: Record<string, string>;
}
