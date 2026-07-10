import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function trimLower(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class CreatePublicPreRegistrationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Transform(({ value }) => trim(value))
  fullName!: string;

  @IsString()
  @MinLength(11)
  @MaxLength(18)
  @Transform(({ value }) => trim(value))
  cpf!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => trim(value))
  rg?: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => trim(value))
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  @Transform(({ value }) => trimLower(value))
  email?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  @Transform(({ value }) => trim(value))
  addressStreet!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Transform(({ value }) => trim(value))
  addressNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => trim(value))
  addressNeighborhood!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => trim(value))
  addressCity!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Transform(({ value }) => trim(value))
  guardianFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Transform(({ value }) => trim(value))
  guardianCpf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => trim(value))
  guardianRg?: string;

  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  institutionId!: string;

  @IsUUID()
  shiftId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  @Transform(({ value }) => trim(value))
  course!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Transform(({ value }) => trim(value))
  grade!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => trim(value))
  website?: string;
}
