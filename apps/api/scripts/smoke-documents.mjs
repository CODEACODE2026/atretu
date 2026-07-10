import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rm } from "node:fs/promises";

const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `s5-${Date.now()}`;

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

async function cleanupStorage() {
  const storageDir = process.env.DOCUMENT_STORAGE_DIR ?? "";
  if (storageDir.includes("atretu-documents-smoke")) {
    await rm(storageDir, { recursive: true, force: true });
  }
}

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
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]),
  },
  png: {
    name: "documento.png",
    mimeType: "image/png",
    buffer: Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]),
  },
  svg: {
    name: "documento.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
  },
  oversized: {
    name: "grande.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2048, 0x31)]),
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

  const { adminCookie, secretaryCookie } = await ensureUsers();

  const usedYears = new Set(
    (await prisma.academicYear.findMany({ select: { year: true } })).map(
      (item) => item.year,
    ),
  );
  let smokeYear = 2097;
  while (usedYears.has(smokeYear)) {
    smokeYear -= 1;
  }

  const academicYear = await request("/academic-years", {
    method: "POST",
    headers: json(adminCookie),
    body: JSON.stringify({ year: smokeYear, isCurrent: true }),
  });
  if (!academicYear.response.ok) {
    throw new Error(`Academic year create failed: ${academicYear.body.message}`);
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
      academicYearId: academicYear.body.id,
      institutionId: institution.id,
      shiftId: shift.id,
      suffix: runId,
    }),
  );

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
  if (oversized.response.status !== 400) {
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
      recordId: { in: [pdf.body.id, replaced.body.id, jpeg.body.id, png.body.id] },
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
