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
  MinLength,
} from "class-validator";
import { PreRegistrationStatus } from "@prisma/client";

export enum PreRegistrationSort {
  CREATED_AT = "createdAt",
  NAME = "name",
  STATUS = "status",
}

export enum PreRegistrationSortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListPreRegistrationsDto {
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
  @IsEnum(PreRegistrationStatus)
  status: PreRegistrationStatus = PreRegistrationStatus.PENDING;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsEnum(PreRegistrationSort)
  sort: PreRegistrationSort = PreRegistrationSort.CREATED_AT;

  @IsOptional()
  @IsEnum(PreRegistrationSortOrder)
  order: PreRegistrationSortOrder = PreRegistrationSortOrder.DESC;
}

export class RejectPreRegistrationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reason!: string;
}

export class ApprovePreRegistrationDto {
  @IsOptional()
  @IsUUID()
  busId?: string;
}

export class PreRegistrationIdDto {
  @IsUUID()
  id!: string;
}
