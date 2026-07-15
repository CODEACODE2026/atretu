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
  AcademicYearStatus,
  PreRegistrationDocumentStatus,
  PreRegistrationStatus,
  Prisma,
  RecordStatus,
  StudentDocumentType,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { BusAssignmentsService } from "../bus-assignments/bus-assignments.service.js";
import { resolvePagination } from "../common/pagination.js";
import { AppConfigService } from "../config/app-config.service.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  validateDocumentFile,
  validateDocumentFileStructure,
  type UploadedDocumentFile,
} from "../documents/document-file.js";
import { FileDisposition } from "../documents/dto/documents.dto.js";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import { RateLimitService } from "../security/rate-limit.service.js";
import { StudentCardsService } from "../student-cards/student-cards.service.js";
import { isValidCpf, maskCpf, normalizeCpf } from "../students/cpf.js";
import {
  ApprovePreRegistrationDto,
  ListPreRegistrationsDto,
  PreRegistrationSort,
  PreRegistrationSortOrder,
} from "./dto/pre-registration-admin.dto.js";
import { CreatePublicPreRegistrationDto } from "./dto/pre-registration-public.dto.js";

type PublicDocumentFiles = Partial<Record<PublicDocumentField, Express.Multer.File>>;

type PublicDocumentField =
  | "cpfDocument"
  | "rgDocument"
  | "proofOfAddressDocument"
  | "proofOfEnrollmentDocument";

const DOCUMENT_FIELD_TYPES: Record<PublicDocumentField, StudentDocumentType> = {
  cpfDocument: StudentDocumentType.CPF,
  rgDocument: StudentDocumentType.RG,
  proofOfAddressDocument: StudentDocumentType.PROOF_OF_ADDRESS,
  proofOfEnrollmentDocument: StudentDocumentType.PROOF_OF_ENROLLMENT,
};

@Injectable()
export class PreRegistrationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DocumentStorageService)
    private readonly storage: DocumentStorageService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(BusAssignmentsService)
    private readonly busAssignments: BusAssignmentsService,
    @Inject(StudentCardsService)
    private readonly studentCards: StudentCardsService,
  ) {}

  async getPublicOptions() {
    const [academicYears, institutions, shifts] = await Promise.all([
      this.prisma.academicYear.findMany({
        where: { status: AcademicYearStatus.ACTIVE },
        orderBy: [{ isCurrent: "desc" }, { year: "desc" }],
        select: { id: true, year: true, isCurrent: true, status: true, archivedAt: true },
      }),
      this.prisma.institution.findMany({
        where: { status: RecordStatus.ACTIVE },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      this.prisma.shift.findMany({
        where: { status: RecordStatus.ACTIVE },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { academicYears, institutions, shifts };
  }

  async createPublicPreRegistration(input: {
    body: CreatePublicPreRegistrationDto;
    files: PublicDocumentFiles;
    ip?: string;
    userAgent?: string;
  }) {
    if (this.hasHoneypot(input.body)) {
      return {
        received: true,
        message: "Solicitacao recebida para analise.",
      };
    }

    const cpf = normalizeCpf(input.body.cpf);
    this.rateLimit.assertAllowed(
      `pre-registration:${this.hash(`${input.ip ?? "unknown"}:${cpf}`)}`,
    );

    const prepared = await this.preparePreRegistration(input.body, cpf);
    const documentInputs = await this.prepareDocuments(
      prepared.id,
      input.files,
    );
    const writtenStorageKeys: string[] = [];

    try {
      for (const document of documentInputs) {
        await this.storage.write(document.storageKey, document.buffer);
        writtenStorageKeys.push(document.storageKey);
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const preRegistration = await tx.publicPreRegistration.create({
          data: {
            id: prepared.id,
            publicCode: prepared.publicCode,
            status: "PENDING",
            fullName: prepared.fullName,
            normalizedName: prepared.normalizedName,
            cpf: prepared.cpf,
            rg: prepared.rg,
            birthDate: prepared.birthDate,
            phone: prepared.phone,
            email: prepared.email,
            addressStreet: prepared.addressStreet,
            addressNumber: prepared.addressNumber,
            addressNeighborhood: prepared.addressNeighborhood,
            addressCity: prepared.addressCity,
            guardianFullName: prepared.guardianFullName,
            guardianCpf: prepared.guardianCpf,
            guardianRg: prepared.guardianRg,
            academicYearId: prepared.academicYearId,
            institutionId: prepared.institutionId,
            shiftId: prepared.shiftId,
            course: prepared.course,
            grade: prepared.grade,
            requestFingerprintHash: this.hash(
              `${input.ip ?? "unknown"}:${input.userAgent ?? "unknown"}`,
            ),
            documents: {
              create: documentInputs.map((document) => ({
                id: document.id,
                documentType: document.documentType,
                storageKey: document.storageKey,
                originalFileName: document.originalFileName,
                storedFileName: document.storedFileName,
                mimeType: document.mimeType,
                extension: document.extension,
                sizeBytes: document.sizeBytes,
                checksumSha256: document.checksumSha256,
              })),
            },
          },
        });

        await tx.administrativeAuditLog.create({
          data: {
            eventType: AdministrativeAuditEventType.PRE_REGISTRATION_RECEIVED,
            domain: "pre_registrations",
            recordId: preRegistration.id,
            metadata: {
              preRegistrationId: preRegistration.id,
              action: "received",
              documentCount: documentInputs.length,
            },
          },
        });

        for (const document of documentInputs) {
          await tx.administrativeAuditLog.create({
            data: {
              eventType:
                AdministrativeAuditEventType.PRE_REGISTRATION_DOCUMENT_UPLOADED,
              domain: "pre_registration_documents",
              recordId: document.id,
              metadata: {
                preRegistrationId: preRegistration.id,
                documentId: document.id,
                documentType: document.documentType,
                action: "uploaded",
                sizeBytes: document.sizeBytes,
              },
            },
          });
        }

        return preRegistration;
      });

      return {
        received: true,
        publicCode: created.publicCode,
        message: "Solicitacao recebida para analise.",
      };
    } catch (error) {
      await Promise.all(
        writtenStorageKeys.map((storageKey) => this.storage.removeIfExists(storageKey)),
      );
      this.handleCreateError(error);
    }
  }

  async listPreRegistrations(query: ListPreRegistrationsDto) {
    const where = this.buildListWhere(query);
    const orderBy = this.buildListOrderBy(query);
    const pagination = resolvePagination(query);
    const [data, total] = await Promise.all([
      this.prisma.publicPreRegistration.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.summaryInclude(),
      }),
      this.prisma.publicPreRegistration.count({ where }),
    ]);

    return {
      data: data.map((item) => this.toSummary(item)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getPreRegistration(id: string) {
    const record = await this.prisma.publicPreRegistration.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!record) {
      throw new NotFoundException("Pre-cadastro nao encontrado");
    }
    return this.toDetail(record);
  }

  async getPreRegistrationDocumentFile(input: {
    preRegistrationId: string;
    documentId: string;
    userId: string;
    disposition: FileDisposition;
  }) {
    const document = await this.prisma.preRegistrationDocument.findFirst({
      where: { id: input.documentId, preRegistrationId: input.preRegistrationId },
    });
    if (!document) {
      throw new NotFoundException("Documento nao encontrado");
    }
    if (document.status === PreRegistrationDocumentStatus.REMOVED) {
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

    await this.prisma.administrativeAuditLog.create({
      data: {
        eventType: AdministrativeAuditEventType.PRE_REGISTRATION_DOCUMENT_VIEWED,
        userId: input.userId,
        domain: "pre_registration_documents",
        recordId: input.documentId,
        metadata: {
          preRegistrationId: input.preRegistrationId,
          documentId: input.documentId,
          documentType: document.documentType,
          action: input.disposition,
        },
      },
    });

    return {
      buffer,
      fileName: this.downloadFileName(document.documentType, document.extension),
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      disposition: input.disposition,
    };
  }

  async approvePreRegistration(
    id: string,
    body: ApprovePreRegistrationDto | undefined,
    userId: string,
  ) {
    try {
      const approvedId = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "public_pre_registrations" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const record = await tx.publicPreRegistration.findUnique({
          where: { id },
          include: { documents: true },
        });
        if (!record) {
          throw new NotFoundException("Pre-cadastro nao encontrado");
        }
        if (record.status !== PreRegistrationStatus.PENDING) {
          throw new BadRequestException("Pre-cadastro ja analisado");
        }

        await this.ensureApprovalReferences(record, tx);
        const existingPerson = await tx.person.findUnique({
          where: { cpf: record.cpf },
        });
        if (existingPerson) {
          throw new ConflictException("CPF ja cadastrado");
        }

        const person = await tx.person.create({
          data: {
            fullName: record.fullName,
            normalizedName: record.normalizedName,
            cpf: record.cpf,
            rg: record.rg,
            birthDate: record.birthDate,
            phone: record.phone,
            email: record.email,
            addressStreet: record.addressStreet,
            addressNumber: record.addressNumber,
            addressNeighborhood: record.addressNeighborhood,
            addressCity: record.addressCity,
          },
        });

        const student = await tx.student.create({
          data: {
            personId: person.id,
            guardian: record.guardianFullName
              ? {
                  create: {
                    fullName: record.guardianFullName,
                    cpf: record.guardianCpf,
                    rg: record.guardianRg,
                  },
                }
              : undefined,
            enrollments: {
              create: {
                academicYearId: record.academicYearId,
                institutionId: record.institutionId,
                shiftId: record.shiftId,
                course: record.course,
                grade: record.grade,
              },
            },
          },
          include: { enrollments: { take: 1 } },
        });
        const enrollment = student.enrollments[0];
        if (!enrollment) {
          throw new BadRequestException("Matricula inicial obrigatoria");
        }
        await this.studentCards.issueAutomaticStudentCardTx(tx, {
          studentId: student.id,
          enrollmentId: enrollment.id,
          userId,
          note: "Emitida automaticamente na aprovacao do pre-cadastro",
        });
        if (body?.busId) {
          await this.busAssignments.assignBusTx(tx, {
            enrollmentId: enrollment.id,
            busId: body.busId,
            userId,
            note: "Vinculo inicial criado na aprovacao do pre-cadastro",
          });
        }

        for (const document of record.documents.filter(
          (item) => item.status === PreRegistrationDocumentStatus.UPLOADED,
        )) {
          const studentDocument = await tx.studentDocument.create({
            data: {
              studentId: student.id,
              documentType: document.documentType,
              storageKey: document.storageKey,
              originalFileName: document.originalFileName,
              storedFileName: document.storedFileName,
              mimeType: document.mimeType,
              extension: document.extension,
              sizeBytes: document.sizeBytes,
              checksumSha256: document.checksumSha256,
              uploadedByUserId: userId,
            },
          });
          await tx.preRegistrationDocument.update({
            where: { id: document.id },
            data: {
              status: PreRegistrationDocumentStatus.PROMOTED,
              promotedToStudentDocumentId: studentDocument.id,
            },
          });
          await tx.administrativeAuditLog.create({
            data: {
              eventType:
                AdministrativeAuditEventType.PRE_REGISTRATION_DOCUMENT_PROMOTED,
              userId,
              domain: "pre_registration_documents",
              recordId: document.id,
              metadata: {
                preRegistrationId: record.id,
                documentId: document.id,
                studentDocumentId: studentDocument.id,
                studentId: student.id,
                documentType: document.documentType,
                action: "promoted",
              },
            },
          });
        }

        await tx.publicPreRegistration.update({
          where: { id: record.id },
          data: {
            status: PreRegistrationStatus.APPROVED,
            reviewedByUserId: userId,
            reviewedAt: new Date(),
            approvedStudentId: student.id,
          },
        });

        await tx.administrativeAuditLog.create({
          data: {
            eventType: AdministrativeAuditEventType.PRE_REGISTRATION_APPROVED,
            userId,
            domain: "pre_registrations",
            recordId: record.id,
            metadata: {
              preRegistrationId: record.id,
              studentId: student.id,
              enrollmentId: student.enrollments[0]?.id ?? "",
              action: "approved",
            },
          },
        });

        return record.id;
      });

      return this.getPreRegistration(approvedId);
    } catch (error) {
      this.handleCreateError(error);
    }
  }

  async rejectPreRegistration(id: string, reason: string, userId: string) {
    const rejectedId = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "public_pre_registrations" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const record = await tx.publicPreRegistration.findUnique({ where: { id } });
      if (!record) {
        throw new NotFoundException("Pre-cadastro nao encontrado");
      }
      if (record.status !== PreRegistrationStatus.PENDING) {
        throw new BadRequestException("Pre-cadastro ja analisado");
      }

      const rejected = await tx.publicPreRegistration.update({
        where: { id },
        data: {
          status: PreRegistrationStatus.REJECTED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });

      await tx.administrativeAuditLog.create({
        data: {
          eventType: AdministrativeAuditEventType.PRE_REGISTRATION_REJECTED,
          userId,
          domain: "pre_registrations",
          recordId: rejected.id,
          metadata: {
            preRegistrationId: rejected.id,
            action: "rejected",
          },
        },
      });

      return rejected.id;
    });

    return this.getPreRegistration(rejectedId);
  }

  private async preparePreRegistration(
    body: CreatePublicPreRegistrationDto,
    cpf: string,
  ) {
    if (!isValidCpf(cpf)) {
      throw new BadRequestException("CPF invalido");
    }

    const guardianCpf = body.guardianCpf
      ? normalizeCpf(body.guardianCpf)
      : undefined;
    if (guardianCpf && !isValidCpf(guardianCpf)) {
      throw new BadRequestException("CPF do responsavel invalido");
    }
    if ((guardianCpf || body.guardianRg) && !body.guardianFullName) {
      throw new BadRequestException("Nome do responsavel obrigatorio");
    }

    const birthDate = this.parsePastOrTodayDate(body.birthDate);

    await this.ensurePublicReferences(body);
    await this.ensureCpfCanSubmit(cpf);

    return {
      id: randomUUID(),
      publicCode: this.publicCode(),
      fullName: body.fullName,
      normalizedName: this.normalizeName(body.fullName),
      cpf,
      rg: this.optional(body.rg),
      birthDate,
      phone: this.optional(body.phone),
      email: this.optional(body.email),
      addressStreet: body.addressStreet,
      addressNumber: body.addressNumber,
      addressNeighborhood: body.addressNeighborhood,
      addressCity: body.addressCity,
      guardianFullName: this.optional(body.guardianFullName),
      guardianCpf,
      guardianRg: this.optional(body.guardianRg),
      academicYearId: body.academicYearId,
      institutionId: body.institutionId,
      shiftId: body.shiftId,
      course: body.course,
      grade: body.grade,
    };
  }

  private async prepareDocuments(
    preRegistrationId: string,
    files: PublicDocumentFiles,
  ) {
    const documents = [];
    for (const [field, documentType] of Object.entries(DOCUMENT_FIELD_TYPES)) {
      const file = files[field as PublicDocumentField];
      if (!file) {
        continue;
      }
      const id = randomUUID();
      const validated = validateDocumentFile(
        file as UploadedDocumentFile,
        this.config.values.documentMaxSizeBytes,
      );
      await validateDocumentFileStructure(
        file as UploadedDocumentFile,
        validated.mimeType,
      );
      documents.push({
        ...validated,
        id,
        documentType,
        storageKey: this.buildPreRegistrationStorageKey({
          preRegistrationId,
          documentType,
          documentId: id,
          storedFileName: validated.storedFileName,
        }),
        buffer: file.buffer,
      });
    }
    return documents;
  }

  private async ensurePublicReferences(body: CreatePublicPreRegistrationDto) {
    const [academicYear, institution, shift] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: body.academicYearId } }),
      this.prisma.institution.findUnique({ where: { id: body.institutionId } }),
      this.prisma.shift.findUnique({ where: { id: body.shiftId } }),
    ]);

    if (!academicYear || academicYear.status !== AcademicYearStatus.ACTIVE) {
      throw new BadRequestException(
        "ACADEMIC_YEAR_NOT_ACTIVE: Ano Letivo ativo obrigatorio",
      );
    }
    if (!institution || institution.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Instituicao ativa obrigatoria");
    }
    if (!shift || shift.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Turno ativo obrigatorio");
    }
  }

  private async ensureCpfCanSubmit(cpf: string) {
    const [person, pendingOrApproved] = await Promise.all([
      this.prisma.person.findUnique({ where: { cpf } }),
      this.prisma.publicPreRegistration.findFirst({
        where: { cpf, status: { in: ["PENDING", "APPROVED"] } },
      }),
    ]);

    if (person || pendingOrApproved) {
      throw new ConflictException("Solicitacao nao pode ser recebida");
    }
  }

  private async ensureApprovalReferences(
    record: ApprovalRecord,
    tx: Prisma.TransactionClient,
  ) {
    const [academicYear, institution, shift] = await Promise.all([
      tx.academicYear.findUnique({ where: { id: record.academicYearId } }),
      tx.institution.findUnique({ where: { id: record.institutionId } }),
      tx.shift.findUnique({ where: { id: record.shiftId } }),
    ]);
    if (!academicYear || academicYear.status !== AcademicYearStatus.ACTIVE) {
      throw new BadRequestException(
        "ACADEMIC_YEAR_NOT_ACTIVE: Ano Letivo ativo obrigatorio",
      );
    }
    if (!institution || institution.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Instituicao ativa obrigatoria");
    }
    if (!shift || shift.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Turno ativo obrigatorio");
    }
  }

  private buildListWhere(query: ListPreRegistrationsDto) {
    const where: Prisma.PublicPreRegistrationWhereInput = {
      status: query.status,
    };
    if (query.search) {
      const cpf = normalizeCpf(query.search);
      const normalizedName = this.normalizeName(query.search);
      where.OR = [
        { publicCode: { contains: query.search, mode: "insensitive" } },
        { normalizedName: { contains: normalizedName } },
        ...(cpf ? [{ cpf: { contains: cpf } }] : []),
      ];
    }
    return where;
  }

  private buildListOrderBy(
    query: ListPreRegistrationsDto,
  ): Prisma.PublicPreRegistrationOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder =
      query.order === PreRegistrationSortOrder.ASC ? "asc" : "desc";
    if (query.sort === PreRegistrationSort.NAME) {
      return [{ normalizedName: direction }, { createdAt: "desc" }];
    }
    if (query.sort === PreRegistrationSort.STATUS) {
      return [{ status: direction }, { createdAt: "desc" }];
    }
    return [{ createdAt: direction }, { normalizedName: "asc" }];
  }

  private summaryInclude() {
    return {
      academicYear: true,
      institution: true,
      shift: true,
    } satisfies Prisma.PublicPreRegistrationInclude;
  }

  private detailInclude() {
    return {
      academicYear: true,
      institution: true,
      shift: true,
      documents: { orderBy: [{ documentType: "asc" }, { createdAt: "desc" }] },
      reviewedBy: { select: { id: true, name: true, email: true } },
      approvedStudent: {
        select: {
          id: true,
          person: { select: { fullName: true, cpf: true } },
        },
      },
    } satisfies Prisma.PublicPreRegistrationInclude;
  }

  private toSummary(record: PreRegistrationSummaryRecord) {
    return {
      id: record.id,
      publicCode: record.publicCode,
      status: record.status,
      fullName: record.fullName,
      cpfMasked: maskCpf(record.cpf),
      academicYear: record.academicYear,
      institution: record.institution,
      shift: record.shift,
      course: record.course,
      grade: record.grade,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      reviewedAt: record.reviewedAt,
    };
  }

  private toDetail(record: PreRegistrationDetailRecord) {
    return {
      id: record.id,
      publicCode: record.publicCode,
      status: record.status,
      fullName: record.fullName,
      cpf: record.cpf,
      rg: record.rg,
      birthDate: record.birthDate,
      phone: record.phone,
      email: record.email,
      addressStreet: record.addressStreet,
      addressNumber: record.addressNumber,
      addressNeighborhood: record.addressNeighborhood,
      addressCity: record.addressCity,
      guardian: record.guardianFullName
        ? {
            fullName: record.guardianFullName,
            cpf: record.guardianCpf,
            rg: record.guardianRg,
          }
        : null,
      academicYear: record.academicYear,
      institution: record.institution,
      shift: record.shift,
      course: record.course,
      grade: record.grade,
      documents: record.documents.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        mimeType: document.mimeType,
        extension: document.extension,
        sizeBytes: document.sizeBytes,
        checksumSha256: document.checksumSha256,
        status: document.status,
        promotedToStudentDocumentId: document.promotedToStudentDocumentId,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })),
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt,
      rejectionReason: record.rejectionReason,
      approvedStudent: record.approvedStudent
        ? {
            id: record.approvedStudent.id,
            fullName: record.approvedStudent.person.fullName,
            cpfMasked: maskCpf(record.approvedStudent.person.cpf),
          }
        : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private downloadFileName(
    documentType: StudentDocumentType,
    extension: string,
  ): string {
    const date = new Date().toISOString().slice(0, 10);
    return `atretu-pre-cadastro-${documentType.toLowerCase()}-${date}.${extension}`;
  }

  private buildPreRegistrationStorageKey(input: {
    preRegistrationId: string;
    documentType: StudentDocumentType;
    documentId: string;
    storedFileName: string;
  }) {
    return [
      "pre-registrations",
      input.preRegistrationId,
      input.documentType,
      input.documentId,
      input.storedFileName,
    ].join("/");
  }

  private parsePastOrTodayDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date > today) {
      throw new BadRequestException("Data de nascimento invalida");
    }
    return date;
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  private optional(value?: string) {
    return value && value.length > 0 ? value : undefined;
  }

  private hasHoneypot(body: CreatePublicPreRegistrationDto) {
    return Boolean(body.website && body.website.length > 0);
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private publicCode() {
    return `PRE-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  }

  private handleCreateError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Solicitacao nao pode ser recebida");
    }
    throw error;
  }
}

type ApprovalRecord = Prisma.PublicPreRegistrationGetPayload<{
  include: { documents: true };
}>;

type PreRegistrationSummaryRecord = Prisma.PublicPreRegistrationGetPayload<{
  include: { academicYear: true; institution: true; shift: true };
}>;

type PreRegistrationDetailRecord = Prisma.PublicPreRegistrationGetPayload<{
  include: ReturnType<PreRegistrationsService["detailInclude"]>;
}>;
