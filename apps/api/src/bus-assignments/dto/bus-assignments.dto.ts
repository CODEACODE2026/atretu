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

export enum AssignmentStatusFilter {
  ACTIVE = "active",
  ALL = "all",
}

export class AssignBusDto {
  @IsUUID()
  busId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}

export class SwitchBusDto {
  @IsUUID()
  newBusId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}

export class ReleaseBusDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  note?: string;
}

export class ListBusAssignmentsDto {
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
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsEnum(AssignmentStatusFilter)
  status = AssignmentStatusFilter.ACTIVE;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;
}
