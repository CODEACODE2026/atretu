import assert from "node:assert/strict";
import type { Response } from "express";
import { DocumentsController } from "./documents.controller.js";
import { StudentPhotosController } from "./student-photos.controller.js";
import { FileDisposition } from "./dto/documents.dto.js";
import { PreRegistrationsController } from "../pre-registrations/pre-registrations.controller.js";

const USER = {
  email: "admin@atretu.local",
  id: "user-id",
  roles: ["SUPER_ADMIN"],
} as const;

function createResponse() {
  const headers = new Map<string, string>();
  let sent: Buffer | undefined;
  const response = {
    send(body: Buffer) {
      sent = body;
      return response;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
  };
  return {
    get sent() {
      return sent;
    },
    headers,
    response: response as unknown as Response,
  };
}

const file = {
  buffer: Buffer.from("%PDF-1.4\nbinary"),
  disposition: FileDisposition.ATTACHMENT,
  fileName: "atretu-cpf.pdf",
  mimeType: "application/pdf",
  sizeBytes: 15,
};

const service = {
  async getDocumentFile(
    studentId: string,
    documentId: string,
    userId: string,
    disposition: FileDisposition,
  ) {
    assert.equal(studentId, "student-id");
    assert.equal(documentId, "document-id");
    assert.equal(userId, USER.id);
    assert.equal(disposition, FileDisposition.ATTACHMENT);
    return file;
  },
  async getStudentPhotoFile(
    studentId: string,
    userId: string,
    disposition: FileDisposition,
  ) {
    assert.equal(studentId, "student-id");
    assert.equal(userId, USER.id);
    assert.equal(disposition, FileDisposition.INLINE);
    return {
      ...file,
      disposition: FileDisposition.INLINE,
      fileName: "atretu-foto.png",
      mimeType: "image/png",
    };
  },
  async getPreRegistrationDocumentFile(input: {
    preRegistrationId: string;
    documentId: string;
    userId: string;
    disposition: FileDisposition;
  }) {
    assert.equal(input.preRegistrationId, "pre-registration-id");
    assert.equal(input.documentId, "pre-registration-document-id");
    assert.equal(input.userId, USER.id);
    assert.equal(input.disposition, FileDisposition.INLINE);
    return {
      ...file,
      disposition: FileDisposition.INLINE,
      fileName: "comprovante matrícula.pdf",
    };
  },
};

const documentController = new DocumentsController(service as never);
const documentResponse = createResponse();
await documentController.getDocumentFile(
  "student-id",
  "document-id",
  { disposition: FileDisposition.ATTACHMENT },
  USER as never,
  documentResponse.response,
);

assert.equal(documentResponse.sent, file.buffer);
assert.equal(documentResponse.sent?.subarray(0, 4).toString(), "%PDF");
assert.equal(
  documentResponse.sent?.toString().startsWith('{"type":"Buffer"'),
  false,
);
assert.equal(documentResponse.headers.get("Content-Type"), "application/pdf");
assert.equal(documentResponse.headers.get("Content-Length"), "15");
assert.equal(
  documentResponse.headers.get("Content-Disposition"),
  'attachment; filename="atretu-cpf.pdf"',
);
assert.equal(documentResponse.headers.get("X-Content-Type-Options"), "nosniff");
assert.equal(documentResponse.headers.get("Cache-Control"), "no-store, private");

const photoController = new StudentPhotosController(service as never);
const photoResponse = createResponse();
await photoController.getPhotoFile(
  "student-id",
  { disposition: FileDisposition.INLINE },
  USER as never,
  photoResponse.response,
);

assert.equal(photoResponse.sent, file.buffer);
assert.equal(photoResponse.headers.get("Content-Type"), "image/png");
assert.equal(
  photoResponse.headers.get("Content-Disposition"),
  'inline; filename="atretu-foto.png"',
);

const preRegistrationController = new PreRegistrationsController(service as never);
const preRegistrationResponse = createResponse();
await preRegistrationController.getPreRegistrationDocumentFile(
  "pre-registration-id",
  "pre-registration-document-id",
  { disposition: FileDisposition.INLINE },
  USER as never,
  preRegistrationResponse.response,
);

assert.equal(preRegistrationResponse.sent, file.buffer);
assert.equal(
  preRegistrationResponse.sent?.toString().startsWith('{"type":"Buffer"'),
  false,
);
assert.equal(preRegistrationResponse.headers.get("Content-Type"), "application/pdf");
assert.equal(preRegistrationResponse.headers.get("Content-Length"), "15");
assert.equal(
  preRegistrationResponse.headers.get("Content-Disposition"),
  'inline; filename="comprovante matricula.pdf"; filename*=UTF-8\'\'comprovante%20matr%C3%ADcula.pdf',
);
assert.equal(
  preRegistrationResponse.headers.get("Cache-Control"),
  "no-store, private",
);
