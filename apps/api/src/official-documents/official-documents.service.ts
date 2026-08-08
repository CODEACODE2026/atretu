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
  ANNUAL_CLEARANCE_DECLARATION_DOCUMENT_TITLE,
  annualClearanceDeclarationBody,
} from "./annual-clearance-declaration.content.js";
import {
  ADHESION_TERM_DOCUMENT_TITLE,
  adhesionTermBody,
} from "./adhesion-term.content.js";
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
  TRANSPORT_REGULATION_DOCUMENT_TITLE,
  transportRegulationBody,
} from "./transport-regulation.content.js";
import {
  TRANSPORT_REFUND_REQUEST_DOCUMENT_TITLE,
  transportRefundRequestBody,
  type TransportRefundPaymentMethod,
} from "./transport-refund-request.content.js";
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

type AdhesionTermPayload = {
  firstInstallmentDate: Date;
  installmentAmountCents: number;
  installmentCount: number;
  notes?: string;
};

type TransportRefundRequestPayload = {
  bankAccount?: string;
  bankAccountType?: string;
  bankAgency?: string;
  bankName?: string;
  notes?: string;
  paymentMethod: TransportRefundPaymentMethod;
  pixKey?: string;
  reason: string;
  refundAmountCents: number;
};

type AnnualClearanceDeclarationPayload = {
  finalClearanceDate: Date;
  notes?: string;
  totalAmountCents: number;
  year: number;
};

type OfficialDocumentIssuePayload = IssueOfficialDocumentDto | undefined;
type InstitutionalOfficialDocumentIssuePayload =
  | IssueInstitutionalOfficialDocumentDto
  | undefined;

type OfficialDocumentSnapshot = {
  adhesion?: {
    firstInstallmentDate: string;
    installmentAmountCents: number;
    installmentCount: number;
    installmentDueDay: number;
    installments: Array<{
      amountCents: number;
      dueDate: string;
      label: string;
      number: number;
    }>;
    notes: string | null;
    templateKey: string;
    templateVersion: number;
    totalContractAmountCents: number;
  };
  approvalDate?: string;
  annualClearance?: {
    finalClearanceDate: string;
    issueDate: string;
    issuePlaceDateText: string;
    periodEnd: string;
    periodStart: string;
    studentName: string;
    cpf: string;
    templateKey: string;
    templateVersion: number;
    totalAmountCents: number;
    totalAmountWords: string;
    year: number;
  };
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
  guardian?: {
    cpf: string | null;
    fullName: string;
    rg: string | null;
  } | null;
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
  transportRegulation?: {
    approvalDate?: string;
    issueDate?: string;
    issuePlaceDateText?: string;
    templateKey: string;
    templateVersion: number;
  };
  transportRefund?: {
    bankAccount?: string | null;
    bankAccountType?: string | null;
    bankAgency?: string | null;
    bankName?: string | null;
    issueDate: string;
    issuePlaceDateText: string;
    notes: string | null;
    paymentMethod: TransportRefundPaymentMethod;
    pixKey?: string | null;
    reason: string;
    refundAmountCents: number;
    refundAmountWords: string;
    templateKey: string;
    templateVersion: number;
  };
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
              emittedByUserId: currentUser.id,
              signers: snapshot.signers.map((signer) => ({
                name: signer.name,
                role: signer.role,
                source: signer.source,
              })),
              boardId: snapshot.signers[0]?.boardId,
              boardMemberId: snapshot.signers[0]?.boardMemberId,
              adhesion: snapshot.adhesion
                ? {
                    firstInstallmentDate: snapshot.adhesion.firstInstallmentDate,
                    installmentAmountCents:
                      snapshot.adhesion.installmentAmountCents,
                    installmentCount: snapshot.adhesion.installmentCount,
                    installmentDueDay: snapshot.adhesion.installmentDueDay,
                    totalContractAmountCents:
                      snapshot.adhesion.totalContractAmountCents,
                  }
                : undefined,
              annualClearance: snapshot.annualClearance
                ? {
                    finalClearanceDate:
                      snapshot.annualClearance.finalClearanceDate,
                    templateKey: snapshot.annualClearance.templateKey,
                    templateVersion: snapshot.annualClearance.templateVersion,
                    totalAmountCents:
                      snapshot.annualClearance.totalAmountCents,
                    year: snapshot.annualClearance.year,
                  }
                : undefined,
              templateKey: definition.templateKey,
              templateVersion: definition.templateVersion,
              transportRegulation: snapshot.transportRegulation
                ? {
                    issueDate: snapshot.transportRegulation.issueDate,
                    issuePlaceDateText:
                      snapshot.transportRegulation.issuePlaceDateText,
                    templateKey: snapshot.transportRegulation.templateKey,
                    templateVersion: snapshot.transportRegulation.templateVersion,
                  }
                : undefined,
              transportRefund: snapshot.transportRefund
                ? {
                    refundAmountCents: snapshot.transportRefund.refundAmountCents,
                    paymentMethod: snapshot.transportRefund.paymentMethod,
                    templateKey: snapshot.transportRefund.templateKey,
                    templateVersion: snapshot.transportRefund.templateVersion,
                  }
                : undefined,
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
      guardian: true,
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
    if (documentType === OfficialDocumentType.ADHESION_TERM) {
      return this.buildAdhesionTermSnapshot(student, issuedAt, protocol, payload);
    }
    if (documentType === OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION) {
      return this.buildAnnualClearanceDeclarationSnapshot(
        student,
        issuedAt,
        protocol,
        payload,
      );
    }
    if (documentType === OfficialDocumentType.TRANSPORT_REGULATION) {
      return this.buildTransportRegulationSnapshot(student, issuedAt, protocol);
    }
    if (documentType === OfficialDocumentType.TRANSPORT_REFUND_REQUEST) {
      return this.buildTransportRefundRequestSnapshot(
        student,
        issuedAt,
        protocol,
        payload,
      );
    }
    return this.buildTerminationLetterSnapshot(student, documentType, issuedAt, protocol);
  }

  private async buildAnnualClearanceDeclarationSnapshot(
    student: StudentForOfficialDocument,
    issuedAt: Date,
    protocol: string,
    payload?: OfficialDocumentIssuePayload,
  ): Promise<OfficialDocumentSnapshot> {
    const definition = getOfficialDocumentDefinition(
      OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION,
    );
    const annualClearance = this.resolveAnnualClearanceDeclarationPayload(payload);
    const signers = await this.resolveSigners(definition.signers, student, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const issueDate = this.formatDateOnlyInSaoPaulo(issuedAt);
    const issuePlaceDateText = `Terra Rica - PR, ${this.formatLongDateInSaoPaulo(issuedAt)}.`;
    const periodStart = `01 de janeiro de ${annualClearance.year}`;
    const periodEnd = `31 de dezembro de ${annualClearance.year}`;
    const finalClearanceDate = this.formatDate(annualClearance.finalClearanceDate);
    const totalAmount = this.formatCurrency(annualClearance.totalAmountCents);
    const totalAmountWords = this.moneyWords(annualClearance.totalAmountCents);
    const studentSnapshot = {
      id: student.id,
      address: this.formatAddress(student.person),
      city: student.person.addressCity || "Terra Rica",
      name: student.person.fullName,
      cpf: this.formatCpf(student.person.cpf),
      rg: this.formatRg(student.person.rg),
      status: student.status,
    };
    const annualClearanceSnapshot = {
      finalClearanceDate: annualClearance.finalClearanceDate.toISOString(),
      issueDate,
      issuePlaceDateText,
      periodEnd,
      periodStart,
      studentName: studentSnapshot.name,
      cpf: studentSnapshot.cpf,
      templateKey: definition.templateKey,
      templateVersion: definition.templateVersion,
      totalAmountCents: annualClearance.totalAmountCents,
      totalAmountWords,
      year: annualClearance.year,
    };
    const body = annualClearanceDeclarationBody({
      finalClearanceDate,
      issuePlaceDateText,
      periodEnd,
      periodStart,
      presidentName: primarySigner.name,
      student: {
        cpf: studentSnapshot.cpf,
        fullName: studentSnapshot.name,
      },
      totalAmount,
      totalAmountWords,
      year: annualClearance.year,
    });
    return {
      annualClearance: annualClearanceSnapshot,
      body,
      documentTitle: ANNUAL_CLEARANCE_DECLARATION_DOCUMENT_TITLE,
      documentType: OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      notes: annualClearance.notes ?? null,
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signatureLabel: "",
      signatureName: primarySigner.name,
      signatureTitle: primarySigner.label,
      signers,
      subject: {
        id: student.id,
        name: student.person.fullName,
        scope: "STUDENT",
      },
      student: studentSnapshot,
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      version: definition.version,
    };
  }

  private async buildTransportRegulationSnapshot(
    student: StudentForOfficialDocument,
    issuedAt: Date,
    protocol: string,
  ): Promise<OfficialDocumentSnapshot> {
    const definition = getOfficialDocumentDefinition(
      OfficialDocumentType.TRANSPORT_REGULATION,
    );
    const signers = await this.resolveSigners(definition.signers, student, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const issueDate = this.formatDateOnlyInSaoPaulo(issuedAt);
    const issuePlaceDateText = `Terra Rica, ${this.formatLongDateInSaoPaulo(issuedAt)}`;
    const studentSnapshot = {
      id: student.id,
      address: this.formatAddress(student.person),
      city: student.person.addressCity || "Terra Rica",
      name: student.person.fullName,
      cpf: this.formatCpf(student.person.cpf),
      rg: this.formatRg(student.person.rg),
      status: student.status,
    };
    const guardian = student.guardian
      ? {
          cpf: student.guardian.cpf ? this.formatCpf(student.guardian.cpf) : null,
          fullName: student.guardian.fullName,
          rg: this.formatRg(student.guardian.rg),
        }
      : null;
    const body = transportRegulationBody({
      issuePlaceDateText,
      guardian,
      president: {
        label: primarySigner.label,
        name: primarySigner.name,
      },
      student: {
        cpf: studentSnapshot.cpf,
        fullName: studentSnapshot.name,
        rg: studentSnapshot.rg,
      },
    });
    return {
      body,
      documentTitle: TRANSPORT_REGULATION_DOCUMENT_TITLE,
      documentType: OfficialDocumentType.TRANSPORT_REGULATION,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      guardian,
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signatureLabel: `${studentSnapshot.city}, ${this.formatDate(issuedAt)}`,
      signatureName: primarySigner.name,
      signatureTitle: primarySigner.label,
      signers,
      student: studentSnapshot,
      subject: {
        id: student.id,
        name: student.person.fullName,
        scope: "STUDENT",
      },
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      transportRegulation: {
        issueDate,
        issuePlaceDateText,
        templateKey: definition.templateKey,
        templateVersion: definition.templateVersion,
      },
      version: definition.version,
    };
  }

  private async buildTransportRefundRequestSnapshot(
    student: StudentForOfficialDocument,
    issuedAt: Date,
    protocol: string,
    payload?: OfficialDocumentIssuePayload,
  ): Promise<OfficialDocumentSnapshot> {
    const definition = getOfficialDocumentDefinition(
      OfficialDocumentType.TRANSPORT_REFUND_REQUEST,
    );
    const refund = this.resolveTransportRefundRequestPayload(payload);
    const signers = await this.resolveSigners(definition.signers, student, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const enrollment = student.enrollments[0];
    const issueDate = this.formatDateOnlyInSaoPaulo(issuedAt);
    const issuePlaceDateText = `Terra Rica, ${this.formatLongDateInSaoPaulo(issuedAt)}`;
    const refundAmount = this.formatCurrency(refund.refundAmountCents);
    const refundAmountWords = this.moneyWords(refund.refundAmountCents);
    const paymentMethodText =
      refund.paymentMethod === "PIX" ? "PIX" : "Conta bancária";
    const studentSnapshot = {
      id: student.id,
      address: this.formatAddress(student.person),
      city: student.person.addressCity || "Terra Rica",
      name: student.person.fullName,
      cpf: this.formatCpf(student.person.cpf),
      rg: this.formatRg(student.person.rg),
      status: student.status,
    };
    const refundSnapshot = {
      bankAccount: refund.paymentMethod === "BANK_ACCOUNT" ? refund.bankAccount ?? null : null,
      bankAccountType:
        refund.paymentMethod === "BANK_ACCOUNT" ? refund.bankAccountType ?? null : null,
      bankAgency: refund.paymentMethod === "BANK_ACCOUNT" ? refund.bankAgency ?? null : null,
      bankName: refund.paymentMethod === "BANK_ACCOUNT" ? refund.bankName ?? null : null,
      issueDate,
      issuePlaceDateText,
      notes: refund.notes ?? null,
      paymentMethod: refund.paymentMethod,
      pixKey: refund.paymentMethod === "PIX" ? refund.pixKey ?? null : null,
      reason: refund.reason,
      refundAmountCents: refund.refundAmountCents,
      refundAmountWords,
      templateKey: definition.templateKey,
      templateVersion: definition.templateVersion,
    };
    const body = transportRefundRequestBody({
      issuePlaceDateText,
      payment: {
        bankAccount:
          refund.paymentMethod === "BANK_ACCOUNT"
            ? {
                account: refund.bankAccount ?? "",
                accountType: refund.bankAccountType ?? null,
                agency: refund.bankAgency ?? "",
                bankName: refund.bankName ?? "",
              }
            : null,
        method: refund.paymentMethod,
        methodText: paymentMethodText,
        pixKey: refund.paymentMethod === "PIX" ? refund.pixKey : null,
      },
      reason: refund.reason,
      refundAmount,
      refundAmountWords,
      student: {
        academicYear: enrollment?.grade
          ? `${enrollment.grade}°Ano`
          : enrollment?.academicYear.year
            ? `${enrollment.academicYear.year}`
            : "nao informado",
        address: studentSnapshot.address,
        cpf: studentSnapshot.cpf,
        email: student.person.email || "nao informado",
        fullName: studentSnapshot.name,
        institution: enrollment?.institution.name || "nao informado",
        phone: student.person.phone || "nao informado",
      },
    });
    return {
      body,
      documentTitle: TRANSPORT_REFUND_REQUEST_DOCUMENT_TITLE,
      documentType: OfficialDocumentType.TRANSPORT_REFUND_REQUEST,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      signatureLabel: "",
      signatureName: primarySigner.name,
      signatureTitle: primarySigner.label,
      signers,
      subject: {
        id: student.id,
        name: student.person.fullName,
        scope: "STUDENT",
      },
      student: studentSnapshot,
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      transportRefund: refundSnapshot,
      version: definition.version,
    };
  }

  private async buildAdhesionTermSnapshot(
    student: StudentForOfficialDocument,
    issuedAt: Date,
    protocol: string,
    payload?: OfficialDocumentIssuePayload,
  ): Promise<OfficialDocumentSnapshot> {
    const definition = getOfficialDocumentDefinition(OfficialDocumentType.ADHESION_TERM);
    const term = this.resolveAdhesionTermPayload(payload);
    const signers = await this.resolveSigners(definition.signers, student, issuedAt);
    const primarySigner = this.primarySigner(signers);
    const enrollment = student.enrollments[0];
    const installments = Array.from({ length: term.installmentCount }, (_, index) => {
      const dueDate = this.addMonthsClamped(term.firstInstallmentDate, index);
      return {
        amountCents: term.installmentAmountCents,
        dueDate: dueDate.toISOString(),
        label: `${index + 1}ª Mensalidade`,
        number: index + 1,
      };
    });
    const totalContractAmountCents =
      term.installmentAmountCents * term.installmentCount;
    const body = adhesionTermBody({
      installmentAmount: this.formatCurrency(term.installmentAmountCents),
      installmentAmountWords: this.moneyWords(term.installmentAmountCents),
      installmentCount: term.installmentCount,
      installmentCountWords: this.numberWords(term.installmentCount),
      installmentDueDay: term.firstInstallmentDate.getUTCDate(),
      installments: installments.map((installment) => ({
        amountText: this.formatCurrency(installment.amountCents),
        dateText: this.formatDate(new Date(installment.dueDate)),
        label: installment.label,
      })),
      totalContractAmount: this.formatCurrency(totalContractAmountCents),
      student: {
        address: this.formatAddress(student.person),
        birthDate: this.formatDate(student.person.birthDate),
        cpf: this.formatCpf(student.person.cpf),
        course: enrollment?.course || "nao informado",
        email: student.person.email || "nao informado",
        fullName: student.person.fullName,
        grade: enrollment?.grade || "nao informado",
        institution: enrollment?.institution.name || "nao informado",
        phone: student.person.phone || "nao informado",
        rg: this.formatRg(student.person.rg),
        shift: enrollment?.shift.name || "nao informado",
      },
    });
    return {
      adhesion: {
        firstInstallmentDate: term.firstInstallmentDate.toISOString(),
        installmentAmountCents: term.installmentAmountCents,
        installmentCount: term.installmentCount,
        installmentDueDay: term.firstInstallmentDate.getUTCDate(),
        installments,
        notes: term.notes ?? null,
        templateKey: definition.templateKey,
        templateVersion: definition.templateVersion,
        totalContractAmountCents,
      },
      body,
      documentTitle: ADHESION_TERM_DOCUMENT_TITLE,
      documentType: OfficialDocumentType.ADHESION_TERM,
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
        name: student.person.fullName,
        scope: "STUDENT",
      },
      student: {
        id: student.id,
        address: this.formatAddress(student.person),
        city: student.person.addressCity || "Terra Rica",
        name: student.person.fullName,
        cpf: this.formatCpf(student.person.cpf),
        rg: this.formatRg(student.person.rg),
        status: student.status,
      },
      guardian: student.guardian
        ? {
            cpf: student.guardian.cpf ? this.formatCpf(student.guardian.cpf) : null,
            fullName: student.guardian.fullName,
            rg: this.formatRg(student.guardian.rg),
          }
        : null,
      template: {
        key: definition.templateKey,
        version: definition.templateVersion,
      },
      version: definition.version,
    };
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
        snapshot.documentType === OfficialDocumentType.INTERNAL_REGULATION ||
        snapshot.documentType === OfficialDocumentType.ADHESION_TERM ||
        snapshot.documentType ===
          OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION ||
        snapshot.documentType === OfficialDocumentType.TRANSPORT_REGULATION ||
        snapshot.documentType === OfficialDocumentType.TRANSPORT_REFUND_REQUEST
          ? "compact"
          : "standard",
      protocol: snapshot.protocol,
      qrPayload: snapshot.qrPayload,
      signaturePlacement:
        snapshot.documentType === OfficialDocumentType.TRANSPORT_REGULATION
          ? "body"
          : "end",
      signatureLabel: snapshot.signatureLabel,
      signatureName: snapshot.signatureName,
      signatures: this.pdfSignatures(snapshot),
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
      adhesionDetails: this.adhesionDetails(issue),
      annualClearanceDetails: this.annualClearanceDetails(issue),
      approvalDate: this.approvalDate(issue),
      refundDetails: this.refundDetails(issue),
      signerDetails: this.signerDetails(issue),
      termDetails: this.termDetails(issue),
    };
  }

  private annualClearanceDetails(issue: OfficialDocumentIssue) {
    if (
      issue.documentType !== OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION
    ) {
      return null;
    }
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const annualClearance = snapshot.annualClearance as
      | Prisma.JsonObject
      | undefined;
    if (!annualClearance) {
      return null;
    }
    return {
      finalClearanceDate:
        typeof annualClearance.finalClearanceDate === "string"
          ? annualClearance.finalClearanceDate
          : null,
      issueDate:
        typeof annualClearance.issueDate === "string"
          ? annualClearance.issueDate
          : null,
      issuePlaceDateText:
        typeof annualClearance.issuePlaceDateText === "string"
          ? annualClearance.issuePlaceDateText
          : null,
      periodEnd:
        typeof annualClearance.periodEnd === "string"
          ? annualClearance.periodEnd
          : null,
      periodStart:
        typeof annualClearance.periodStart === "string"
          ? annualClearance.periodStart
          : null,
      totalAmountCents:
        typeof annualClearance.totalAmountCents === "number"
          ? annualClearance.totalAmountCents
          : null,
      totalAmountWords:
        typeof annualClearance.totalAmountWords === "string"
          ? annualClearance.totalAmountWords
          : null,
      year:
        typeof annualClearance.year === "number" ? annualClearance.year : null,
    };
  }

  private adhesionDetails(issue: OfficialDocumentIssue) {
    if (issue.documentType !== OfficialDocumentType.ADHESION_TERM) {
      return null;
    }
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const adhesion = snapshot.adhesion as Prisma.JsonObject | undefined;
    const installments = Array.isArray(adhesion?.installments)
      ? adhesion.installments
      : [];
    return {
      firstInstallmentDate:
        typeof adhesion?.firstInstallmentDate === "string"
          ? adhesion.firstInstallmentDate
          : null,
      installmentCount:
        typeof adhesion?.installmentCount === "number"
          ? adhesion.installmentCount
          : null,
      installmentAmountCents:
        typeof adhesion?.installmentAmountCents === "number"
          ? adhesion.installmentAmountCents
          : null,
      installmentDueDay:
        typeof adhesion?.installmentDueDay === "number"
          ? adhesion.installmentDueDay
          : null,
      installments: installments.map((item) => {
        const installment = item as Prisma.JsonObject;
        return {
          amountCents:
            typeof installment.amountCents === "number"
              ? installment.amountCents
              : null,
          dueDate:
            typeof installment.dueDate === "string" ? installment.dueDate : null,
          label: typeof installment.label === "string" ? installment.label : null,
          number:
            typeof installment.number === "number" ? installment.number : null,
        };
      }),
      totalContractAmountCents:
        typeof adhesion?.totalContractAmountCents === "number"
          ? adhesion.totalContractAmountCents
          : null,
    };
  }

  private approvalDate(issue: OfficialDocumentIssue) {
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    return typeof snapshot.approvalDate === "string"
      ? snapshot.approvalDate
      : null;
  }

  private refundDetails(issue: OfficialDocumentIssue) {
    if (issue.documentType !== OfficialDocumentType.TRANSPORT_REFUND_REQUEST) {
      return null;
    }
    const snapshot = issue.contentSnapshot as Prisma.JsonObject;
    const refund = snapshot.transportRefund as Prisma.JsonObject | undefined;
    if (!refund) {
      return null;
    }
    return {
      issueDate: typeof refund.issueDate === "string" ? refund.issueDate : null,
      issuePlaceDateText:
        typeof refund.issuePlaceDateText === "string"
          ? refund.issuePlaceDateText
          : null,
      paymentMethod:
        typeof refund.paymentMethod === "string" ? refund.paymentMethod : null,
      reason: typeof refund.reason === "string" ? refund.reason : null,
      refundAmountCents:
        typeof refund.refundAmountCents === "number"
          ? refund.refundAmountCents
          : null,
      refundAmountWords:
        typeof refund.refundAmountWords === "string"
          ? refund.refundAmountWords
          : null,
    };
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
            : documentType === OfficialDocumentType.ADHESION_TERM
              ? "termo-adesao"
              : documentType ===
                  OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION
                ? "declaracao-quitacao-anual"
                : documentType === OfficialDocumentType.TRANSPORT_REGULATION
                  ? "regimento-transporte"
                  : documentType === OfficialDocumentType.TRANSPORT_REFUND_REQUEST
                    ? "solicitacao-reembolso-transporte"
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
    if (snapshot.adhesion) {
      return [
        `primeira_parcela=${snapshot.adhesion.firstInstallmentDate}`,
        `parcelas=${snapshot.adhesion.installmentCount}`,
        snapshot.adhesion.notes ? `observacoes=${snapshot.adhesion.notes}` : null,
      ]
        .filter(Boolean)
        .join("; ");
    }
    if (snapshot.annualClearance) {
      return [
        `ano=${snapshot.annualClearance.year}`,
        `valor=${snapshot.annualClearance.totalAmountCents}`,
        `quitacao=${snapshot.annualClearance.finalClearanceDate}`,
        `template=${snapshot.annualClearance.templateKey}@${snapshot.annualClearance.templateVersion}`,
        snapshot.notes ? `observacoes=${snapshot.notes}` : null,
      ]
        .filter(Boolean)
        .join("; ");
    }
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
    if (snapshot.transportRegulation) {
      return [
        `emissao=${
          snapshot.transportRegulation.issueDate ??
          snapshot.transportRegulation.approvalDate ??
          ""
        }`,
        `template=${snapshot.transportRegulation.templateKey}@${snapshot.transportRegulation.templateVersion}`,
      ].join("; ");
    }
    if (snapshot.transportRefund) {
      return [
        `valor=${snapshot.transportRefund.refundAmountCents}`,
        `forma=${snapshot.transportRefund.paymentMethod}`,
        `emissao=${snapshot.transportRefund.issueDate}`,
        `template=${snapshot.transportRefund.templateKey}@${snapshot.transportRefund.templateVersion}`,
        snapshot.transportRefund.notes
          ? `observacoes=${snapshot.transportRefund.notes}`
          : null,
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

  private resolveAdhesionTermPayload(
    payload?: OfficialDocumentIssuePayload,
  ): AdhesionTermPayload {
    if (!payload?.firstInstallmentDate) {
      throw new BadRequestException("Informe a data da primeira mensalidade.");
    }
    if (!payload.installmentCount) {
      throw new BadRequestException("Informe a quantidade de parcelas.");
    }
    if (!payload.installmentAmountCents) {
      throw new BadRequestException("Informe o valor de cada parcela.");
    }
    if (
      !Number.isInteger(payload.installmentCount) ||
      payload.installmentCount <= 0 ||
      payload.installmentCount > 24
    ) {
      throw new BadRequestException("Quantidade de parcelas invalida.");
    }
    if (
      !Number.isInteger(payload.installmentAmountCents) ||
      payload.installmentAmountCents <= 0
    ) {
      throw new BadRequestException("Valor de cada parcela invalido.");
    }
    return {
      firstInstallmentDate: this.parseDateOnly(
        payload.firstInstallmentDate,
        "Data da primeira mensalidade invalida",
      ),
      installmentAmountCents: payload.installmentAmountCents,
      installmentCount: payload.installmentCount,
      notes: payload.notes || undefined,
    };
  }

  private resolveTransportRefundRequestPayload(
    payload?: OfficialDocumentIssuePayload,
  ): TransportRefundRequestPayload {
    if (!payload?.refundAmountCents) {
      throw new BadRequestException("Informe o valor do reembolso.");
    }
    if (
      !Number.isInteger(payload.refundAmountCents) ||
      payload.refundAmountCents <= 0
    ) {
      throw new BadRequestException("Valor do reembolso invalido.");
    }
    const reason = payload.reason?.trim();
    if (!reason) {
      throw new BadRequestException("Informe o motivo da solicitacao.");
    }
    const paymentMethod = payload.paymentMethod?.trim();
    if (paymentMethod !== "PIX" && paymentMethod !== "BANK_ACCOUNT") {
      throw new BadRequestException("Informe a forma de recebimento.");
    }
    if (paymentMethod === "PIX") {
      const pixKey = payload.pixKey?.trim();
      if (!pixKey) {
        throw new BadRequestException("Informe a chave PIX.");
      }
      return {
        notes: payload.notes || undefined,
        paymentMethod,
        pixKey,
        reason,
        refundAmountCents: payload.refundAmountCents,
      };
    }
    const bankName = payload.bankName?.trim();
    const bankAgency = payload.bankAgency?.trim();
    const bankAccount = payload.bankAccount?.trim();
    if (!bankName || !bankAgency || !bankAccount) {
      throw new BadRequestException("Informe banco, agencia e conta.");
    }
    return {
      bankAccount,
      bankAccountType: payload.bankAccountType?.trim() || undefined,
      bankAgency,
      bankName,
      notes: payload.notes || undefined,
      paymentMethod,
      reason,
      refundAmountCents: payload.refundAmountCents,
    };
  }

  private resolveAnnualClearanceDeclarationPayload(
    payload?: OfficialDocumentIssuePayload,
  ): AnnualClearanceDeclarationPayload {
    if (!payload?.year) {
      throw new BadRequestException("Informe o ano de referencia.");
    }
    if (!Number.isInteger(payload.year) || payload.year < 2000 || payload.year > 2100) {
      throw new BadRequestException("Ano de referencia invalido.");
    }
    if (!payload.totalAmountCents) {
      throw new BadRequestException("Informe o valor total quitado.");
    }
    if (
      !Number.isInteger(payload.totalAmountCents) ||
      payload.totalAmountCents <= 0
    ) {
      throw new BadRequestException("Valor total quitado invalido.");
    }
    if (!payload.finalClearanceDate) {
      throw new BadRequestException("Informe a data da quitacao final.");
    }
    const finalClearanceDate = this.parseDateOnly(
      payload.finalClearanceDate,
      "Data da quitacao final invalida",
    );
    return {
      finalClearanceDate,
      notes: payload.notes || undefined,
      totalAmountCents: payload.totalAmountCents,
      year: payload.year,
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

  private addMonthsClamped(value: Date, monthsToAdd: number) {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + monthsToAdd;
    const originalDay = value.getUTCDate();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(year, month, Math.min(originalDay, lastDay), 12, 0, 0, 0),
    );
  }

  private formatCurrency(amountCents: number) {
    return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
    }).format(amountCents / 100);
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
      if (definition.source === "GUARDIAN") {
        if (!student) {
          throw new BadRequestException("Documento exige academico vinculado.");
        }
        if (!student.guardian?.fullName) {
          if (definition.required) {
            throw new BadRequestException("Responsavel obrigatorio nao configurado.");
          }
          continue;
        }
        const roleLabel = "Responsavel";
        signers.push({
          boardId: null,
          boardMemberId: null,
          boardPeriodEnd: null,
          boardPeriodStart: null,
          endedAt: null,
          label: definition.label,
          name: student.guardian.fullName,
          personId: null,
          resolvedAt: issuedAt.toISOString(),
          role: definition.role,
          roleLabel,
          signerName: student.guardian.fullName,
          signerPersonId: null,
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

  private pdfSignatures(snapshot: OfficialDocumentSnapshot) {
    if (!snapshot.signers.length) {
      return undefined;
    }
    return snapshot.signers.map((signer) => {
      if (
        snapshot.documentType ===
          OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION &&
        signer.source === "BOARD_ROLE"
      ) {
        return {
          label: signer.label,
          name: signer.name,
        };
      }
      if (
        snapshot.documentType === OfficialDocumentType.ADHESION_TERM &&
        signer.source === "STUDENT" &&
        snapshot.student
      ) {
        return {
          label: `Associado | CPF: ${snapshot.student.cpf} | RG: ${snapshot.student.rg}`,
          name: signer.name,
        };
      }
      if (
        snapshot.documentType === OfficialDocumentType.ADHESION_TERM &&
        signer.source === "GUARDIAN" &&
        snapshot.guardian
      ) {
        return {
          label: [
            "Responsavel",
            snapshot.guardian.cpf ? `CPF: ${snapshot.guardian.cpf}` : null,
            snapshot.guardian.rg ? `RG: ${snapshot.guardian.rg}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          name: signer.name,
        };
      }
      if (
        snapshot.documentType === OfficialDocumentType.TRANSPORT_REFUND_REQUEST &&
        signer.source === "STUDENT" &&
        snapshot.student
      ) {
        return {
          label: `Associado | CPF: ${snapshot.student.cpf} | RG: ${snapshot.student.rg}`,
          name: signer.name,
        };
      }
      return {
        label: signer.label,
        name: signer.name,
      };
    });
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

  private formatDateOnlyInSaoPaulo(value: Date) {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    })
      .formatToParts(value)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  private formatLongDateInSaoPaulo(value: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      timeZone: "America/Sao_Paulo",
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

  private moneyWords(amountCents: number) {
    const reais = Math.floor(amountCents / 100);
    const cents = amountCents % 100;
    const realText = `${this.numberWords(reais)} ${reais === 1 ? "real" : "reais"}`;
    if (cents === 0) {
      return realText;
    }
    const centText = `${this.numberWords(cents)} ${
      cents === 1 ? "centavo" : "centavos"
    }`;
    return `${realText} e ${centText}`;
  }

  private numberWords(value: number): string {
    const direct: Record<number, string> = {
      0: "zero",
      1: "um",
      2: "dois",
      3: "tres",
      4: "quatro",
      5: "cinco",
      6: "seis",
      7: "sete",
      8: "oito",
      9: "nove",
      10: "dez",
      11: "onze",
      12: "doze",
      13: "treze",
      14: "quatorze",
      15: "quinze",
      16: "dezesseis",
      17: "dezessete",
      18: "dezoito",
      19: "dezenove",
      20: "vinte",
      30: "trinta",
      40: "quarenta",
      50: "cinquenta",
      60: "sessenta",
      70: "setenta",
      80: "oitenta",
      90: "noventa",
      100: "cem",
      200: "duzentos",
      300: "trezentos",
      400: "quatrocentos",
      500: "quinhentos",
      600: "seiscentos",
      700: "setecentos",
      800: "oitocentos",
      900: "novecentos",
    };
    if (direct[value]) {
      return direct[value];
    }
    if (value < 100) {
      const ten = Math.floor(value / 10) * 10;
      return `${direct[ten]} e ${direct[value - ten]}`;
    }
    if (value < 1000) {
      const hundred = Math.floor(value / 100) * 100;
      const prefix = value < 200 ? "cento" : direct[hundred];
      return `${prefix} e ${this.numberWords(value - hundred)}`;
    }
    if (value < 1000000) {
      const thousands = Math.floor(value / 1000);
      const remainder = value % 1000;
      const prefix =
        thousands === 1 ? "mil" : `${this.numberWords(thousands)} mil`;
      return remainder === 0
        ? prefix
        : `${prefix} ${remainder < 100 ? "e " : ""}${this.numberWords(remainder)}`;
    }
    return String(value);
  }
}
