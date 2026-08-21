import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export enum PermissionProfileStatusFilter {
  ACTIVE = "active",
  ALL = "all",
  INACTIVE = "inactive",
}

export enum PermissionProfileSort {
  CREATED_AT = "createdAt",
  NAME = "name",
  UPDATED_AT = "updatedAt",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ListPermissionProfilesDto {
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
  @IsEnum(PermissionProfileStatusFilter)
  status = PermissionProfileStatusFilter.ACTIVE;

  @IsOptional()
  @IsEnum(PermissionProfileSort)
  sort = PermissionProfileSort.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.ASC;
}

export class CreatePermissionProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(({ value }) => optionalString(value))
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive = true;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => (
    typeof item === "string" ? item.trim() : item
  )) : value))
  permissions!: string[];
}

export class UpdatePermissionProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(({ value }) => optionalString(value))
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => (
    typeof item === "string" ? item.trim() : item
  )) : value))
  permissions?: string[];
}

