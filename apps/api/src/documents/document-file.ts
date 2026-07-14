import { BadRequestException } from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { StudentDocumentType } from "@prisma/client";

export const DOCUMENT_TYPES = [
  StudentDocumentType.CPF,
  StudentDocumentType.RG,
  StudentDocumentType.PROOF_OF_ADDRESS,
  StudentDocumentType.PROOF_OF_ENROLLMENT,
] as const;

export const PHOTO_DOCUMENT_TYPES: ReadonlySet<StudentDocumentType> = new Set([
  StudentDocumentType.PHOTO,
]);

const MIME_BY_EXTENSION = new Map([
  [".pdf", "application/pdf"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
]);

export type ValidatedDocumentFile = {
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
};

export type UploadedDocumentFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export function validateDocumentFile(
  file: UploadedDocumentFile | undefined,
  maxSizeBytes: number,
  options?: { allowedMimeTypes?: readonly string[] },
): ValidatedDocumentFile {
  if (!file?.buffer) {
    throw new BadRequestException("Arquivo obrigatorio");
  }

  if (!file.originalname || file.originalname.trim().length === 0) {
    throw new BadRequestException("Nome do arquivo obrigatorio");
  }

  const sizeBytes = file.size ?? file.buffer.length;
  if (sizeBytes <= 0 || file.buffer.length <= 0) {
    throw new BadRequestException("Arquivo vazio nao permitido");
  }

  if (sizeBytes > maxSizeBytes) {
    throw new BadRequestException("Arquivo excede o tamanho permitido");
  }

  const originalFileName = sanitizeOriginalFileName(file.originalname);
  const extension = path.extname(originalFileName).toLowerCase();
  const expectedMime = MIME_BY_EXTENSION.get(extension);
  if (!expectedMime) {
    throw new BadRequestException("Formato de arquivo nao permitido");
  }

  if (
    options?.allowedMimeTypes &&
    !options.allowedMimeTypes.includes(expectedMime)
  ) {
    throw new BadRequestException("Formato de arquivo nao permitido");
  }

  if (file.mimetype !== expectedMime) {
    throw new BadRequestException("MIME do arquivo incompativel");
  }

  if (!matchesMagicBytes(file.buffer, extension)) {
    throw new BadRequestException("Assinatura do arquivo invalida");
  }

  return {
    originalFileName,
    storedFileName: `${randomUUID()}${extension}`,
    mimeType: expectedMime,
    extension: extension.slice(1),
    sizeBytes,
    checksumSha256: createHash("sha256").update(file.buffer).digest("hex"),
  };
}

export function sanitizeOriginalFileName(fileName: string): string {
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new BadRequestException("Nome do arquivo invalido");
  }
  const baseName = path.basename(fileName).replace(/[\u0000-\u001f\u007f]/g, "");
  const normalized = baseName.trim().replace(/\s+/g, " ");
  if (!normalized || normalized === "." || normalized === ".." || normalized.includes("..")) {
    throw new BadRequestException("Nome do arquivo invalido");
  }
  return normalized.slice(0, 255);
}

export function buildStorageKey(input: {
  studentId: string;
  documentType: StudentDocumentType;
  documentId: string;
  storedFileName: string;
}): string {
  return [
    "students",
    input.studentId,
    input.documentType,
    input.documentId,
    input.storedFileName,
  ].join("/");
}

function matchesMagicBytes(buffer: Buffer, extension: string): boolean {
  if (extension === ".pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (extension === ".png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  return false;
}
