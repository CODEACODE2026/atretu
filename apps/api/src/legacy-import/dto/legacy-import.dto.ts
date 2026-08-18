import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class LegacyAcademicRawRecordDto {
  @IsOptional()
  @IsInt()
  legacy_id?: number;

  @IsOptional()
  numero_carterinha?: unknown;

  @IsOptional()
  nome_aluno?: unknown;

  @IsOptional()
  endereco?: unknown;

  @IsOptional()
  cpf?: unknown;

  @IsOptional()
  rg?: unknown;

  @IsOptional()
  data_nacimento?: unknown;

  @IsOptional()
  nome_instituicao?: unknown;

  @IsOptional()
  curso?: unknown;

  @IsOptional()
  serie?: unknown;

  @IsOptional()
  nome_turno?: unknown;

  @IsOptional()
  telefone?: unknown;

  @IsOptional()
  email?: unknown;

  @IsOptional()
  data_cadastro?: unknown;

  @IsOptional()
  status?: unknown;

  @IsOptional()
  chapa?: unknown;

  @IsOptional()
  nome_onibus?: unknown;

  @IsOptional()
  capacidade_onibus?: unknown;

  @IsOptional()
  observacao?: unknown;

  @IsOptional()
  criado?: unknown;
}

export class AnalyzeLegacyAcademicImportDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  destinationAcademicYear!: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(512 * 1024)
  sizeBytes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LegacyAcademicRawRecordDto)
  records!: LegacyAcademicRawRecordDto[];
}

export class ImportLegacyAcademicSelectionDto extends AnalyzeLegacyAcademicImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  selectedLegacyIds!: number[];

  @IsOptional()
  @IsBoolean()
  confirmReviewRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  createMissingBaseRecords?: boolean;
}

export class LegacyFinancialRawRecordDto {
  @IsOptional()
  @IsInt()
  legacy_financial_id?: number;

  @IsOptional()
  @IsInt()
  legacy_student_id?: number;

  @IsOptional()
  data_emissao?: unknown;

  @IsOptional()
  data_vencimento?: unknown;

  @IsOptional()
  status_boleto?: unknown;

  @IsOptional()
  valor_boleto?: unknown;

  @IsOptional()
  linha_digitavel?: unknown;

  @IsOptional()
  nosso_numero?: unknown;

  @IsOptional()
  codigo_barras?: unknown;

  @IsOptional()
  caminho_boleto?: unknown;

  @IsOptional()
  caminhao_boleto?: unknown;

  @IsOptional()
  valor_multa?: unknown;

  @IsOptional()
  valor_juros?: unknown;

  @IsOptional()
  valor_pago?: unknown;

  @IsOptional()
  data_pagamento?: unknown;

  @IsOptional()
  situacao_boleto?: unknown;

  @IsOptional()
  status_mail?: unknown;

  @IsOptional()
  dt_envio_boleto?: unknown;
}

export class AnalyzeLegacyFinancialImportDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  sizeBytes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => LegacyFinancialRawRecordDto)
  records!: LegacyFinancialRawRecordDto[];
}

export class ImportLegacyFinancialSelectionDto extends AnalyzeLegacyFinancialImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  selectedLegacyStudentIds!: number[];

  @IsOptional()
  @IsBoolean()
  confirmReadOnlyHistoryOnly?: boolean;
}
