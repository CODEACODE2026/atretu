import { Transform } from "class-transformer";
import { IsEnum, IsOptional } from "class-validator";
import { StudentDocumentStatus, StudentDocumentType } from "@prisma/client";

export class UploadStudentDocumentDto {
  @IsEnum(StudentDocumentType)
  documentType!: StudentDocumentType;
}

export class ListStudentDocumentsDto {
  @IsOptional()
  @IsEnum(StudentDocumentStatus)
  status?: StudentDocumentStatus;
}

export enum FileDisposition {
  ATTACHMENT = "attachment",
  INLINE = "inline",
}

export class DownloadStudentDocumentDto {
  @IsOptional()
  @IsEnum(FileDisposition)
  @Transform(({ value }) => (value === "" ? undefined : value))
  disposition: FileDisposition = FileDisposition.ATTACHMENT;
}
