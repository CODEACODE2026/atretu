import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
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
import { RoleCode, UserStatus } from "@prisma/client";

export enum AdminUserSort {
  CREATED_AT = "createdAt",
  EMAIL = "email",
  LAST_LOGIN_AT = "lastLoginAt",
  NAME = "name",
  STATUS = "status",
  UPDATED_AT = "updatedAt",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return value;
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

function optionalUuid(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return value;
}

export class ListAdminUsersDto {
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
  @IsEnum(RoleCode)
  role?: RoleCode;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  neverLoggedIn?: boolean;

  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  withoutInstitution?: boolean;

  @IsOptional()
  @IsEnum(AdminUserSort)
  sort = AdminUserSort.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.ASC;
}

export class CreateAdminUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;

  @IsEmail()
  @MaxLength(180)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsEnum(RoleCode)
  role!: RoleCode;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => optionalString(value))
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => optionalString(value))
  position?: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => optionalUuid(value))
  permissionProfileId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  institutionIds: string[] = [];
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => optionalString(value))
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => optionalString(value))
  position?: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => optionalUuid(value))
  permissionProfileId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  institutionIds?: string[];
}

export class UpdateAdminUserInstitutionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  institutionIds!: string[];
}
