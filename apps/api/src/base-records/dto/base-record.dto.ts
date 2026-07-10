import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export enum RecordStatusFilter {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ALL = "all",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export enum BaseRecordSort {
  NAME = "name",
  STATUS = "status",
  CREATED_AT = "createdAt",
  UPDATED_AT = "updatedAt",
}

export class ListBaseRecordsDto {
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
  @IsEnum(RecordStatusFilter)
  status = RecordStatusFilter.ACTIVE;

  @IsOptional()
  @IsEnum(BaseRecordSort)
  sort = BaseRecordSort.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  order = SortOrder.ASC;
}

export class CreateNamedRecordDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;
}

export class UpdateNamedRecordDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string;
}

export class CreateBusDto extends CreateNamedRecordDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;
}

export class UpdateBusDto extends UpdateNamedRecordDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;
}
