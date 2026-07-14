import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { NotFoundException } from "@nestjs/common";
import { StudentCardStatus, StudentCardType } from "@prisma/client";
import { FileDisposition } from "../documents/dto/documents.dto.js";
import {
  STUDENT_CARD_PDF_LAYOUT,
  StudentCardPdfService,
} from "./student-card-pdf.service.js";

const png = pngImage(40, 40);
const pngVertical = pngImage(300, 400);
const pngHorizontal = pngImage(400, 240);
const pngLarge = pngImage(1200, 1600);
const pngSmall = pngImage(8, 8);
const jpg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z",
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

function makeService(options?: { card?: unknown; photo?: unknown; photoBuffer?: Buffer }) {
  let storageReads = 0;
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
    read: async () => {
      storageReads += 1;
      return options?.photoBuffer ?? png;
    },
  };
  return {
    service: new StudentCardPdfService(prisma as never, storage as never),
    get storageReads() {
      return storageReads;
    },
  };
}

const withPhoto = makeService();
const result = await withPhoto.service.generate("card-id", FileDisposition.INLINE);
assert.equal(result.filename, "carteirinha_alvaro-academico-de-sao-jose-com-nome-grande_122026.pdf");
assert.equal(result.disposition, FileDisposition.INLINE);
assert.equal(result.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
assert.ok(result.sizeBytes > 1000);
assert.equal(withPhoto.storageReads, 1);
assert.equal(STUDENT_CARD_PDF_LAYOUT.card.width, 270);
assert.equal(STUDENT_CARD_PDF_LAYOUT.card.height, 172.5);
assert.ok(
  Math.abs(
    STUDENT_CARD_PDF_LAYOUT.card.width / STUDENT_CARD_PDF_LAYOUT.card.height -
      360 / 230,
  ) < 0.0001,
);
assert.equal(STUDENT_CARD_PDF_LAYOUT.placeholderLabel, "Sem foto");

const withoutPhoto = makeService({ photo: null });
const noPhotoResult = await withoutPhoto.service.generate(
  "card-id",
  FileDisposition.INLINE,
);
assert.equal(noPhotoResult.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
assert.equal(withoutPhoto.storageReads, 0);

for (const photoBuffer of [
  pngVertical,
  pngHorizontal,
  png,
  pngLarge,
  pngSmall,
  jpg,
]) {
  const generated = await makeService({ photoBuffer }).service.generate(
    "card-id",
    FileDisposition.ATTACHMENT,
  );
  assert.equal(generated.disposition, FileDisposition.ATTACHMENT);
  assert.equal(generated.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
}

await assert.rejects(
  () => makeService({ card: null }).service.generate("missing", FileDisposition.INLINE),
  NotFoundException,
);

function pngImage(width: number, height: number) {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(width * 4 + 1);
  for (let index = 1; index < row.length; index += 4) {
    row[index] = 0x2f;
    row[index + 1] = 0x6f;
    row[index + 2] = 0xa8;
    row[index + 3] = 0xff;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
