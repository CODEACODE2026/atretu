import { memoryStorage, type Options as MulterOptions } from "multer";

const DEFAULT_DOCUMENT_MAX_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_FIELD_SIZE_BYTES = 16 * 1024;

export const DOCUMENT_UPLOAD_MAX_SIZE_BYTES = readDocumentMaxSizeBytes();

export const singleDocumentUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: DOCUMENT_UPLOAD_MAX_SIZE_BYTES,
    files: 1,
    fields: 8,
    parts: 10,
    fieldSize: DEFAULT_FIELD_SIZE_BYTES,
  },
} satisfies MulterOptions;

export const publicPreRegistrationUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: DOCUMENT_UPLOAD_MAX_SIZE_BYTES,
    files: 4,
    fields: 32,
    parts: 40,
    fieldSize: DEFAULT_FIELD_SIZE_BYTES,
  },
} satisfies MulterOptions;

function readDocumentMaxSizeBytes() {
  const raw = process.env.DOCUMENT_MAX_SIZE_BYTES?.trim();
  if (!raw) {
    return DEFAULT_DOCUMENT_MAX_SIZE_BYTES;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_DOCUMENT_MAX_SIZE_BYTES;
  }
  return parsed;
}
