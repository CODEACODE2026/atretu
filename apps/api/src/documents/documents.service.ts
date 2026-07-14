import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  Prisma,
  StudentDocumentStatus,
  StudentDocumentType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { AppConfigService } from "../config/app-config.service.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  DOCUMENT_TYPES,
  PHOTO_DOCUMENT_TYPES,
  buildStorageKey,
  validateDocumentFile,
  type UploadedDocumentFile,
} from "./document-file.js";
import { DocumentStorageService } from "./document-storage.service.js";
import { FileDisposition } from "./dto/documents.dto.js";

const PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"] as const;

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DocumentStorageService)
    private readonly storage: DocumentStorageService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  async listStudentDocuments(
    studentId: string,
    status?: StudentDocumentStatus | "all",
  ) {
    await this.ensureStudent(studentId);
    const documents = await this.prisma.studentDocument.findMany({
      where: {
        studentId,
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: [{ documentType: "asc" }, { createdAt: "desc" }],
    });
    const activeTypes = new Set(
      documents
        .filter((document) => document.status === StudentDocumentStatus.ACTIVE)
        .map((document) => document.documentType),
    );

    return {
      data: documents.map((document) => this.toMetadata(document)),
      missingTypes: DOCUMENT_TYPES.filter((type) => !activeTypes.has(type)),
    };
  }

  async uploadStudentDocument(
    studentId: string,
    documentType: StudentDocumentType,
    file: UploadedDocumentFile | undefined,
    userId: string,
  ) {
    await this.ensureStudent(studentId);
    const active = await this.prisma.studentDocument.findFirst({
      where: { studentId, documentType, status: StudentDocumentStatus.ACTIVE },
    });
    if (active) {
      throw new ConflictException("Documento ativo ja existe para este tipo");
    }

    const prepared = this.prepareFile(studentId, documentType, file);
    await this.storage.write(prepared.storageKey, file!.buffer!);

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const created = await tx.studentDocument.create({
          data: {
            id: prepared.documentId,
            studentId,
            documentType,
            storageKey: prepared.storageKey,
            originalFileName: prepared.originalFileName,
            storedFileName: prepared.storedFileName,
            mimeType: prepared.mimeType,
            extension: prepared.extension,
            sizeBytes: prepared.sizeBytes,
            checksumSha256: prepared.checksumSha256,
            uploadedByUserId: userId,
          },
        });
        await tx.administrativeAuditLog.create({
          data: {
            eventType: AdministrativeAuditEventType.STUDENT_DOCUMENT_UPLOADED,
            userId,
            domain: "student_documents",
            recordId: created.id,
            metadata: {
              studentId,
              documentId: created.id,
              documentType: created.documentType,
              action: "upload",
              sizeBytes: created.sizeBytes,
            },
          },
        });
        return created;
      });
      return this.toMetadata(document);
    } catch (error) {
      await this.storage.removeIfExists(prepared.storageKey);
      this.handleWriteError(error);
    }
  }

  async getStudentPhoto(studentId: string) {
    await this.ensureStudent(studentId);
    const photo = await this.findActiveStudentPhoto(studentId);
    return { photo: photo ? this.toMetadata(photo) : null };
  }

  async uploadOrReplaceStudentPhoto(
    studentId: string,
    file: UploadedDocumentFile | undefined,
    userId: string,
  ) {
    await this.ensureStudent(studentId);
    const active = await this.findActiveStudentPhoto(studentId);
    if (active) {
      return this.replaceStudentDocument(studentId, active.id, file, userId);
    }
    return this.uploadStudentDocument(
      studentId,
      StudentDocumentType.PHOTO,
      file,
      userId,
    );
  }

  async removeStudentPhoto(studentId: string, userId: string) {
    await this.ensureStudent(studentId);
    const active = await this.findActiveStudentPhoto(studentId);
    if (!active) {
      throw new NotFoundException("Foto oficial nao encontrada");
    }
    return this.removeStudentDocument(studentId, active.id, userId);
  }

  async getStudentPhotoFile(
    studentId: string,
    userId: string,
    disposition: FileDisposition,
  ) {
    await this.ensureStudent(studentId);
    const active = await this.findActiveStudentPhoto(studentId);
    if (!active) {
      throw new NotFoundException("Foto oficial nao encontrada");
    }
    return this.getDocumentFile(studentId, active.id, userId, disposition);
  }

  async getStudentDocument(studentId: string, documentId: string) {
    const document = await this.getDocumentForStudent(studentId, documentId);
    return this.toMetadata(document);
  }

  async replaceStudentDocument(
    studentId: string,
    documentId: string,
    file: UploadedDocumentFile | undefined,
    userId: string,
  ) {
    const current = await this.getDocumentForStudent(studentId, documentId);
    if (current.status !== StudentDocumentStatus.ACTIVE) {
      throw new BadRequestException("Somente documento ativo pode ser substituido");
    }

    const prepared = this.prepareFile(studentId, current.documentType, file);
    await this.storage.write(prepared.storageKey, file!.buffer!);

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.studentDocument.update({
          where: { id: current.id },
          data: {
            status: StudentDocumentStatus.REPLACED,
            replacedAt: new Date(),
            replacedById: current.id,
          },
        });
        const created = await tx.studentDocument.create({
          data: {
            id: prepared.documentId,
            studentId,
            documentType: previous.documentType,
            storageKey: prepared.storageKey,
            originalFileName: prepared.originalFileName,
            storedFileName: prepared.storedFileName,
            mimeType: prepared.mimeType,
            extension: prepared.extension,
            sizeBytes: prepared.sizeBytes,
            checksumSha256: prepared.checksumSha256,
            uploadedByUserId: userId,
          },
        });
        await tx.studentDocument.update({
          where: { id: previous.id },
          data: { replacedById: created.id },
        });
        await tx.administrativeAuditLog.create({
          data: {
            eventType: AdministrativeAuditEventType.STUDENT_DOCUMENT_REPLACED,
            userId,
            domain: "student_documents",
            recordId: created.id,
            metadata: {
              studentId,
              documentId: created.id,
              previousDocumentId: previous.id,
              documentType: created.documentType,
              action: "replace",
              sizeBytes: created.sizeBytes,
            },
          },
        });
        return created;
      });
      return this.toMetadata(document);
    } catch (error) {
      await this.storage.removeIfExists(prepared.storageKey);
      this.handleWriteError(error);
    }
  }

  async removeStudentDocument(
    studentId: string,
    documentId: string,
    userId: string,
  ) {
    const current = await this.getDocumentForStudent(studentId, documentId);
    if (current.status !== StudentDocumentStatus.ACTIVE) {
      throw new BadRequestException("Somente documento ativo pode ser removido");
    }

    const document = await this.prisma.$transaction(async (tx) => {
      const removed = await tx.studentDocument.update({
        where: { id: current.id },
        data: {
          status: StudentDocumentStatus.REMOVED,
          removedAt: new Date(),
          removedByUserId: userId,
        },
      });
      await tx.administrativeAuditLog.create({
        data: {
          eventType: AdministrativeAuditEventType.STUDENT_DOCUMENT_REMOVED,
          userId,
          domain: "student_documents",
          recordId: removed.id,
          metadata: {
            studentId,
            documentId: removed.id,
            documentType: removed.documentType,
            action: "remove",
          },
        },
      });
      return removed;
    });
    return this.toMetadata(document);
  }

  async getDocumentFile(
    studentId: string,
    documentId: string,
    userId: string,
    disposition: FileDisposition,
  ) {
    const document = await this.getDocumentForStudent(studentId, documentId);
    if (document.status === StudentDocumentStatus.REMOVED) {
      throw new GoneException("Documento removido");
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.read(document.storageKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new GoneException("Arquivo nao encontrado no storage");
      }
      throw error;
    }

    await this.recordAudit(
      disposition === FileDisposition.INLINE
        ? AdministrativeAuditEventType.STUDENT_DOCUMENT_VIEWED
        : AdministrativeAuditEventType.STUDENT_DOCUMENT_DOWNLOADED,
      studentId,
      document.id,
      userId,
      document.documentType,
      { action: disposition },
    );

    return {
      buffer,
      fileName: this.downloadFileName(document),
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      disposition,
    };
  }

  private prepareFile(
    studentId: string,
    documentType: StudentDocumentType,
    file: UploadedDocumentFile | undefined,
  ) {
    const documentId = randomUUID();
    const validated = validateDocumentFile(
      file,
      this.config.values.documentMaxSizeBytes,
      PHOTO_DOCUMENT_TYPES.has(documentType)
        ? { allowedMimeTypes: PHOTO_ALLOWED_MIME_TYPES }
        : undefined,
    );
    return {
      ...validated,
      documentId,
      storageKey: buildStorageKey({
        studentId,
        documentType,
        documentId,
        storedFileName: validated.storedFileName,
      }),
    };
  }

  private async ensureStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }
    return student;
  }

  private async getDocumentForStudent(studentId: string, documentId: string) {
    const document = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, studentId },
    });
    if (!document) {
      throw new NotFoundException("Documento nao encontrado");
    }
    return document;
  }

  private findActiveStudentPhoto(studentId: string) {
    return this.prisma.studentDocument.findFirst({
      where: {
        studentId,
        documentType: StudentDocumentType.PHOTO,
        status: StudentDocumentStatus.ACTIVE,
      },
    });
  }

  private toMetadata(document: StudentDocumentRecord) {
    return {
      id: document.id,
      studentId: document.studentId,
      documentType: document.documentType,
      mimeType: document.mimeType,
      extension: document.extension,
      sizeBytes: document.sizeBytes,
      checksumSha256: document.checksumSha256,
      status: document.status,
      uploadedByUserId: document.uploadedByUserId,
      replacedById: document.replacedById,
      replacedAt: document.replacedAt,
      removedAt: document.removedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private downloadFileName(document: StudentDocumentRecord): string {
    const date = document.createdAt.toISOString().slice(0, 10);
    if (document.documentType === StudentDocumentType.PHOTO) {
      return `atretu-foto-oficial-${date}.${document.extension}`;
    }
    return `atretu-${document.documentType.toLowerCase()}-${date}.${document.extension}`;
  }

  private async recordAudit(
    eventType: AdministrativeAuditEventType,
    studentId: string,
    documentId: string,
    userId: string,
    documentType: StudentDocumentType,
    metadata: Record<string, string | number | boolean>,
  ) {
    await this.audit.record({
      eventType,
      userId,
      domain: "student_documents",
      recordId: documentId,
      metadata: {
        studentId,
        documentId,
        documentType,
        ...metadata,
      },
    });
  }

  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Documento ativo ja existe para este tipo");
    }
    throw error;
  }
}

type StudentDocumentRecord = Prisma.StudentDocumentGetPayload<object>;
