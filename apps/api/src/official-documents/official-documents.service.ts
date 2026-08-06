import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BoardMemberRole,
  BoardMembershipStatus,
  OfficialDocumentIssue,
  OfficialDocumentType,
  Prisma,
  StudentHistoryEventType,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { scopedInstitutionFilter } from "../auth/institution-scope.js";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import { FileDisposition } from "../documents/dto/documents.dto.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser } from "../users/users.service.js";
import type {
  IssueInstitutionalOfficialDocumentDto,
  IssueOfficialDocumentDto,
} from "./dto/official-documents.dto.js";
import {
  OfficialDocumentPdfBuilder,
  type OfficialDocumentPdfBlock,
  type OfficialDocumentPdfInput,
} from "./official-document-pdf.builder.js";
import {
  INTERNAL_REGULATION_APPROVAL_DATE,
  INTERNAL_REGULATION_APPROVAL_TEXT,
  INTERNAL_REGULATION_DOCUMENT_TITLE,
  internalRegulationBody,
} from "./internal-regulation.content.js";
import {
  getOfficialDocumentDefinition,
  listOfficialDocumentDefinitions,
  type OfficialDocumentSignerDefinition,
  type OfficialDocumentSignerSource,
} from "./official-document.registry.js";

type StudentForOfficialDocument = Prisma.StudentGetPayload<{
  include: ReturnType<OfficialDocumentsService["studentInclude"]>;
}>;

type TerminationTermPayload = {
  dueDate: Date;
  notificationDate: Date;
  notes?: string;
  reason: string;
  regularizationDeadlineDays: number;
};

type OfficialDocumentIssuePayload = IssueOfficialDocumentDto | undefined;
type InstitutionalOfficialDocumentIssuePayload =
  | IssueInstitutionalOfficialDocumentDto
  | undefined;

type OfficialDocumentSnapshot = {
  approvalDate?: string;
  body: OfficialDocumentPdfBlock[];
  documentTitle: string;
  documentType: OfficialDocumentType;
  emittedAt: string;
  footerNote: string;
  protocol: string;
  qrPayload: string;
  signatureLabel: string;
  signatureName: string;
  signatureTitle?: string;
  signers: OfficialDocumentSignerSnapshot[];
  subject: {
    id: string | null;
    name: string;
    scope: "INSTITUTIONAL" | "STUDENT";
  };
  student?: {
    id: string;
    address: string;
    city: string;
    name: string;
    cpf: string;
    rg: string;
    status: string;
  };
  template: { key: string; version: number };
  term?: {
    dueDate: string;
    notificationDate: string;
    notes: string | null;
    reason: string;
    regularizationDeadlineDays: number;
    regularizationLimit: string;
  };
  notes?: string | null;
  termination?: {
    occurredAt: string;
    reason: string | null;
    justification: string | null;
  } | null;
  version: number;
};

type OfficialDocumentSignerSnapshot = {
  boardId: string | null;
  boardMemberId: string | null;
  boardPeriodEnd: string | null;
  boardPeriodStart: string | null;
  endedAt: string | null;
  label: string;
  name: string;
  personId: string | null;
  resolvedAt: string;
  role: string;
  roleLabel: string;
  signerName: string;
  signerPersonId: string | null;
  signerRole: string;
  signerRoleLabel: string;
  signerSource: OfficialDocumentSignerSource;
  signerStudentId: string | null;
  source: OfficialDocumentSignerSource;
  startedAt: string | null;
  studentId: string | null;
};

@Injectable()
export class OfficialDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentStorageService)
    private readonly storage: DocumentStorageService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
    @Inject(OfficialDocumentPdfBuilder)
    private readonly pdfBuilder: OfficialDocumentPdfBuilder,
  ) {}

  async listStudentOfficialDocuments(studentId: string, currentUser: AuthUser) {
    const student = await this.getStudent(studentId, currentUser);
    const issues = await this.prisma.officialDocumentIssue.findMany({
      where: { studentId },
      include: { issuedBy: { select: { id: true, name: true, email: true } } },
      orderBy: [{ documentType: "asc" }, { issuedAt: "desc" }],
    });
    return {
      data: listOfficialDocumentDefinitions().map((definition) => {
        if (definition.scope !== "STUDENT") {
          return null;
        }
        const type = definition.type;
        const latestIssue = issues.find((issue) => issue.documentType === type);
        const canIssue = definition.canIssue(student);
        return {
          type,
          title: definition.title,
          description: definition.description,
          situation: latestIssue ? "ISSUED" : "NOT_ISSUED",
          canIssue,
          blockedReason: canIssue ? null : definition.blockedReason,
          latestIssue: latestIssue ? this.toIssueResponse(latestIssue) : null,
          history: issues
            .filter((issue) => issue.documentType === type)
            .map((issue) => this.toIssueResponse(issue)),
        };
      }).filter(Boolean),
    };
  }

  async listInstitutionalOfficialDocuments() {
    const issues = await this.prisma.officialDocumentIssue.findMany({
      where: { studentId: null },
      include: { issuedBy: { select: { id: true, name: true, email: true } } },
      orderBy: [{ documentType: "asc" }, { issuedAt: "desc" }],
    });
    return {
      data: await Promise.all(
        listOfficialDocumentDefinitions()
          .filter((definition) => definition.scope === "INSTITUTIONAL")
          .map(async (definition) => {
          const type = definition.type;
          const latestIssue = issues.find((issue) => issue.documentType === type);
          return {
            type,
            title: definition.title,
            description: definition.description,
            situation: latestIssue ? "ISSUED" : "NOT_ISSUED",
            canIssue: true,
            blockedReason: null,
            signerPreview: await this.signerPreview(definition.signers),
            latestIssue: latestIssue ? this.toIssueResponse(latestIssue) : null,
            history: issues
              .filter((issue) => issue.documentType === type)
              .map((issue) => this.toIssueResponse(issue)),
          };
        }),
      ),
    };
  }

  async issueDocument(
    studentId: string,
    documentType: OfficialDocumentType,
    currentUser: AuthUser,
    sourceIssueId?: string,
    payload?: OfficialDocumentIssuePayload,
  ) {
    const student = await this.getStudent(studentId, currentUser);
    this.assertCanIssue(documentType, student);
    let sourceIssue: OfficialDocumentIssue | null = null;
    if (sourceIssueId) {
      sourceIssue = await this.prisma.officialDocumentIssue.findFirst({
        where: { id: sourceIssueId, studentId, documentType },
      });
      if (!sourceIssue) {
        throw new NotFoundException("Documento emitido nao encontrado");
      }
    }

    const definition = getOfficialDocumentDefinition(documentType);
    const issueId = randomUUID();
    const issuedAt = new Date();
    const protocol = this.buildProtocol(issuedAt);
    const snapshot = await this.buildSnapshot(
      student,
      documentType,
      issuedAt,
      protocol,
      payload,
      sourceIssue,
    );
    const pdfInput = this.toPdfInput(snapshot, currentUser.name);
    const pdf = await this.pdfBuilder.render(pdfInput);
    const storageKey = `official-documents/${studentId}/${issueId}.pdf`;
    const fileName = this.fileName(student, documentType, protocol);
    const checksumSha256 = createHash("sha256").update(pdf).digest("hex");

    await this.storage.write(storageKey, pdf);
    try {
      const issue = await this.prisma.$transaction(async (tx) => {
        const created = await tx.officialDocumentIssue.create({
          data: {
            id: issueId,
            studentId,
            documentType,
            templateKey: definition.templateKey,
            templateVersion: definition.templateVersion,
            version: definition.version,
            protocol,
            storageKey,
            fileName,
            sizeBytes: pdf.byteLength,
            checksumSha256,
            issuedByUserId: currentUser.id,
            sourceIssueId,
            contentSnapshot: snapshot as Prisma.InputJsonObject,
            notes: this.issueNotes(snapshot),
          },
          include: {
            issuedBy: { select: { id: true, name: true, email: true } },
          },
        });
        await tx.administrativeAuditLog.create({
          data: {
            eventType: sourceIssueId
              ? AdministrativeAuditEventType.OFFICIAL_DOCUMENT_REISSUED
              : AdministrativeAuditEventType.OFFICIAL_DOCUMENT_ISSUED,
            userId: currentUser.id,
            domain: "official_documents",
            recordId: created.id,
            metadata: {
              action: sourceIssueId ? "reissue" : "issue",
              documentType,
              issueId: created.id,
              protocol,
              sourceIssueId,
              studentId,
              signerName: snapshot.signers[0]?.name,
              signerRole: snapshot.signers[0]?.role,
              signerSource: snapshot.signers[0]?.source,
              boardId: snapshot.signers[0]?.boardId,
              boardMemberId: snapshot.signers[0]?.boardMemberId,
              templateKey: definition.templateKey,
              templateVersion: definition.templateVersion,
              term: snapshot.term
                ? {
                    dueDate: snapshot.term.dueDate,
                    notificationDate: snapshot.term.notificationDate,
                    reason: snapshot.term.reason,
                    regularizationDeadlineDays:
                      snapshot.term.regularizationDeadlineDays,
                  }
                : undefined,
              version: definition.version,
              notes: this.issueNotes(snapshot),
            },
          },
        });
        return created;
      });
      return this.toIssueResponse(issue);
    } catch (error) {
      await this.storage.removeIfExists(storageKey);
      throw error;
    }
  }

  private async signerPreview(
    definitions: readonly OfficialDocumentSignerDefinition[],
  ) {
    try {
      const signers = await this.resolveSigners(definitions, null, new Date());
      const signer = signers[0];
      return signer
        ? {
            error: null,
            signerName: signer.signerName,
            signerRole: signer.signerRole,
            signerRoleLabel: signer.signerRoleLabel,
          }
        : null;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Signatario nao encontrado.",
        signerName: null,
        signerRole: null,
        signerRoleLabel: null,
      };
    }
  }

  async issueInstitutionalDocument(
    documentType: OfficialDocumentType,
    currentUser: AuthUser,
    sourceIssueId?: string,
    payload?: InstitutionalOfficialDocumentIssuePayload,
  ) {
    const definition = getOfficialDocumentDefinition(documentType);
    if (definition.scope !== "INSTITUTIONAL") {
      throw new BadRequestException("Documento oficial institucional invalido.");
    }
    let sourceIssue: OfficialDocumentIssue | null = null;
    if (sourceIssueId) {
      sourceIssue = await this.prisma.officialDocumentIssue.findFirst({
        where: { id: sourceIssueId, studentId: null, documentType },
      });
      if (!sourceIssue) {
        throw new NotFoundException("Documento emitido nao encontrado");
      }
    }

    const issueId = randomUUID();
    const issuedAt = new Date();
    const protocol = this.buildProtocol(issuedAt);
    const snapshot = sourceIssue
      ? this.reissueSnapshot(sourceIssue, issuedAt, protocol)
      : await this.buildInstitutionalSnapshot(
          documentType,
          issuedAt,
          protocol,
          payload,
        );
    const pdfInput = this.toPdfInput(snapshot, currentUser.name);
    const pdf = await this.pdfBuilder.render(pdfInput);
    const storageKey = `official-documents/institutional/${issueId}.pdf`;
    const fileName = this.institutionalFileName(documentType, protocol);
    const checksumSha256 = createHash("sha256").update(pdf).digest("hex");

    await this.storage.write(storageKey, pdf);
    try {
      const issue = await this.prisma.$transaction(async (tx) => {
        const created = await tx.officialDocumentIssue.create({
          data: {
            id: issueId,
            studentId: null,
            documentType,
            templateKey: definition.templateKey,
            templateVersion: definition.templateVersion,
            version: definition.version,
            protocol,
            storageKey,
            fileName,
            sizeBytes: pdf.byteLength,
            checksumSha256,
            issuedByUserId: currentUser.id,
            sourceIssueId,
            contentSnapshot: snapshot as Prisma.InputJsonObject,
            notes: this.issueNotes(snapshot),
          },
          include: {
            issuedBy: { select: { id: true, name: true, email: true } },
          },
        });
        await tx.administrativeAuditLog.create({
          data: {
            eventType: sourceIssueId
              ? AdministrativeAuditEventType.OFFICIAL_DOCUMENT_REISSUED
              : AdministrativeAuditEventType.OFFICIAL_DOCUMENT_ISSUED,
            userId: currentUser.id,
            domain: "official_documents",
            recordId: created.id,
            metadata: {
              action: sourceIssueId ? "reissue" : "issue",
              documentType,
              issueId: created.id,
              protocol,
              sourceIssueId,
              studentId: null,
              signerName: snapshot.signers[0]?.name,
              signerRole: snapshot.signers[0]?.role,
              signerSource: snapshot.signers[0]?.source,
              boardId: snapshot.signers[0]?.boardId,
              boardMemberId: snapshot.signers[0]?.boardMemberId,
              approvalDate: snapshot.approvalDate,
              emittedByUserId: currentUser.id,
              templateKey: definition.templateKey,
              templateVersion: definition.templateVersion,
              version: definition.version,
              notes: this.issueNotes(snapshot),
            },
          },
        });
        return created;
      });
      return this.toIssueResponse(issue);
    } catch (error) {
      await this.storage.removeIfExists(storageKey);
      throw error;
    }
  }

  async reissueDocument(studentId: string, issueId: string, currentUser: AuthUser) {
    const source = await this.findIssue(studentId, issueId);
    return this.issueDocument(
      studentId,
      source.documentType,
      currentUser,
      issueId,
      this.reissuePayload(source),
    );
  }

  async reissueInstitutionalDocument(issueId: string, currentUser: AuthUser) {
    const source = await this.findInstitutionalIssue(issueId);
    return this.issueInstitutionalDocument(source.documentType, currentUser, issueId);
  }

  async getIssue(studentId: string, issueId: string, currentUser: AuthUser) {
    await this.getStudent(studentId, currentUser);
    const issue = await this.findIssue(studentId, issueId);
    return this.toIssueResponse(issue);
  }

  async getInstitutionalIssue(issueId: string) {
    const issue = await this.findInstitutionalIssue(issueId);
    return this.toIssueResponse(issue);
  }

  async getIssueFile(
    studentId: string,
    issueId: string,
    disposition: FileDisposition,
    currentUser: AuthUser,
  ) {
    await this.getStudent(studentId, currentUser);
    const issue = await this.findIssue(studentId, issueId);
    const buffer = await this.storage.read(issue.storageKey);
    await this.audit.record({
      eventType:
        disposition === FileDisposition.INLINE
          ? AdministrativeAuditEventType.OFFICIAL_DOCUMENT_VIEWED
          : AdministrativeAuditEventType.OFFICIAL_DOCUMENT_DOWNLOADED,
      userId: currentUser.id,
      domain: "official_documents",
      recordId: issue.id,
      metadata: {
        action: disposition === FileDisposition.INLINE ? "view" : "download",
        documentType: issue.documentType,
        protocol: issue.protocol,
        studentId,
        version: issue.version,
      },
    });
    return {
      buffer,
      disposition,
      fileName: issue.fileName,
      mimeType: issue.mimeType,
      sizeBytes: issue.sizeBytes,
    };
  }

  async getInstitutionalIssueFile(
    issueId: string,
    disposition: FileDisposition,
    currentUser: AuthUser,
  ) {
    const issue = await this.findInstitutionalIssue(issueId);
    const buffer = await this.storage.read(issue.storageKey);
    await this.audit.record({
      eventType:
        disposition === FileDisposition.INLINE
          ? AdministrativeAuditEventType.OFFICIAL_DOCUMENT_VIEWED
          : AdministrativeAuditEventType.OFFICIAL_DOCUMENT_DOWNLOADED,
      userId: currentUser.id,
      domain: "official_documents",
      recordId: issue.id,
      metadata: {
        action: disposition === FileDisposition.INLINE ? "view" : "download",
        documentType: issue.documentType,
        protocol: issue.protocol,
        studentId: null,
        version: issue.version,
      },
    });
    return {
      buffer,
      disposition,
      fileName: issue.fileName,
      mimeType: issue.mimeType,
      sizeBytes: issue.sizeBytes,
    };
  }

  private studentInclude() {
    return {
      person: true,
      historyEvents: {
        where: { eventType: StudentHistoryEventType.STUDENT_TERMINATED },
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
      enrollments: {
        include: {
          academicYear: true,
          institution: true,
          shift: true,
        },
        orderBy: [{ academicYear: { year: "desc" } }, { createdAt: "desc" }],
        take: 1,
      },
    } satisfies Prisma.StudentInclude;
  }

  private async getStudent(studentId: string, currentUser: AuthUser) {
    const institutionFilter = scopedInstitutionFilter(currentUser);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        ...(institutionFilter
          ? { enrollments: { some: { institutionId: institutionFilter } } }
          : {}),
      },
      include: this.studentInclude(),
    });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }
    return student;
  }

  private canIssue(
    documentType: OfficialDocumentType,
    student: StudentForOfficialDocument,
  ) {
    return getOfficialDocumentDefinition(documentType).canIssue(student);
  }

  private assertCanIssue(
    documentType: OfficialDocumentType,
    student: StudentForOfficialDocument,
  ) {
    if (!this.canIssue(documentType, student)) {
      throw new BadRequestException(
        `${getOfficialDocumentDefinition(documentType).title} nao esta disponivel para este academico`,
      );
    }
  }

  private async findIssue(studentId: string, issueId: string) {
    const issue = await this.prisma.officialDocumentIssue.findFirst({
      where: { id: issueId, studentId },
      include: { issuedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!issue) {
      throw new NotFoundException("Documento emitido nao encontrado");
    }
    return issue;
  }

  private async findInstitutionalIssue(issueId: string) {
    const issue = await this.prisma.officialDocumentIssue.findFirst({
      where: { id: issueId, studentId: null },
      include: { issuedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!issue) {
      throw new NotFoundException("Documento emitido nao encontrado");
    }
    return issue;
  }

  private async buildSnapshot(
    student: StudentForOfficialDocument,
    documentType: OfficialDocumentType,
    issuedAt: Date,
    protocol: string,
    payload?: OfficialDocumentIssuePayload,
    sourceIssue?: OfficialDocumentIssue | null,
  ): Promise<OfficialDocumentSnapshot> {
    if (sourceIssue) {
      return this.reissueSnapshot(sourceIssue, issuedAt, protocol);
    }
    if (documentType === OfficialDocumentType.TERMINATION_TERM) {
      return this.buildTerminationTermSnapshot(student, issuedAt, protocol, payload);
    }
    return this.buildTerminationLetterSnapshot(student, documentType, issuedAt, protocol);
  }

  private async buildTerminationLetterSnapshot(
    student: StudentForOfficialDocument,
    documentType: OfficialDocumentType,
    issuedAt: Date,
    protocol: string,
  ): Promise<OfficialDocumentSnapshot> {
    const termination = student.historyEvents[0] ?? null;
    const definition = getOfficialDocumentDefinition(documentType);
    const signers = await this.resolveSigners(definition.signers, student, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const address = this.formatAddress(student.person);
    const issuedCity = student.person.addressCity || "Terra Rica";
    const body = this.paragraphs([
      "Prezada Diretoria,",
      `Eu, ${student.person.fullName}, RG: ${this.formatRg(student.person.rg)}, CPF: ${this.formatCpf(student.person.cpf)}, residente e à ${address}, venho, por meio desta solicitação formal, requerer minha exclusão do quadro de sócios da ATRETU, com efeito imediato e caráter irrevogável, a partir da presente data. Solicito, outrossim, que seja cessada a emissão de cobranças de mensalidade em meu nome, e que a Tesouraria da ATRETU seja contatada para verificar eventuais pendências financeiras e/ou confirmar a quitação de meus compromissos como associado.`,
      "Declaro estar ciente de que, em caso de interesse em retornar ao quadro de sócios da ATRETU, poderei solicitar nova adesão somente após o prazo de 30 dias a contar da data de minha exclusão. Ademais, compreendo que, em caso de aprovação de minha nova adesão, o prazo para que eu possa ter direito aos serviços prestados pela associação será de 15 dias após a efetivação da nova inscrição.",
      "Atenciosamente,",
    ]);
    return {
      body,
      documentTitle: definition.title,
      documentType,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signatureLabel: `${issuedCity}, ${this.formatDate(issuedAt)}`,
      signatureName: primarySigner.name,
      signatureTitle: primarySigner.label,
      signers,
      subject: {
        id: student.id,
        name: student.person.fullName,
        scope: "STUDENT",
      },
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      student: {
        id: student.id,
        address,
        city: issuedCity,
        name: student.person.fullName,
        cpf: this.formatCpf(student.person.cpf),
        rg: this.formatRg(student.person.rg),
        status: student.status,
      },
      termination: termination
        ? {
            occurredAt: termination.occurredAt.toISOString(),
            reason: termination.terminationReason,
            justification: termination.justification,
          }
        : null,
      version: definition.version,
    };
  }

  private async buildTerminationTermSnapshot(
    student: StudentForOfficialDocument,
    issuedAt: Date,
    protocol: string,
    payload?: OfficialDocumentIssuePayload,
  ): Promise<OfficialDocumentSnapshot> {
    const definition = getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_TERM);
    const term = this.resolveTerminationTermPayload(payload);
    const signers = await this.resolveSigners(definition.signers, student, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const studentName = student.person.fullName;
    const notificationDate = this.formatDate(term.notificationDate);
    const dueDate = this.formatDate(term.dueDate);
    const regularizationLimit = this.addDays(
      term.notificationDate,
      term.regularizationDeadlineDays,
    );
    const regularizationLimitText = this.formatDate(regularizationLimit);
    const body = this.paragraphs([
      "Prezada Diretoria,",
      `Por meio deste Termo de Desligamento, a ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS - ATRETU notifica o(a) associado(a) ${studentName}, CPF ${this.formatCpf(student.person.cpf)}, RG ${this.formatRg(student.person.rg)}, acerca do processo de desligamento motivado por ${term.reason.toLowerCase()}.`,
      `Consta em nossos registros pendência com vencimento em ${dueDate}. A notificação formal foi realizada em ${notificationDate}, ficando concedido o prazo de ${term.regularizationDeadlineDays} dias para regularização, com término em ${regularizationLimitText}.`,
      "Caso a pendência não seja regularizada dentro do prazo informado, o(a) associado(a) será desligado(a) do quadro de sócios da ATRETU, com a consequente suspensão dos direitos e benefícios vinculados à associação, sem prejuízo da cobrança dos valores eventualmente devidos.",
      "Regularizada a situação dentro do prazo, este termo ficará sem efeito para fins de desligamento, permanecendo o(a) associado(a) sujeito(a) às demais regras estatutárias e administrativas da associação.",
      "E, para que produza seus efeitos, o presente termo é emitido e registrado no sistema oficial da ATRETU.",
    ]);
    return {
      body,
      documentTitle: definition.title,
      documentType: OfficialDocumentType.TERMINATION_TERM,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signatureLabel: `${student.person.addressCity || "Terra Rica"}, ${this.formatDate(issuedAt)}`,
      signatureName: primarySigner.name,
      signatureTitle: primarySigner.label,
      signers,
      subject: {
        id: student.id,
        name: studentName,
        scope: "STUDENT",
      },
      student: {
        id: student.id,
        address: this.formatAddress(student.person),
        city: student.person.addressCity || "Terra Rica",
        name: studentName,
        cpf: this.formatCpf(student.person.cpf),
        rg: this.formatRg(student.person.rg),
        status: student.status,
      },
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      term: {
        dueDate: term.dueDate.toISOString(),
        notificationDate: term.notificationDate.toISOString(),
        notes: term.notes ?? null,
        reason: term.reason,
        regularizationDeadlineDays: term.regularizationDeadlineDays,
        regularizationLimit: regularizationLimit.toISOString(),
      },
      version: definition.version,
    };
  }

  private async buildInstitutionalSnapshot(
    documentType: OfficialDocumentType,
    issuedAt: Date,
    protocol: string,
    payload?: InstitutionalOfficialDocumentIssuePayload,
  ): Promise<OfficialDocumentSnapshot> {
    const definition = getOfficialDocumentDefinition(documentType);
    const signers = await this.resolveSigners(definition.signers, null, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const approvalDate =
      payload?.approvalDate?.slice(0, 10) ?? INTERNAL_REGULATION_APPROVAL_DATE;
    const approvalDateValue = this.parseDateOnly(
      approvalDate,
      "Data de aprovacao invalida",
    );
    return {
      approvalDate,
      body: internalRegulationBody(),
      documentTitle: INTERNAL_REGULATION_DOCUMENT_TITLE,
      documentType,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signatureLabel:
        approvalDate === INTERNAL_REGULATION_APPROVAL_DATE
          ? INTERNAL_REGULATION_APPROVAL_TEXT
          : `Terra Rica, ${this.formatDate(approvalDateValue)}`,
      signatureName: primarySigner.name,
      signatureTitle: primarySigner.label,
      signers,
      notes: payload?.notes || null,
      subject: {
        id: null,
        name: "ATRETU",
        scope: "INSTITUTIONAL",
      },
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      version: definition.version,
    };
  }

  private toPdfInput(
    snapshot: OfficialDocumentSnapshot,
    emittedBy: string,
  ): OfficialDocumentPdfInput {
    return {
      body: snapshot.body,
      documentTitle: snapshot.documentTitle,
      emittedAt: new Date(snapshot.emittedAt),
      emittedBy,
      footerNote: snapshot.footerNote,
      layout:
        snapshot.documentType === OfficialDocumentType.INTERNAL_REGULATION
          ? "compact"
          : "standard",
      protocol: snapshot.protocol,
      qrPayload: snapshot.qrPayload,
      signatureLabel: snapshot.signatureLabel,
      signatureName: snapshot.signatureName,
      signatureTitle: snapshot.signatureTitle,
      subjectLabel:
        snapshot.subject.scope === "INSTITUTIONAL" ? "Documento" : "Academico",
      subjectName: snapshot.subject.name,
      studentName: snapshot.subject.name,
      version: snapshot.version,
    };
  }

  private toIssueResponse(
    issue: OfficialDocumentIssue & {
      issuedBy?: { id: string; name: string; email: string } | null;
    },
  ) {
    return {
      id: issue.id,
      studentId: issue.studentId,
      type: issue.documentType,
      status: issue.status,
      templateKey: issue.templateKey,
      templateVersion: issue.templateVersion,
      version: issue.version,
      protocol: issue.protocol,
      fileName: issue.fileName,
      sizeBytes: issue.sizeBytes,
      checksumSha256: issue.checksumSha256,
      issuedAt: issue.issuedAt.toISOString(),
      issuedBy: issue.issuedBy
        ? {
            id: issue.issuedBy.id,
            name: issue.issuedBy.name,
            email: issue.issuedBy.email,
          }
        : null,
      sourceIssueId: issue.sourceIssueId,
      notes: issue.notes,
      approvalDate: this.approvalDate(issue),
      signerDetails: this.signerDetails(issue),
      termDetails: this.termDetails(issue),
    };
  }

  private approvalDate(issue: OfficialDocumentIssue) {
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    return typeof snapshot.approvalDate === "string"
      ? snapshot.approvalDate
      : null;
  }

  private signerDetails(issue: OfficialDocumentIssue) {
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const signers = Array.isArray(snapshot.signers) ? snapshot.signers : [];
    if (signers.length === 0 && typeof snapshot.signatureName === "string") {
      return [
        {
          boardId: null,
          boardMemberId: null,
          boardPeriodEnd: null,
          boardPeriodStart: null,
          endedAt: null,
          label:
            typeof snapshot.signatureTitle === "string"
              ? snapshot.signatureTitle
              : null,
          name: snapshot.signatureName,
          personId: null,
          resolvedAt: null,
          role:
            issue.documentType === OfficialDocumentType.TERMINATION_TERM
              ? BoardMemberRole.PRESIDENT
              : "ACADEMICO",
          roleLabel:
            issue.documentType === OfficialDocumentType.TERMINATION_TERM
              ? this.boardRoleLabel(BoardMemberRole.PRESIDENT)
              : "Associado",
          signerName: snapshot.signatureName,
          signerPersonId: null,
          signerRole:
            issue.documentType === OfficialDocumentType.TERMINATION_TERM
              ? BoardMemberRole.PRESIDENT
              : "ACADEMICO",
          signerRoleLabel:
            issue.documentType === OfficialDocumentType.TERMINATION_TERM
              ? this.boardRoleLabel(BoardMemberRole.PRESIDENT)
              : "Associado",
          signerSource:
            issue.documentType === OfficialDocumentType.TERMINATION_TERM
              ? "BOARD_ROLE"
              : "STUDENT",
          signerStudentId: null,
          source:
            issue.documentType === OfficialDocumentType.TERMINATION_TERM
              ? "BOARD_ROLE"
              : "STUDENT",
          startedAt: null,
          studentId: null,
        },
      ];
    }
    return signers.map((item) => {
      const signer = item as Prisma.JsonObject;
      return {
        boardId: typeof signer.boardId === "string" ? signer.boardId : null,
        boardMemberId:
          typeof signer.boardMemberId === "string" ? signer.boardMemberId : null,
        boardPeriodEnd:
          typeof signer.boardPeriodEnd === "string" ? signer.boardPeriodEnd : null,
        boardPeriodStart:
          typeof signer.boardPeriodStart === "string" ? signer.boardPeriodStart : null,
        endedAt: typeof signer.endedAt === "string" ? signer.endedAt : null,
        label: typeof signer.label === "string" ? signer.label : null,
        name: typeof signer.name === "string" ? signer.name : null,
        personId: typeof signer.personId === "string" ? signer.personId : null,
        resolvedAt: typeof signer.resolvedAt === "string" ? signer.resolvedAt : null,
        role: typeof signer.role === "string" ? signer.role : null,
        roleLabel: typeof signer.roleLabel === "string" ? signer.roleLabel : null,
        signerName:
          typeof signer.signerName === "string"
            ? signer.signerName
            : typeof signer.name === "string"
              ? signer.name
              : null,
        signerPersonId:
          typeof signer.signerPersonId === "string" ? signer.signerPersonId : null,
        signerRole:
          typeof signer.signerRole === "string"
            ? signer.signerRole
            : typeof signer.role === "string"
              ? signer.role
              : null,
        signerRoleLabel:
          typeof signer.signerRoleLabel === "string"
            ? signer.signerRoleLabel
            : typeof signer.roleLabel === "string"
              ? signer.roleLabel
              : null,
        signerSource:
          typeof signer.signerSource === "string"
            ? signer.signerSource
            : typeof signer.source === "string"
              ? signer.source
              : null,
        signerStudentId:
          typeof signer.signerStudentId === "string" ? signer.signerStudentId : null,
        source: typeof signer.source === "string" ? signer.source : null,
        startedAt: typeof signer.startedAt === "string" ? signer.startedAt : null,
        studentId: typeof signer.studentId === "string" ? signer.studentId : null,
      };
    });
  }

  private termDetails(issue: OfficialDocumentIssue) {
    if (issue.documentType !== OfficialDocumentType.TERMINATION_TERM) {
      return null;
    }
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const term = snapshot.term as Prisma.JsonObject | undefined;
    if (!term) {
      return null;
    }
    return {
      dueDate: typeof term.dueDate === "string" ? term.dueDate : null,
      notificationDate:
        typeof term.notificationDate === "string" ? term.notificationDate : null,
      reason: typeof term.reason === "string" ? term.reason : null,
      regularizationDeadlineDays:
        typeof term.regularizationDeadlineDays === "number"
          ? term.regularizationDeadlineDays
          : null,
      regularizationLimit:
        typeof term.regularizationLimit === "string"
          ? term.regularizationLimit
          : null,
    };
  }

  private buildProtocol(now: Date) {
    return `ATRETU-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private fileName(
    student: StudentForOfficialDocument,
    documentType: OfficialDocumentType,
    protocol: string,
  ) {
    const token = student.person.fullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const prefix =
      documentType === OfficialDocumentType.TERMINATION_LETTER
        ? "carta-desligamento"
        : documentType === OfficialDocumentType.TERMINATION_TERM
          ? "termo-desligamento"
        : "documento-oficial";
    return `${prefix}_${token || "academico"}_${protocol.toLowerCase()}.pdf`;
  }

  private institutionalFileName(
    documentType: OfficialDocumentType,
    protocol: string,
  ) {
    const prefix =
      documentType === OfficialDocumentType.INTERNAL_REGULATION
        ? "regimento-interno"
        : "documento-institucional";
    return `${prefix}_${protocol.toLowerCase()}.pdf`;
  }

  private issueNotes(snapshot: OfficialDocumentSnapshot) {
    if (snapshot.term?.notes) {
      return snapshot.term.notes;
    }
    if (snapshot.documentType === OfficialDocumentType.INTERNAL_REGULATION) {
      return [
        `aprovacao=${snapshot.approvalDate ?? ""}`,
        snapshot.notes ? `observacoes=${snapshot.notes}` : null,
      ]
        .filter(Boolean)
        .join("; ");
    }
    if (snapshot.documentType === OfficialDocumentType.TERMINATION_TERM) {
      return [
        `motivo=${snapshot.term?.reason ?? ""}`,
        `vencimento=${snapshot.term?.dueDate ?? ""}`,
        `notificacao=${snapshot.term?.notificationDate ?? ""}`,
        `prazo=${snapshot.term?.regularizationDeadlineDays ?? ""}`,
      ].join("; ");
    }
    return null;
  }

  private reissuePayload(issue: OfficialDocumentIssue): OfficialDocumentIssuePayload {
    if (issue.documentType !== OfficialDocumentType.TERMINATION_TERM) {
      return undefined;
    }
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const term = snapshot.term as Prisma.JsonObject | undefined;
    if (!term) {
      return undefined;
    }
    return {
      dueDate: String(term.dueDate ?? ""),
      notificationDate: String(term.notificationDate ?? ""),
      notes: typeof term.notes === "string" ? term.notes : undefined,
      reason: typeof term.reason === "string" ? term.reason : undefined,
      regularizationDeadlineDays:
        typeof term.regularizationDeadlineDays === "number"
          ? term.regularizationDeadlineDays
          : undefined,
    };
  }

  private resolveTerminationTermPayload(
    payload?: OfficialDocumentIssuePayload,
  ): TerminationTermPayload {
    if (!payload?.dueDate) {
      throw new BadRequestException("Informe a data de vencimento.");
    }
    if (!payload.notificationDate) {
      throw new BadRequestException("Informe a data da notificacao.");
    }
    const dueDate = this.parseDateOnly(payload.dueDate, "Data do vencimento invalida");
    const notificationDate = this.parseDateOnly(
      payload.notificationDate,
      "Data da notificacao invalida",
    );
    if (notificationDate.getTime() < dueDate.getTime()) {
      throw new BadRequestException(
        "Data da notificacao nao pode ser anterior ao vencimento",
      );
    }
    return {
      dueDate,
      notificationDate,
      notes: payload.notes || undefined,
      reason: payload.reason || "Inadimplência",
      regularizationDeadlineDays: payload.regularizationDeadlineDays ?? 10,
    };
  }

  private parseDateOnly(value: string, errorMessage: string) {
    const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(errorMessage);
    }
    return date;
  }

  private addDays(value: Date, days: number) {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private reissueSnapshot(
    issue: OfficialDocumentIssue,
    issuedAt: Date,
    protocol: string,
  ): OfficialDocumentSnapshot {
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const previous = snapshot as Partial<OfficialDocumentSnapshot>;
    const legacySigner = previous.signers?.length
      ? previous.signers
      : [
          {
            boardId: null,
            boardMemberId: null,
            boardPeriodEnd: null,
            boardPeriodStart: null,
            endedAt: null,
            label: previous.signatureTitle ?? "Associado",
            name: previous.signatureName ?? "Signatario nao identificado",
            personId: null,
            resolvedAt: issuedAt.toISOString(),
            role:
              issue.documentType === OfficialDocumentType.TERMINATION_TERM
                ? BoardMemberRole.PRESIDENT
                : "ACADEMICO",
            roleLabel:
              issue.documentType === OfficialDocumentType.TERMINATION_TERM
                ? this.boardRoleLabel(BoardMemberRole.PRESIDENT)
                : "Associado",
            signerName: previous.signatureName ?? "Signatario nao identificado",
            signerPersonId: null,
            signerRole:
              issue.documentType === OfficialDocumentType.TERMINATION_TERM
                ? BoardMemberRole.PRESIDENT
                : "ACADEMICO",
            signerRoleLabel:
              issue.documentType === OfficialDocumentType.TERMINATION_TERM
                ? this.boardRoleLabel(BoardMemberRole.PRESIDENT)
                : "Associado",
            signerSource:
              issue.documentType === OfficialDocumentType.TERMINATION_TERM
                ? "BOARD_ROLE"
                : "STUDENT",
            signerStudentId: null,
            source:
              issue.documentType === OfficialDocumentType.TERMINATION_TERM
                ? "BOARD_ROLE"
                : "STUDENT",
            startedAt: null,
            studentId: null,
          } satisfies OfficialDocumentSignerSnapshot,
        ];
    return {
      ...(previous as OfficialDocumentSnapshot),
      body: this.normalizeSnapshotBody(previous.body),
      emittedAt: issuedAt.toISOString(),
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signers: legacySigner,
    };
  }

  private async resolveSigners(
    definitions: readonly OfficialDocumentSignerDefinition[],
    student: StudentForOfficialDocument | null,
    issuedAt: Date,
  ): Promise<OfficialDocumentSignerSnapshot[]> {
    const signers: OfficialDocumentSignerSnapshot[] = [];
    for (const definition of definitions) {
      if (definition.source === "STUDENT") {
        if (!student) {
          throw new BadRequestException("Documento exige academico vinculado.");
        }
        const roleLabel = "Associado";
        signers.push({
          boardId: null,
          boardMemberId: null,
          boardPeriodEnd: null,
          boardPeriodStart: null,
          endedAt: null,
          label: definition.label,
          name: student.person.fullName,
          personId: student.personId,
          resolvedAt: issuedAt.toISOString(),
          role: definition.role,
          roleLabel,
          signerName: student.person.fullName,
          signerPersonId: student.personId,
          signerRole: definition.role,
          signerRoleLabel: roleLabel,
          signerSource: definition.source,
          signerStudentId: student.id,
          source: definition.source,
          startedAt: null,
          studentId: student.id,
        });
        continue;
      }
      if (definition.source === "BOARD_ROLE") {
        signers.push(await this.resolveBoardRoleSigner(definition, issuedAt));
        continue;
      }
      if (definition.required) {
        throw new BadRequestException("Signatario obrigatorio nao configurado.");
      }
    }
    return signers;
  }

  private async resolveBoardRoleSigner(
    definition: OfficialDocumentSignerDefinition,
    issuedAt: Date,
  ): Promise<OfficialDocumentSignerSnapshot> {
    const validMembers = await this.prisma.boardMembership.findMany({
      where: {
        status: BoardMembershipStatus.ACTIVE,
        role: { not: null },
        startedAt: { lte: issuedAt },
        OR: [{ endedAt: null }, { endedAt: { gte: issuedAt } }],
      },
      include: { student: { include: { person: true } } },
      orderBy: [{ role: "asc" }, { startedAt: "asc" }],
    });
    if (validMembers.length === 0) {
      throw new BadRequestException(
        "Nao existe uma diretoria vigente para a data de emissao.",
      );
    }

    const role = definition.role as BoardMemberRole;
    const membersForRole = validMembers.filter((member) => member.role === role);
    if (membersForRole.length === 0) {
      throw new BadRequestException(
        `A diretoria vigente nao possui ${this.boardRoleLabel(role).toLowerCase()} configurado.`,
      );
    }
    if (membersForRole.length > 1) {
      throw new BadRequestException(
        `Ha mais de um ${this.boardRoleLabel(role).toLowerCase()} configurado na diretoria vigente. Revise o cadastro.`,
      );
    }

    const member = membersForRole[0];
    if (!member) {
      throw new BadRequestException("Signatario obrigatorio nao configurado.");
    }
    const roleLabel = this.boardRoleLabel(role);
    return {
      boardId: null,
      boardMemberId: member.id,
      boardPeriodEnd: member.endedAt?.toISOString() ?? null,
      boardPeriodStart: member.startedAt.toISOString(),
      endedAt: member.endedAt?.toISOString() ?? null,
      label: definition.label,
      name: member.student.person.fullName,
      personId: member.student.personId,
      resolvedAt: issuedAt.toISOString(),
      role,
      roleLabel,
      signerName: member.student.person.fullName,
      signerPersonId: member.student.personId,
      signerRole: role,
      signerRoleLabel: roleLabel,
      signerSource: definition.source,
      signerStudentId: member.studentId,
      source: definition.source,
      startedAt: member.startedAt.toISOString(),
      studentId: member.studentId,
    };
  }

  private boardRoleLabel(role: BoardMemberRole) {
    const labels: Record<BoardMemberRole, string> = {
      MEMBER: "Membro",
      PRESIDENT: "Presidente",
      SECRETARY: "Secretario",
      TREASURER: "Tesoureiro",
      VICE_PRESIDENT: "Vice-presidente",
    };
    return labels[role];
  }

  private primarySigner(signers: OfficialDocumentSignerSnapshot[]) {
    const signer = signers[0];
    if (!signer) {
      throw new BadRequestException("Signatario obrigatorio nao configurado.");
    }
    return signer;
  }

  private paragraphs(texts: string[]): OfficialDocumentPdfBlock[] {
    return texts.map((text) => ({ text, type: "paragraph" }));
  }

  private normalizeSnapshotBody(
    body: Partial<OfficialDocumentSnapshot>["body"] | undefined,
  ): OfficialDocumentPdfBlock[] {
    if (!Array.isArray(body)) {
      return [];
    }
    return body.map((item) =>
      typeof item === "string" ? { text: item, type: "paragraph" } : item,
    );
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }

  private formatAddress(person: StudentForOfficialDocument["person"]) {
    return [
      person.addressStreet,
      person.addressNumber,
      person.addressComplement,
      person.addressNeighborhood,
      person.addressCity,
      person.addressState,
      person.addressZipCode ? `CEP ${person.addressZipCode}` : null,
    ]
      .filter(Boolean)
      .join(", ");
  }

  private formatCpf(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11) {
      return value;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  private formatRg(value: string | null) {
    return value?.trim() || "nao informado";
  }
}
