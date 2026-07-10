import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsOptional } from "class-validator";
import { StudentDocumentStatus, StudentDocumentType } from "@prisma/client";

export class UploadStudentDocumentDto {
  @IsEnum(StudentDocumentType)
  documentType!: StudentDocumentType;
}

export class ListStudentDocumentsDto {
  @IsOptional()
  @IsIn([...Object.values(StudentDocumentStatus), "all"])
  status?: StudentDocumentStatus | "all";
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
