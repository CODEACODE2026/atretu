import { Transform, Type } from "class-transformer";
import {
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
  StudentCardInvalidationReason,
  StudentCardStatus,
  StudentCardType,
} from "@prisma/client";
import { FileDisposition } from "../../documents/dto/documents.dto.js";

export enum StudentCardValidityFilter {
  ALL = "all",
  USABLE = "usable",
  NOT_USABLE = "notUsable",
}

export enum StudentCardSort {
  ISSUED_AT = "issuedAt",
  CARD_NUMBER = "cardNumber",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListStudentCardsDto {
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
  @IsEnum(StudentCardType)
  cardType?: StudentCardType;

  @IsOptional()
  @IsEnum(StudentCardStatus)
  status?: StudentCardStatus;

  @IsOptional()
  @IsEnum(StudentCardValidityFilter)
  validity = StudentCardValidityFilter.ALL;

  @IsOptional()
  @IsEnum(StudentCardSort)
  sort = StudentCardSort.ISSUED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.DESC;
}

export class StudentCardPreviewDto {
  @IsUUID()
  enrollmentId!: string;

  @IsEnum(StudentCardType)
  cardType!: StudentCardType;

  @IsOptional()
  @IsUUID()
  boardMembershipId?: string;
}

export class IssueStudentCardDto extends StudentCardPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}

export class InvalidateStudentCardDto {
  @IsEnum(StudentCardInvalidationReason)
  reason!: StudentCardInvalidationReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}

export class StudentCardPdfDto {
  @IsOptional()
  @IsEnum(FileDisposition)
  @Transform(({ value }) => (value === "" ? undefined : value))
  disposition: FileDisposition = FileDisposition.INLINE;
}
