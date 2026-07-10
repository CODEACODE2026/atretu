import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  Prisma,
  RecordStatus,
  StudentDocumentType,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { AppConfigService } from "../config/app-config.service.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  validateDocumentFile,
  type UploadedDocumentFile,
} from "../documents/document-file.js";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import { RateLimitService } from "../security/rate-limit.service.js";
import { isValidCpf, normalizeCpf } from "../students/cpf.js";
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
  ) {}

  async getPublicOptions() {
    const [academicYears, institutions, shifts] = await Promise.all([
      this.prisma.academicYear.findMany({
        orderBy: [{ isCurrent: "desc" }, { year: "desc" }],
        select: { id: true, year: true, isCurrent: true },
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
    const documentInputs = this.prepareDocuments(
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

  private prepareDocuments(
    preRegistrationId: string,
    files: PublicDocumentFiles,
  ) {
    return Object.entries(DOCUMENT_FIELD_TYPES).flatMap(([field, documentType]) => {
      const file = files[field as PublicDocumentField];
      if (!file) {
        return [];
      }
      const id = randomUUID();
      const validated = validateDocumentFile(
        file as UploadedDocumentFile,
        this.config.values.documentMaxSizeBytes,
      );
      return [
        {
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
        },
      ];
    });
  }

  private async ensurePublicReferences(body: CreatePublicPreRegistrationDto) {
    const [academicYear, institution, shift] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: body.academicYearId } }),
      this.prisma.institution.findUnique({ where: { id: body.institutionId } }),
      this.prisma.shift.findUnique({ where: { id: body.shiftId } }),
    ]);

    if (!academicYear) {
      throw new BadRequestException("Ano Letivo invalido");
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
