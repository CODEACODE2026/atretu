import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
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
  ValidateNested,
} from "class-validator";

export enum StudentSort {
  NAME = "name",
  JOINED_AT = "joinedAt",
  CREATED_AT = "createdAt",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListStudentsDto {
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
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsEnum(StudentSort)
  sort = StudentSort.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.ASC;
}

export class PersonInputDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  fullName!: string;

  @IsString()
  @MinLength(11)
  @MaxLength(18)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  cpf!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  rg?: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  addressStreet!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  addressNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  addressNeighborhood!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  addressCity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  addressZipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  addressState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  addressComplement?: string;
}

export class GuardianInputDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  cpf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  rg?: string;
}

export class EnrollmentInputDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  institutionId!: string;

  @IsUUID()
  shiftId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  course!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  grade!: string;
}

export class CreateStudentDto {
  @ValidateNested()
  @Type(() => PersonInputDto)
  person!: PersonInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianInputDto)
  guardian?: GuardianInputDto;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @ValidateNested()
  @Type(() => EnrollmentInputDto)
  enrollment!: EnrollmentInputDto;
}

export class UpdatePersonDto extends PersonInputDto {}

export class UpdateGuardianDto {
  @IsOptional()
  @IsBoolean()
  clear?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianInputDto)
  guardian?: GuardianInputDto;
}

export class CreateEnrollmentDto extends EnrollmentInputDto {}

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  course?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  grade?: string;
}

export class CreateAcademicYearDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateAcademicYearDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
