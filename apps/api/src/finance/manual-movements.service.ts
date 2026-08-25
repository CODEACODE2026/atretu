import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  ManualFinancialMovementAttachmentStatus,
  ManualFinancialMovementCategory,
  ManualFinancialMovementStatus,
  ManualFinancialMovementType,
  Prisma,
  StudentHistoryEventType,
} from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { resolvePagination } from "../common/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  getInstitutionScope,
  OPERATIONAL_INSTITUTION_SCOPE,
} from "../auth/institution-scope.js";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import {
  type UploadedDocumentFile,
  sanitizeOriginalFileName,
} from "../documents/document-file.js";
import { DOCUMENT_UPLOAD_MAX_SIZE_BYTES } from "../documents/multipart-upload.js";
import { normalizeCpf } from "../students/cpf.js";
import type { AuthUser } from "../users/users.service.js";
import { formatInvoiceAmount, assertValidInvoiceAmountCents } from "./money.js";
import { parseInvoiceDueDate } from "./due-date.js";
import {
  CancelManualFinancialMovementDto,
  CreateManualFinancialMovementDto,
  ListManualFinancialMovementsDto,
  MarkManualFinancialMovementPaidDto,
  UpdateManualFinancialMovementDto,
} from "./dto/manual-movements.dto.js";

type MovementRecord = Prisma.ManualFinancialMovementGetPayload<{
  include: ReturnType<ManualFinancialMovementsService["movementInclude"]>;
}>;

type AttachmentRecord = Prisma.ManualFinancialMovementAttachmentGetPayload<{
  include: { uploadedBy: { select: { id: true; name: true } } };
}>;

const INCOME_CATEGORIES = new Set<ManualFinancialMovementCategory>([
  ManualFinancialMovementCategory.SECOND_CARD_COPY,
  ManualFinancialMovementCategory.XEROX,
  ManualFinancialMovementCategory.ADMINISTRATIVE_FEE,
  ManualFinancialMovementCategory.EXTRA_CONTRIBUTION,
  ManualFinancialMovementCategory.DONATION,
  ManualFinancialMovementCategory.OTHER,
]);

const EXPENSE_CATEGORIES = new Set<ManualFinancialMovementCategory>([
  ManualFinancialMovementCategory.FUEL,
  ManualFinancialMovementCategory.MAINTENANCE,
  ManualFinancialMovementCategory.ACCOUNTING,
  ManualFinancialMovementCategory.OFFICE_SUPPLIES,
  ManualFinancialMovementCategory.SERVICES,
  ManualFinancialMovementCategory.TAXES,
  ManualFinancialMovementCategory.PURCHASES,
  ManualFinancialMovementCategory.OTHER,
]);

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

@Injectable()
export class ManualFinancialMovementsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentStorageService) private readonly storage: DocumentStorageService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  async list(query: ListManualFinancialMovementsDto, user?: AuthUser) {
    const pagination = resolvePagination(query);
    const where = this.applyInstitutionScope(this.buildWhere(query), user);
    const [records, total, summary] = await Promise.all([
      this.prisma.manualFinancialMovement.findMany({
        where,
        include: this.movementInclude(),
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.manualFinancialMovement.count({ where }),
      this.buildSummary(where),
    ]);
    return {
      data: records.map((record) => this.toMovementResponse(record)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
      summary,
    };
  }

  async get(id: string, user?: AuthUser) {
    const record = await this.findMovement(id);
    this.assertMovementInstitutionScope(record, user);
    return this.toMovementResponse(record);
  }

  async create(
    body: CreateManualFinancialMovementDto,
    file: UploadedDocumentFile | undefined,
    user: AuthUser,
  ) {
    const normalized = await this.normalizeCreate(body);
    let writtenStorageKey: string | null = null;
    const attachment = file
      ? await this.validateAttachmentFile(file, DOCUMENT_UPLOAD_MAX_SIZE_BYTES)
      : null;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const movement = await tx.manualFinancialMovement.create({
          data: {
            ...normalized,
            createdByUserId: user.id,
          },
          include: this.movementInclude(),
        });

        if (attachment) {
          const attachmentId = randomUUID();
          const storageKey = this.buildAttachmentStorageKey({
            attachmentId,
            movementId: movement.id,
            storedFileName: attachment.storedFileName,
          });
          await this.storage.write(storageKey, file?.buffer ?? Buffer.alloc(0));
          writtenStorageKey = storageKey;
          const createdAttachment = await tx.manualFinancialMovementAttachment.create({
            data: {
              id: attachmentId,
              movementId: movement.id,
              storageKey,
              originalFileName: attachment.originalFileName,
              storedFileName: attachment.storedFileName,
              mimeType: attachment.mimeType,
              extension: attachment.extension,
              sizeBytes: attachment.sizeBytes,
              checksumSha256: attachment.checksumSha256,
              uploadedByUserId: user.id,
            },
          });
          await this.recordAuditTx(tx, {
            eventType:
              AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_UPLOADED,
            recordId: movement.id,
            userId: user.id,
            metadata: {
              movementId: movement.id,
              attachmentId: createdAttachment.id,
              originalFileName: createdAttachment.originalFileName,
              mimeType: createdAttachment.mimeType,
              sizeBytes: createdAttachment.sizeBytes,
            },
          });
        }

        if (
          movement.type === ManualFinancialMovementType.INCOME &&
          movement.studentId
        ) {
          await tx.studentHistoryEvent.create({
            data: {
              studentId: movement.studentId,
              eventType: StudentHistoryEventType.MANUAL_FINANCIAL_INCOME_RECORDED,
              manualFinancialMovementId: movement.id,
              justification: `${movement.description} — ${formatInvoiceAmount(movement.amountCents)}`,
              performedByUserId: user.id,
            },
          });
        }

        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_CREATED,
          recordId: movement.id,
          userId: user.id,
          metadata: {
            after: this.auditSnapshot(movement),
            attachment: attachment
              ? {
                  originalFileName: attachment.originalFileName,
                  mimeType: attachment.mimeType,
                  sizeBytes: attachment.sizeBytes,
                }
              : null,
          },
        });

        return tx.manualFinancialMovement.findUniqueOrThrow({
          where: { id: movement.id },
          include: this.movementInclude(),
        });
      });

      return this.toMovementResponse(created);
    } catch (error) {
      if (writtenStorageKey) {
        await this.storage.removeIfExists(writtenStorageKey);
      }
      throw error;
    }
  }

  async update(id: string, body: UpdateManualFinancialMovementDto, user: AuthUser) {
    const current = await this.findMovement(id);
    if (current.status === ManualFinancialMovementStatus.CANCELLED) {
      throw new BadRequestException("Movimentacao cancelada nao pode ser alterada");
    }
    const normalized = await this.normalizeUpdate(current, body);
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.manualFinancialMovement.update({
        where: { id },
        data: {
          ...normalized,
          updatedByUserId: user.id,
        },
        include: this.movementInclude(),
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_UPDATED,
        recordId: id,
        userId: user.id,
        metadata: {
          before: this.auditSnapshot(current),
          after: this.auditSnapshot(record),
        },
      });
      return record;
    });
    return this.toMovementResponse(updated);
  }

  async markPaid(
    id: string,
    body: MarkManualFinancialMovementPaidDto,
    user: AuthUser,
  ) {
    const current = await this.findMovement(id);
    if (current.type !== ManualFinancialMovementType.EXPENSE) {
      throw new BadRequestException("Somente despesas podem ser marcadas como pagas");
    }
    if (current.status === ManualFinancialMovementStatus.CANCELLED) {
      throw new BadRequestException("Movimentacao cancelada nao pode ser paga");
    }
    const paidAt = parseDateOnly(body.paidAt ?? dateOnly(new Date()), "Pagamento invalido");
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.manualFinancialMovement.update({
        where: { id },
        data: {
          status: ManualFinancialMovementStatus.PAID,
          paidAt,
          updatedByUserId: user.id,
        },
        include: this.movementInclude(),
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_PAID,
        recordId: id,
        userId: user.id,
        metadata: {
          before: this.auditSnapshot(current),
          after: this.auditSnapshot(record),
        },
      });
      return record;
    });
    return this.toMovementResponse(updated);
  }

  async cancel(id: string, body: CancelManualFinancialMovementDto, user: AuthUser) {
    const current = await this.findMovement(id);
    if (current.status === ManualFinancialMovementStatus.CANCELLED) {
      return this.toMovementResponse(current);
    }
    const reason = optional(body.reason);
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.manualFinancialMovement.update({
        where: { id },
        data: {
          status: ManualFinancialMovementStatus.CANCELLED,
          cancelReason: reason,
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: this.movementInclude(),
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_CANCELLED,
        recordId: id,
        userId: user.id,
        metadata: {
          before: this.auditSnapshot(current),
          after: this.auditSnapshot(record),
          reason,
        },
      });
      return record;
    });
    return this.toMovementResponse(updated);
  }

  async attach(id: string, file: UploadedDocumentFile | undefined, user: AuthUser) {
    const movement = await this.findMovement(id);
    if (movement.status === ManualFinancialMovementStatus.CANCELLED) {
      throw new BadRequestException("Movimentacao cancelada nao pode receber anexo");
    }
    const attachment = await this.validateAttachmentFile(
      file,
      DOCUMENT_UPLOAD_MAX_SIZE_BYTES,
    );
    const attachmentId = randomUUID();
    const storageKey = this.buildAttachmentStorageKey({
      attachmentId,
      movementId: movement.id,
      storedFileName: attachment.storedFileName,
    });
    await this.storage.write(storageKey, file?.buffer ?? Buffer.alloc(0));
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const activeAttachments = await tx.manualFinancialMovementAttachment.findMany({
          where: {
            movementId: id,
            status: ManualFinancialMovementAttachmentStatus.ACTIVE,
          },
          select: { id: true },
        });
        const created = await tx.manualFinancialMovementAttachment.create({
          data: {
            id: attachmentId,
            movementId: id,
            storageKey,
            originalFileName: attachment.originalFileName,
            storedFileName: attachment.storedFileName,
            mimeType: attachment.mimeType,
            extension: attachment.extension,
            sizeBytes: attachment.sizeBytes,
            checksumSha256: attachment.checksumSha256,
            uploadedByUserId: user.id,
          },
        });
        if (activeAttachments.length > 0) {
          await tx.manualFinancialMovementAttachment.updateMany({
            where: { id: { in: activeAttachments.map((item) => item.id) } },
            data: {
              status: ManualFinancialMovementAttachmentStatus.REPLACED,
              replacedAt: new Date(),
              replacedById: created.id,
            },
          });
        }
        await this.recordAuditTx(tx, {
          eventType:
            activeAttachments.length > 0
              ? AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_REPLACED
              : AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_UPLOADED,
          recordId: id,
          userId: user.id,
          metadata: {
            movementId: id,
            attachmentId: created.id,
            replacedAttachmentIds: activeAttachments.map((item) => item.id),
            originalFileName: created.originalFileName,
            mimeType: created.mimeType,
            sizeBytes: created.sizeBytes,
          },
        });
        return tx.manualFinancialMovement.findUniqueOrThrow({
          where: { id },
          include: this.movementInclude(),
        });
      });
      return this.toMovementResponse(updated);
    } catch (error) {
      await this.storage.removeIfExists(storageKey);
      throw error;
    }
  }

  async readAttachment(
    movementId: string,
    attachmentId: string,
    disposition: "download" | "inline",
    user: AuthUser,
  ) {
    const attachment = await this.findAttachment(movementId, attachmentId);
    this.assertMovementInstitutionScope(attachment.movement, user);
    const buffer = await this.storage.read(attachment.storageKey);
    await this.audit.record({
      eventType:
        disposition === "inline"
          ? AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_VIEWED
          : AdministrativeAuditEventType.MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_DOWNLOADED,
      domain: "manual-financial-movements",
      recordId: movementId,
      userId: user.id,
      metadata: {
        movementId,
        attachmentId,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      },
    });
    return {
      buffer,
      fileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  private buildWhere(query: ListManualFinancialMovementsDto) {
    const where: Prisma.ManualFinancialMovementWhereInput = {};
    if (query.type) {
      where.type = query.type;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.studentId) {
      where.studentId = query.studentId;
    }
    if (query.transactionDateFrom || query.transactionDateTo) {
      where.transactionDate = {};
      if (query.transactionDateFrom) {
        where.transactionDate.gte = parseDateOnly(
          query.transactionDateFrom,
          "Data inicial invalida",
        );
      }
      if (query.transactionDateTo) {
        where.transactionDate.lte = parseDateOnly(
          query.transactionDateTo,
          "Data final invalida",
        );
      }
    }
    if (query.competenceFrom || query.competenceTo) {
      where.competenceDate = {};
      if (query.competenceFrom) {
        where.competenceDate.gte = parseCompetenceDate(query.competenceFrom);
      }
      if (query.competenceTo) {
        where.competenceDate.lte = parseCompetenceDate(query.competenceTo);
      }
    }
    if (query.search) {
      const search = query.search.trim();
      const normalized = normalizeName(search);
      const cpf = normalizeCpf(search);
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { supplierName: { contains: search, mode: "insensitive" } },
        { supplierDocument: cpf ? { contains: cpf } : undefined },
        { documentNumber: { contains: search, mode: "insensitive" } },
        { student: { person: { normalizedName: { contains: normalized } } } },
        ...(cpf ? [{ student: { person: { cpf: { contains: cpf } } } }] : []),
      ].filter(Boolean) as Prisma.ManualFinancialMovementWhereInput[];
    }
    return where;
  }

  private async buildSummary(where: Prisma.ManualFinancialMovementWhereInput) {
    const records = await this.prisma.manualFinancialMovement.groupBy({
      by: ["type", "status"],
      where,
      _sum: { amountCents: true },
      _count: { _all: true },
    });
    const summary = {
      incomeReceivedCents: 0,
      expensePaidCents: 0,
      pendingExpenseCents: 0,
      cancelledCents: 0,
      totalCount: 0,
    };
    for (const row of records) {
      const amount = row._sum.amountCents ?? 0;
      summary.totalCount += row._count._all;
      if (
        row.type === ManualFinancialMovementType.INCOME &&
        row.status === ManualFinancialMovementStatus.RECEIVED
      ) {
        summary.incomeReceivedCents += amount;
      } else if (
        row.type === ManualFinancialMovementType.EXPENSE &&
        row.status === ManualFinancialMovementStatus.PAID
      ) {
        summary.expensePaidCents += amount;
      } else if (
        row.type === ManualFinancialMovementType.EXPENSE &&
        row.status === ManualFinancialMovementStatus.PENDING
      ) {
        summary.pendingExpenseCents += amount;
      } else if (row.status === ManualFinancialMovementStatus.CANCELLED) {
        summary.cancelledCents += amount;
      }
    }
    return {
      ...summary,
      netCents: summary.incomeReceivedCents - summary.expensePaidCents,
      incomeReceivedFormatted: formatCentsRelaxed(summary.incomeReceivedCents),
      expensePaidFormatted: formatCentsRelaxed(summary.expensePaidCents),
      pendingExpenseFormatted: formatCentsRelaxed(summary.pendingExpenseCents),
      netFormatted: formatCentsRelaxed(summary.incomeReceivedCents - summary.expensePaidCents),
    };
  }

  private async normalizeCreate(body: CreateManualFinancialMovementDto) {
    const type = body.type;
    const status =
      type === ManualFinancialMovementType.INCOME
        ? ManualFinancialMovementStatus.RECEIVED
        : body.paidAt
          ? ManualFinancialMovementStatus.PAID
          : ManualFinancialMovementStatus.PENDING;
    const data = {
      type,
      status,
      category: body.category,
      description: required(body.description, "Descricao obrigatoria"),
      amountCents: normalizeAmount(body.amountCents),
      transactionDate: parseDateOnly(body.transactionDate, "Data invalida"),
      competenceDate: body.competenceDate
        ? parseCompetenceDate(body.competenceDate)
        : null,
      dueDate: body.dueDate ? parseDateOnly(body.dueDate, "Vencimento invalido") : null,
      paidAt: body.paidAt ? parseDateOnly(body.paidAt, "Pagamento invalido") : null,
      studentId: optional(body.studentId) ?? null,
      supplierName: optional(body.supplierName) ?? null,
      supplierDocument: normalizeDocument(body.supplierDocument),
      documentNumber: optional(body.documentNumber) ?? null,
      notes: optional(body.notes) ?? null,
    };
    await this.assertReferencesAndStatus(data);
    return data;
  }

  private async normalizeUpdate(
    current: MovementRecord,
    body: UpdateManualFinancialMovementDto,
  ) {
    const data = {
      category: body.category ?? current.category,
      description:
        body.description !== undefined
          ? required(body.description, "Descricao obrigatoria")
          : current.description,
      amountCents:
        body.amountCents !== undefined
          ? normalizeAmount(body.amountCents)
          : current.amountCents,
      transactionDate: body.transactionDate
        ? parseDateOnly(body.transactionDate, "Data invalida")
        : current.transactionDate,
      competenceDate:
        body.competenceDate !== undefined
          ? body.competenceDate
            ? parseCompetenceDate(body.competenceDate)
            : null
          : current.competenceDate,
      dueDate:
        body.dueDate !== undefined
          ? body.dueDate
            ? parseDateOnly(body.dueDate, "Vencimento invalido")
            : null
          : current.dueDate,
      paidAt:
        body.paidAt !== undefined
          ? body.paidAt
            ? parseDateOnly(body.paidAt, "Pagamento invalido")
            : null
          : current.paidAt,
      studentId:
        body.studentId !== undefined
          ? optional(body.studentId) ?? null
          : current.studentId,
      supplierName:
        body.supplierName !== undefined
          ? optional(body.supplierName) ?? null
          : current.supplierName,
      supplierDocument:
        body.supplierDocument !== undefined
          ? normalizeDocument(body.supplierDocument)
          : current.supplierDocument,
      documentNumber:
        body.documentNumber !== undefined
          ? optional(body.documentNumber) ?? null
          : current.documentNumber,
      notes:
        body.notes !== undefined ? optional(body.notes) ?? null : current.notes,
      status:
        current.type === ManualFinancialMovementType.EXPENSE
          ? body.paidAt !== undefined
            ? body.paidAt
              ? ManualFinancialMovementStatus.PAID
              : ManualFinancialMovementStatus.PENDING
            : current.status
          : current.status,
      type: current.type,
    };
    await this.assertReferencesAndStatus(data);
    const { type: _type, ...update } = data;
    return update;
  }

  private async assertReferencesAndStatus(input: {
    type: ManualFinancialMovementType;
    status: ManualFinancialMovementStatus;
    category: ManualFinancialMovementCategory;
    studentId?: string | null;
    supplierName?: string | null;
    supplierDocument?: string | null;
    competenceDate?: Date | null;
    dueDate?: Date | null;
    paidAt?: Date | null;
  }) {
    if (input.type === ManualFinancialMovementType.INCOME) {
      if (!INCOME_CATEGORIES.has(input.category)) {
        throw new BadRequestException("Categoria invalida para entrada");
      }
      if (
        input.status !== ManualFinancialMovementStatus.RECEIVED &&
        input.status !== ManualFinancialMovementStatus.CANCELLED
      ) {
        throw new BadRequestException("Status invalido para entrada");
      }
    } else {
      if (!EXPENSE_CATEGORIES.has(input.category)) {
        throw new BadRequestException("Categoria invalida para despesa");
      }
      if (
        input.status !== ManualFinancialMovementStatus.PENDING &&
        input.status !== ManualFinancialMovementStatus.PAID &&
        input.status !== ManualFinancialMovementStatus.CANCELLED
      ) {
        throw new BadRequestException("Status invalido para despesa");
      }
      if (!input.supplierName) {
        throw new BadRequestException("Fornecedor obrigatorio para despesa");
      }
    }
    if (input.supplierDocument && ![11, 14].includes(input.supplierDocument.length)) {
      throw new BadRequestException("CPF/CNPJ do fornecedor invalido");
    }
    if (input.studentId) {
      const student = await this.prisma.student.findUnique({
        where: { id: input.studentId },
        select: { id: true },
      });
      if (!student) {
        throw new BadRequestException("Academico nao encontrado");
      }
    }
  }

  private async validateAttachmentFile(
    file: UploadedDocumentFile | undefined,
    maxSizeBytes: number,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Arquivo obrigatorio");
    }
    const sizeBytes = file.size ?? file.buffer.length;
    if (sizeBytes <= 0 || file.buffer.length <= 0) {
      throw new BadRequestException("Arquivo vazio nao permitido");
    }
    if (sizeBytes > maxSizeBytes) {
      throw new BadRequestException("Arquivo excede o tamanho permitido");
    }
    const originalFileName = sanitizeOriginalFileName(file.originalname ?? "");
    const extension = path.extname(originalFileName).toLowerCase();
    const expectedMime = expectedMimeFromExtension(extension);
    if (
      !expectedMime ||
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        expectedMime as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
      )
    ) {
      throw new BadRequestException("Formato de arquivo nao permitido");
    }
    if (file.mimetype !== expectedMime) {
      throw new BadRequestException("MIME do arquivo incompativel");
    }
    if (!matchesAttachmentMagicBytes(file.buffer, extension)) {
      throw new BadRequestException("Assinatura do arquivo invalida");
    }
    if (expectedMime.startsWith("image/")) {
      await assertImageStructure(file.buffer, expectedMime);
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

  private async findMovement(id: string) {
    const record = await this.prisma.manualFinancialMovement.findUnique({
      where: { id },
      include: this.movementInclude(),
    });
    if (!record) {
      throw new NotFoundException("Movimentacao financeira nao encontrada");
    }
    return record;
  }

  private async findAttachment(movementId: string, attachmentId: string) {
    const attachment = await this.prisma.manualFinancialMovementAttachment.findFirst({
      where: { id: attachmentId, movementId },
      include: {
        movement: { include: this.movementInclude() },
        uploadedBy: { select: { id: true, name: true } },
      },
    });
    if (!attachment) {
      throw new NotFoundException("Anexo nao encontrado");
    }
    return attachment;
  }

  private movementInclude() {
    return {
      student: {
        include: {
          enrollments: {
            include: {
              institution: { select: { id: true, name: true } },
            },
          },
          person: true,
          studentCards: {
            where: { status: "ACTIVE" },
            orderBy: { issuedAt: "desc" },
            take: 1,
          },
        },
      },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    } satisfies Prisma.ManualFinancialMovementInclude;
  }

  private toMovementResponse(record: MovementRecord) {
    const activeAttachment = record.attachments.find(
      (attachment) =>
        attachment.status === ManualFinancialMovementAttachmentStatus.ACTIVE,
    );
    return {
      id: record.id,
      type: record.type,
      status: record.status,
      category: record.category,
      description: record.description,
      amountCents: record.amountCents,
      amountFormatted: formatInvoiceAmount(record.amountCents),
      signedAmountCents:
        record.type === ManualFinancialMovementType.EXPENSE
          ? -record.amountCents
          : record.amountCents,
      transactionDate: dateOnly(record.transactionDate),
      competenceDate: record.competenceDate ? dateOnly(record.competenceDate) : null,
      dueDate: record.dueDate ? dateOnly(record.dueDate) : null,
      paidAt: record.paidAt ? dateOnly(record.paidAt) : null,
      supplierName: record.supplierName,
      supplierDocument: record.supplierDocument,
      documentNumber: record.documentNumber,
      notes: record.notes,
      student: record.student
        ? {
            id: record.student.id,
            name: record.student.person.fullName,
            cpfMasked: maskCpf(record.student.person.cpf),
            cardNumber: record.student.studentCards[0]?.cardNumber ?? null,
            institutions: record.student.enrollments.map((enrollment) => ({
              id: enrollment.institution.id,
              name: enrollment.institution.name,
            })),
          }
        : null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      cancelledBy: record.cancelledBy,
      cancelReason: record.cancelReason,
      cancelledAt: record.cancelledAt?.toISOString() ?? null,
      activeAttachment: activeAttachment
        ? this.toAttachmentResponse(activeAttachment)
        : null,
      attachments: record.attachments.map((attachment) =>
        this.toAttachmentResponse(attachment),
      ),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toAttachmentResponse(attachment: AttachmentRecord) {
    return {
      id: attachment.id,
      status: attachment.status,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      extension: attachment.extension,
      sizeBytes: attachment.sizeBytes,
      checksumSha256: attachment.checksumSha256,
      uploadedBy: attachment.uploadedBy,
      replacedById: attachment.replacedById,
      replacedAt: attachment.replacedAt?.toISOString() ?? null,
      createdAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
    };
  }

  private auditSnapshot(record: MovementRecord) {
    return {
      id: record.id,
      type: record.type,
      status: record.status,
      category: record.category,
      description: record.description,
      amountCents: record.amountCents,
      transactionDate: dateOnly(record.transactionDate),
      competenceDate: record.competenceDate ? dateOnly(record.competenceDate) : null,
      dueDate: record.dueDate ? dateOnly(record.dueDate) : null,
      paidAt: record.paidAt ? dateOnly(record.paidAt) : null,
      studentId: record.studentId,
      supplierName: record.supplierName,
      supplierDocument: record.supplierDocument ? maskDocument(record.supplierDocument) : null,
      documentNumber: record.documentNumber,
      notes: record.notes,
    };
  }

  private async recordAuditTx(
    tx: Prisma.TransactionClient,
    input: {
      eventType: AdministrativeAuditEventType;
      recordId: string;
      userId?: string;
      metadata?: Prisma.InputJsonObject;
    },
  ) {
    await tx.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: "manual-financial-movements",
        recordId: input.recordId,
        metadata: input.metadata,
      },
    });
  }

  private buildAttachmentStorageKey(input: {
    movementId: string;
    attachmentId: string;
    storedFileName: string;
  }) {
    return [
      "finance",
      "manual-movements",
      input.movementId,
      input.attachmentId,
      input.storedFileName,
    ].join("/");
  }

  private applyInstitutionScope(
    where: Prisma.ManualFinancialMovementWhereInput,
    user?: AuthUser,
  ): Prisma.ManualFinancialMovementWhereInput {
    const scope = getInstitutionScope(user, OPERATIONAL_INSTITUTION_SCOPE);
    if (scope.type === "unrestricted") {
      return where;
    }
    const institutionIds =
      scope.type === "restricted" ? scope.institutionIds : [];
    return {
      AND: [
        where,
        {
          student: {
            enrollments: {
              some: {
                institutionId: { in: institutionIds },
              },
            },
          },
        },
      ],
    };
  }

  private assertMovementInstitutionScope(record: MovementRecord, user?: AuthUser) {
    const scope = getInstitutionScope(user, OPERATIONAL_INSTITUTION_SCOPE);
    if (scope.type === "unrestricted") {
      return;
    }
    if (scope.type === "denied" || !record.student) {
      throw new ForbiddenException("Acesso negado");
    }
    const movementInstitutionIds = record.student.enrollments.map(
      (enrollment) => enrollment.institutionId,
    );
    if (
      !movementInstitutionIds.some((institutionId) =>
        scope.institutionIds.includes(institutionId),
      )
    ) {
      throw new ForbiddenException("Acesso negado");
    }
  }
}

function parseDateOnly(value: string, message: string) {
  try {
    return parseInvoiceDueDate(value);
  } catch {
    throw new BadRequestException(message);
  }
}

function parseCompetenceDate(value: string) {
  const normalized = value.length === 7 ? `${value}-01` : value;
  const date = parseDateOnly(normalized, "Competencia invalida");
  if (date.toISOString().slice(8, 10) !== "01") {
    throw new BadRequestException("Competencia deve usar o primeiro dia do mes");
  }
  return date;
}

function normalizeAmount(amountCents: number | string) {
  try {
    const normalized =
      typeof amountCents === "string"
        ? /^\d+$/.test(amountCents.trim())
          ? Number(amountCents)
          : Number.NaN
        : amountCents;
    assertValidInvoiceAmountCents(normalized);
    return normalized;
  } catch (error) {
    const message =
      error instanceof Error && /technical limit/i.test(error.message)
        ? "Valor excede o limite permitido"
        : "Valor deve ser maior que zero";
    throw new BadRequestException(message);
  }
}

function optional(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function required(value: string | undefined, message: string) {
  const trimmed = optional(value);
  if (!trimmed) {
    throw new BadRequestException(message);
  }
  return trimmed;
}

function normalizeDocument(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function maskCpf(value: string) {
  return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.***.***-$4");
}

function maskDocument(value: string) {
  if (value.length === 11) {
    return maskCpf(value);
  }
  if (value.length === 14) {
    return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.***.***/****-$5");
  }
  return value;
}

function formatCentsRelaxed(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function expectedMimeFromExtension(extension: string) {
  const mimeByExtension = new Map([
    [".pdf", "application/pdf"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
  ]);
  return mimeByExtension.get(extension);
}

function matchesAttachmentMagicBytes(buffer: Buffer, extension: string) {
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
  if (extension === ".webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

async function assertImageStructure(buffer: Buffer, mimeType: string) {
  const expected = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpeg";
  try {
    const image = sharp(buffer, {
      failOn: "error",
      limitInputPixels: 25_000_000,
    });
    const metadata = await image.metadata();
    if (metadata.format !== expected || !metadata.width || !metadata.height) {
      throw new Error("Invalid image metadata");
    }
  } catch {
    throw new BadRequestException("Arquivo de imagem corrompido ou invalido");
  }
}
