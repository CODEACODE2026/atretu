import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rm } from "node:fs/promises";
import sharp from "sharp";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s5-${Date.now()}`;
const documentMaxSizeBytes = Number(process.env.DOCUMENT_MAX_SIZE_BYTES ?? 8 * 1024 * 1024);

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 5 smoke");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Sprint 5 smoke");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.arrayBuffer();
  return {
    response,
    body,
    cookie: response.headers.get("set-cookie"),
  };
}

function json(cookie) {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { cookie } : {}),
  };
}

async function ensureUsers() {
  await request("/auth/bootstrap/super-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-setup-token": setupToken,
    },
    body: JSON.stringify({
      name: "Smoke Admin",
      email: adminEmail,
      password: adminPassword,
    }),
  });

  const adminLogin = await request("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!adminLogin.response.ok || !adminLogin.cookie) {
    throw new Error("Admin login failed");
  }

  await request("/auth/users", {
    method: "POST",
    headers: json(adminLogin.cookie),
    body: JSON.stringify({
      name: "Smoke Secretaria",
      email: secretaryEmail,
      password: secretaryPassword,
      role: "SECRETARIA",
    }),
  });

  const secretaryLogin = await request("/auth/login", {
    method: "POST",
    headers: json(),
    body: JSON.stringify({
      email: secretaryEmail,
      password: secretaryPassword,
    }),
  });

  if (!secretaryLogin.response.ok || !secretaryLogin.cookie) {
    throw new Error("Secretaria login failed");
  }

  return {
    adminCookie: adminLogin.cookie,
    secretaryCookie: secretaryLogin.cookie,
  };
}

async function createBaseRecord(cookie, path, body) {
  const created = await request(path, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(body),
  });
  if (!created.response.ok) {
    throw new Error(`${path} create failed: ${created.body.message}`);
  }
  return created.body;
}

async function createStudent(cookie, payload) {
  const created = await request("/students", {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(payload),
  });
  if (!created.response.ok) {
    throw new Error(`Student create failed: ${created.body.message}`);
  }
  return created.body;
}

function studentPayload({ cpf, academicYearId, institutionId, shiftId, suffix }) {
  return {
    person: {
      fullName: `Academico ${suffix}`,
      cpf,
      rg: `RG-${suffix}`,
      birthDate: "2001-05-12",
      phone: "49999999999",
      email: `academico-${suffix}@example.com`,
      addressStreet: `Rua ${suffix}`,
      addressNumber: "123",
      addressNeighborhood: "Centro",
      addressCity: "Terra Rica",
    },
    guardian: {
      fullName: `Responsavel ${suffix}`,
    },
    enrollment: {
      academicYearId,
      institutionId,
      shiftId,
      course: "Tecnico em Administracao",
      grade: "1o",
    },
  };
}

function generateCpf(seed) {
  const base = String(seed).padStart(9, "0").slice(0, 9);
  const first = checkDigit(base);
  const second = checkDigit(`${base}${first}`);
  return `${base}${first}${second}`;
}

function checkDigit(value) {
  const numbers = value.split("").map(Number);
  const start = numbers.length + 1;
  const sum = numbers.reduce(
    (total, number, index) => total + number * (start - index),
    0,
  );
  const digit = (sum * 10) % 11;
  return digit === 10 ? 0 : digit;
}

async function uploadDocument(cookie, studentId, documentType, file) {
  const form = new FormData();
  form.set("documentType", documentType);
  form.set("file", new Blob([file.buffer], { type: file.mimeType }), file.name);
  return request(`/students/${studentId}/documents`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
}

async function replaceDocument(cookie, studentId, documentId, file) {
  const form = new FormData();
  form.set("file", new Blob([file.buffer], { type: file.mimeType }), file.name);
  return request(`/students/${studentId}/documents/${documentId}/replace`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
}

async function uploadPhoto(cookie, studentId, file) {
  const form = new FormData();
  form.set("file", new Blob([file.buffer], { type: file.mimeType }), file.name);
  return request(`/students/${studentId}/photo`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
}

async function cleanupStorage() {
  const storageDir = process.env.DOCUMENT_STORAGE_DIR ?? "";
  if (storageDir.includes("atretu-documents-smoke")) {
    await rm(storageDir, { recursive: true, force: true });
  }
}

const validJpeg = await sharp({
  create: {
    width: 4,
    height: 6,
    channels: 3,
    background: { r: 240, g: 240, b: 240 },
  },
})
  .jpeg()
  .toBuffer();
const validPng = await sharp({
  create: {
    width: 4,
    height: 6,
    channels: 3,
    background: { r: 240, g: 240, b: 240 },
  },
})
  .png()
  .toBuffer();

const files = {
  pdf: {
    name: "documento.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"),
  },
  pdfReplacement: {
    name: "documento-novo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n2 0 obj\n<<>>\nendobj\n%%EOF\n"),
  },
  jpeg: {
    name: "documento.jpg",
    mimeType: "image/jpeg",
    buffer: validJpeg,
  },
  png: {
    name: "documento.png",
    mimeType: "image/png",
    buffer: validPng,
  },
  svg: {
    name: "documento.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
  },
  fakeJpeg: {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
  },
  falseMime: {
    name: "foto.jpg",
    mimeType: "image/png",
    buffer: validJpeg,
  },
  truncatedJpeg: {
    name: "foto-truncada.jpg",
    mimeType: "image/jpeg",
    buffer: validJpeg.subarray(0, 12),
  },
  truncatedPng: {
    name: "foto-truncada.png",
    mimeType: "image/png",
    buffer: validPng.subarray(0, 12),
  },
  emptyJpeg: {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(0),
  },
  oversizedPhoto: {
    name: "foto-grande.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(documentMaxSizeBytes + 1, 0x31),
    ]),
  },
  photoTraversal: {
    name: "..foto.jpg",
    mimeType: "image/jpeg",
    buffer: validJpeg,
  },
  oversized: {
    name: "grande.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(documentMaxSizeBytes + 1, 0x31),
    ]),
  },
  traversal: {
    name: "..evil.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
  },
};

try {
  const anonymous = await request(
    "/students/00000000-0000-0000-0000-000000000000/documents",
  );
  if (anonymous.response.status !== 401) {
    throw new Error("Anonymous document access was not blocked");
  }
  const anonymousPhoto = await request(
    "/students/00000000-0000-0000-0000-000000000000/photo",
  );
  if (anonymousPhoto.response.status !== 401) {
    throw new Error("Anonymous photo access was not blocked");
  }

  const { adminCookie, secretaryCookie } = await ensureUsers();

  const existingAcademicYears = await prisma.academicYear.findMany({
    select: { id: true, year: true, status: true },
    orderBy: { year: "desc" },
  });
  const usedYears = new Set(existingAcademicYears.map((item) => item.year));
  let smokeYear = 2097;
  while (usedYears.has(smokeYear)) {
    smokeYear -= 1;
  }

  const academicYear =
    smokeYear >= 2000
      ? (
          await request("/academic-years", {
            method: "POST",
            headers: json(adminCookie),
            body: JSON.stringify({ year: smokeYear, isCurrent: true }),
          })
        ).body
      : existingAcademicYears.find((item) => item.status === "ACTIVE");
  if (!academicYear?.id) {
    throw new Error("No active academic year available for documents smoke");
  }

  const institution = await createBaseRecord(adminCookie, "/institutions", {
    name: `Instituicao ${runId}`,
  });
  const shift = await createBaseRecord(adminCookie, "/shifts", {
    name: `Turno ${runId}`,
  });

  const seed = Date.now() % 800000000;
  const student = await createStudent(
    secretaryCookie,
    studentPayload({
      cpf: generateCpf(seed),
      academicYearId: academicYear.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: runId,
    }),
  );
  const initialStudent = await request(`/students/${student.id}`, {
    headers: json(secretaryCookie),
  });
  const initialCard = initialStudent.body.currentStudentCard;

  const pdf = await uploadDocument(secretaryCookie, student.id, "CPF", files.pdf);
  if (!pdf.response.ok || pdf.body.documentType !== "CPF") {
    throw new Error(`PDF upload failed: ${pdf.body.message}`);
  }

  const jpeg = await uploadDocument(secretaryCookie, student.id, "RG", files.jpeg);
  if (!jpeg.response.ok || jpeg.body.mimeType !== "image/jpeg") {
    throw new Error(`JPEG upload failed: ${jpeg.body.message}`);
  }

  const png = await uploadDocument(
    secretaryCookie,
    student.id,
    "PROOF_OF_ADDRESS",
    files.png,
  );
  if (!png.response.ok || png.body.mimeType !== "image/png") {
    throw new Error(`PNG upload failed: ${png.body.message}`);
  }

  const duplicate = await uploadDocument(secretaryCookie, student.id, "CPF", files.pdf);
  if (duplicate.response.status !== 409) {
    throw new Error("Duplicate ACTIVE document type was not blocked");
  }

  const list = await request(`/students/${student.id}/documents?status=all`, {
    headers: json(secretaryCookie),
  });
  if (!list.response.ok || list.body.data.length !== 3) {
    throw new Error("Document list failed");
  }
  if (JSON.stringify(list.body).includes("storageKey")) {
    throw new Error("Document list exposed storageKey");
  }
  if (JSON.stringify(list.body).includes("storedFileName")) {
    throw new Error("Document list exposed storedFileName");
  }

  const metadata = await request(`/students/${student.id}/documents/${pdf.body.id}`, {
    headers: json(secretaryCookie),
  });
  if (!metadata.response.ok || metadata.body.id !== pdf.body.id) {
    throw new Error("Document metadata lookup failed");
  }

  const download = await request(
    `/students/${student.id}/documents/${pdf.body.id}/file?disposition=attachment`,
    { headers: json(secretaryCookie) },
  );
  if (!download.response.ok) {
    throw new Error("Protected document download failed");
  }
  if (download.response.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("Download nosniff header missing");
  }
  if (download.response.headers.get("cache-control") !== "no-store, private") {
    throw new Error("Download cache header missing");
  }
  const disposition = download.response.headers.get("content-disposition") ?? "";
  if (!disposition.includes("atretu-cpf") || disposition.includes("documento.pdf")) {
    throw new Error("Download filename was not safely generated");
  }

  const replaced = await replaceDocument(
    secretaryCookie,
    student.id,
    pdf.body.id,
    files.pdfReplacement,
  );
  if (!replaced.response.ok || replaced.body.id === pdf.body.id) {
    throw new Error(`Document replacement failed: ${replaced.body.message}`);
  }

  const history = await request(`/students/${student.id}/documents?status=all`, {
    headers: json(secretaryCookie),
  });
  const previous = history.body.data.find((item) => item.id === pdf.body.id);
  const activeCpf = history.body.data.find(
    (item) => item.documentType === "CPF" && item.status === "ACTIVE",
  );
  if (previous?.status !== "REPLACED" || activeCpf?.id !== replaced.body.id) {
    throw new Error("Replacement history was not preserved");
  }

  const removed = await request(
    `/students/${student.id}/documents/${replaced.body.id}/remove`,
    { method: "PATCH", headers: json(secretaryCookie) },
  );
  if (!removed.response.ok || removed.body.status !== "REMOVED") {
    throw new Error("Logical document removal failed");
  }

  const removedDownload = await request(
    `/students/${student.id}/documents/${replaced.body.id}/file`,
    { headers: json(secretaryCookie) },
  );
  if (removedDownload.response.status !== 410) {
    throw new Error("Removed document download was not blocked");
  }

  const invalidSvg = await uploadDocument(
    secretaryCookie,
    student.id,
    "PROOF_OF_ENROLLMENT",
    files.svg,
  );
  if (invalidSvg.response.status !== 400) {
    throw new Error("Invalid SVG upload was not blocked");
  }

  const oversized = await uploadDocument(
    secretaryCookie,
    student.id,
    "PROOF_OF_ENROLLMENT",
    files.oversized,
  );
  if (oversized.response.status !== 413) {
    throw new Error("Oversized upload was not blocked");
  }

  const traversal = await uploadDocument(
    secretaryCookie,
    student.id,
    "PROOF_OF_ENROLLMENT",
    files.traversal,
  );
  if (traversal.response.status !== 400) {
    throw new Error("Path traversal filename was not blocked");
  }

  const missingPhoto = await request(`/students/${student.id}/photo`, {
    headers: json(secretaryCookie),
  });
  if (!missingPhoto.response.ok || missingPhoto.body.photo !== null) {
    throw new Error("Missing student photo metadata was not reported");
  }

  const photoPdf = await uploadPhoto(secretaryCookie, student.id, files.pdf);
  if (photoPdf.response.status !== 400) {
    throw new Error("PDF upload was not blocked for PHOTO");
  }

  const photoSvg = await uploadPhoto(secretaryCookie, student.id, files.svg);
  if (photoSvg.response.status !== 400) {
    throw new Error("SVG upload was not blocked for PHOTO");
  }

  const photoFalseMime = await uploadPhoto(secretaryCookie, student.id, files.falseMime);
  if (photoFalseMime.response.status !== 400) {
    throw new Error("False MIME upload was not blocked for PHOTO");
  }

  const photoFakeJpeg = await uploadPhoto(secretaryCookie, student.id, files.fakeJpeg);
  if (photoFakeJpeg.response.status !== 400) {
    throw new Error("Invalid magic bytes were not blocked for PHOTO");
  }
  const photoTruncatedJpeg = await uploadPhoto(
    secretaryCookie,
    student.id,
    files.truncatedJpeg,
  );
  if (photoTruncatedJpeg.response.status !== 400) {
    throw new Error("Truncated JPG was not blocked for PHOTO");
  }
  const photoTruncatedPng = await uploadPhoto(
    secretaryCookie,
    student.id,
    files.truncatedPng,
  );
  if (photoTruncatedPng.response.status !== 400) {
    throw new Error("Truncated PNG was not blocked for PHOTO");
  }

  const photoEmpty = await uploadPhoto(secretaryCookie, student.id, files.emptyJpeg);
  if (photoEmpty.response.status !== 400) {
    throw new Error("Empty photo upload was not blocked");
  }

  const photoOversized = await uploadPhoto(
    secretaryCookie,
    student.id,
    files.oversizedPhoto,
  );
  if (photoOversized.response.status !== 413) {
    throw new Error("Oversized photo upload was not blocked");
  }

  const photoTraversal = await uploadPhoto(
    secretaryCookie,
    student.id,
    files.photoTraversal,
  );
  if (photoTraversal.response.status !== 400) {
    throw new Error("Photo path traversal filename was not blocked");
  }

  const photoJpeg = await uploadPhoto(secretaryCookie, student.id, files.jpeg);
  if (
    !photoJpeg.response.ok ||
    photoJpeg.body.documentType !== "PHOTO" ||
    photoJpeg.body.mimeType !== "image/jpeg"
  ) {
    throw new Error(`JPEG photo upload failed: ${photoJpeg.body.message}`);
  }

  const photoPng = await uploadPhoto(adminCookie, student.id, files.png);
  if (
    !photoPng.response.ok ||
    photoPng.body.documentType !== "PHOTO" ||
    photoPng.body.mimeType !== "image/png" ||
    photoPng.body.id === photoJpeg.body.id
  ) {
    throw new Error(`PNG photo replacement failed: ${photoPng.body.message}`);
  }

  const photoMetadata = await request(`/students/${student.id}/photo`, {
    headers: json(secretaryCookie),
  });
  if (!photoMetadata.response.ok || photoMetadata.body.photo?.id !== photoPng.body.id) {
    throw new Error("Active student photo metadata failed");
  }
  if (JSON.stringify(photoMetadata.body).includes("storageKey")) {
    throw new Error("Photo metadata exposed storageKey");
  }

  const photoFile = await request(
    `/students/${student.id}/photo/file?disposition=inline`,
    { headers: json(secretaryCookie) },
  );
  if (!photoFile.response.ok) {
    throw new Error("Protected photo file access failed");
  }
  if (photoFile.response.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("Photo nosniff header missing");
  }
  if (photoFile.response.headers.get("cache-control") !== "no-store, private") {
    throw new Error("Photo cache header missing");
  }

  const photoHistory = await request(`/students/${student.id}/documents?status=all`, {
    headers: json(secretaryCookie),
  });
  const previousPhoto = photoHistory.body.data.find(
    (item) => item.id === photoJpeg.body.id,
  );
  const activePhotos = photoHistory.body.data.filter(
    (item) => item.documentType === "PHOTO" && item.status === "ACTIVE",
  );
  if (previousPhoto?.status !== "REPLACED" || activePhotos.length !== 1) {
    throw new Error("Photo replacement history or active constraint failed");
  }

  const afterPhotoStudent = await request(`/students/${student.id}`, {
    headers: json(secretaryCookie),
  });
  const afterPhotoCard = afterPhotoStudent.body.currentStudentCard;
  if (
    initialCard?.id !== afterPhotoCard?.id ||
    initialCard?.cardNumber !== afterPhotoCard?.cardNumber ||
    initialCard?.sequenceNumber !== afterPhotoCard?.sequenceNumber
  ) {
    throw new Error("StudentCard changed after photo upload/replacement");
  }

  const removedPhoto = await request(`/students/${student.id}/photo`, {
    method: "DELETE",
    headers: json(secretaryCookie),
  });
  if (!removedPhoto.response.ok || removedPhoto.body.status !== "REMOVED") {
    throw new Error("Logical student photo removal failed");
  }
  const removedPhotoFile = await request(`/students/${student.id}/photo/file`, {
    headers: json(secretaryCookie),
  });
  if (removedPhotoFile.response.status !== 404) {
    throw new Error("Removed photo file was not blocked");
  }

  const afterRemoveStudent = await request(`/students/${student.id}`, {
    headers: json(secretaryCookie),
  });
  const afterRemoveCard = afterRemoveStudent.body.currentStudentCard;
  if (
    initialCard?.id !== afterRemoveCard?.id ||
    initialCard?.cardNumber !== afterRemoveCard?.cardNumber ||
    initialCard?.sequenceNumber !== afterRemoveCard?.sequenceNumber
  ) {
    throw new Error("StudentCard changed after photo removal");
  }

  const wrongStudent = await request(
    `/students/00000000-0000-0000-0000-000000000000/documents/${jpeg.body.id}`,
    { headers: json(secretaryCookie) },
  );
  if (wrongStudent.response.status !== 404) {
    throw new Error("Document access with wrong studentId was not blocked");
  }

  const auditCount = await prisma.administrativeAuditLog.count({
    where: {
      domain: "student_documents",
      recordId: {
        in: [
          pdf.body.id,
          replaced.body.id,
          jpeg.body.id,
          png.body.id,
          photoJpeg.body.id,
          photoPng.body.id,
          removedPhoto.body.id,
        ],
      },
    },
  });
  if (auditCount < 5) {
    throw new Error("Document audit events were not recorded");
  }

  console.log("Sprint 5 document smoke passed");
} finally {
  await prisma.$disconnect();
  await cleanupStorage();
}
