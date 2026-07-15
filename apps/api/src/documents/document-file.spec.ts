import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { StudentDocumentType } from "@prisma/client";
import sharp from "sharp";
import {
  PHOTO_DOCUMENT_TYPES,
  buildStorageKey,
  sanitizeOriginalFileName,
  validateDocumentFile,
  validateDocumentFileStructure,
} from "./document-file.js";

const pdf = Buffer.from("%PDF-1.4\ncontent");
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

assert.equal(
  validateDocumentFile(
    { originalname: "doc.pdf", mimetype: "application/pdf", buffer: pdf },
    1024,
  ).mimeType,
  "application/pdf",
);
assert.equal(
  validateDocumentFile(
    { originalname: "foto.jpg", mimetype: "image/jpeg", buffer: jpeg },
    1024,
  ).extension,
  "jpg",
);
assert.equal(
  validateDocumentFile(
    { originalname: "img.png", mimetype: "image/png", buffer: png },
    1024,
  ).extension,
  "png",
);
assert.equal(PHOTO_DOCUMENT_TYPES.has(StudentDocumentType.PHOTO), true);
assert.equal(
  validateDocumentFile(
    { originalname: "foto.jpeg", mimetype: "image/jpeg", buffer: jpeg },
    1024,
    { allowedMimeTypes: ["image/jpeg", "image/png"] },
  ).extension,
  "jpeg",
);

assert.throws(
  () =>
    validateDocumentFile(
      { originalname: "doc.svg", mimetype: "image/svg+xml", buffer: pdf },
      1024,
    ),
  BadRequestException,
);
assert.throws(
  () =>
    validateDocumentFile(
      { originalname: "foto.pdf", mimetype: "application/pdf", buffer: pdf },
      1024,
      { allowedMimeTypes: ["image/jpeg", "image/png"] },
    ),
  BadRequestException,
);
assert.throws(
  () =>
    validateDocumentFile(
      { originalname: "doc.pdf", mimetype: "image/png", buffer: pdf },
      1024,
    ),
  BadRequestException,
);
assert.throws(
  () =>
    validateDocumentFile(
      { originalname: "doc.pdf", mimetype: "application/pdf", buffer: png },
      1024,
    ),
  BadRequestException,
);
assert.throws(
  () =>
    validateDocumentFile(
      { originalname: "doc.pdf", mimetype: "application/pdf", buffer: Buffer.alloc(0) },
      1024,
    ),
  BadRequestException,
);
assert.throws(
  () =>
    validateDocumentFile(
      { originalname: "doc.pdf", mimetype: "application/pdf", buffer: pdf, size: 2048 },
      1024,
    ),
  BadRequestException,
);

assert.throws(() => sanitizeOriginalFileName("../cpf.pdf"), BadRequestException);
assert.throws(() => sanitizeOriginalFileName("..cpf.pdf"), BadRequestException);
assert.equal(
  buildStorageKey({
    studentId: "student-id",
    documentType: StudentDocumentType.CPF,
    documentId: "document-id",
    storedFileName: "stored.pdf",
  }),
  "students/student-id/CPF/document-id/stored.pdf",
);

const validPng = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .png()
  .toBuffer();
await validateDocumentFileStructure(
  { originalname: "foto.png", mimetype: "image/png", buffer: validPng },
  "image/png",
);

const validJpeg = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .jpeg()
  .toBuffer();
await validateDocumentFileStructure(
  { originalname: "foto.jpg", mimetype: "image/jpeg", buffer: validJpeg },
  "image/jpeg",
);

await assert.rejects(
  () =>
    validateDocumentFileStructure(
      {
        originalname: "foto.png",
        mimetype: "image/png",
        buffer: validPng.subarray(0, 12),
      },
      "image/png",
    ),
  BadRequestException,
);
await assert.rejects(
  () =>
    validateDocumentFileStructure(
      {
        originalname: "foto.jpg",
        mimetype: "image/jpeg",
        buffer: validJpeg.subarray(0, 12),
      },
      "image/jpeg",
    ),
  BadRequestException,
);
await validateDocumentFileStructure(
  { originalname: "doc.pdf", mimetype: "application/pdf", buffer: pdf },
  "application/pdf",
);
