import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { StudentCardStatus, StudentCardType } from "@prisma/client";
import { FileDisposition } from "../documents/dto/documents.dto.js";
import { StudentCardPdfService } from "./student-card-pdf.service.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const card = {
  id: "card-id",
  studentId: "student-id",
  enrollmentId: "enrollment-id",
  academicYearId: "academic-year-id",
  boardMembershipId: null,
  cardType: StudentCardType.STUDENT,
  sequenceNumber: 12,
  cardNumber: "122026",
  status: StudentCardStatus.ACTIVE,
  issuedAt: new Date("2026-02-01T12:00:00Z"),
  invalidatedAt: null,
  invalidationReason: null,
  invalidationNote: null,
  issuedByUserId: null,
  invalidatedByUserId: null,
  createdAt: new Date("2026-02-01T12:00:00Z"),
  updatedAt: new Date("2026-02-01T12:00:00Z"),
  student: {
    id: "student-id",
    personId: "person-id",
    status: "ACTIVE",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    person: {
      id: "person-id",
      fullName: "Álvaro Acadêmico de São José com Nome Grande",
      normalizedName: "alvaro academico",
      cpf: "12345678909",
      rg: null,
      birthDate: new Date("2001-05-12T00:00:00Z"),
      phone: "49999999999",
      email: null,
      addressStreet: "Rua",
      addressNumber: "123",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
      addressZipCode: null,
      addressState: null,
      addressComplement: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
  },
  academicYear: {
    id: "academic-year-id",
    year: 2026,
    isCurrent: true,
    status: "ACTIVE",
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  },
  enrollment: {
    id: "enrollment-id",
    studentId: "student-id",
    academicYearId: "academic-year-id",
    institutionId: "institution-id",
    shiftId: "shift-id",
    course: "Técnico em Administração com Ênfase em Gestão Pública",
    grade: "1o",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    academicYear: {
      id: "academic-year-id",
      year: 2026,
      isCurrent: true,
      status: "ACTIVE",
      archivedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
    institution: {
      id: "institution-id",
      name: "Instituição Estadual de Educação São José",
      normalizedName: "instituicao estadual",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
    shift: {
      id: "shift-id",
      name: "Matutino",
      normalizedName: "matutino",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
  },
};

function makeService(options?: { card?: unknown; photo?: unknown }) {
  const prisma = {
    studentCard: {
      findUnique: async () =>
        Object.hasOwn(options ?? {}, "card") ? options?.card : card,
    },
    studentDocument: {
      findFirst: async () =>
        options?.photo === undefined
          ? { id: "photo-id", storageKey: "students/student-id/PHOTO/photo-id/photo.png" }
          : options.photo,
    },
  };
  const storage = {
    read: async () => png,
  };
  return new StudentCardPdfService(prisma as never, storage as never);
}

const result = await makeService().generate("card-id", FileDisposition.INLINE);
assert.equal(result.filename, "carteirinha_alvaro-academico-de-sao-jose-com-nome-grande_122026.pdf");
assert.equal(result.disposition, FileDisposition.INLINE);
assert.equal(result.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
assert.ok(result.sizeBytes > 1000);

await assert.rejects(
  () => makeService({ card: null }).generate("missing", FileDisposition.INLINE),
  NotFoundException,
);

await assert.rejects(
  () => makeService({ photo: null }).generate("card-id", FileDisposition.INLINE),
  BadRequestException,
);
