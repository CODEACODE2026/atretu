import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
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
import type { IssueOfficialDocumentDto } from "./dto/official-documents.dto.js";
import {
  OfficialDocumentPdfBuilder,
  type OfficialDocumentPdfInput,
} from "./official-document-pdf.builder.js";
import {
  getOfficialDocumentDefinition,
  listOfficialDocumentDefinitions,
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

type OfficialDocumentSnapshot = {
  body: string[];
  documentTitle: string;
  documentType: OfficialDocumentType;
  emittedAt: string;
  footerNote: string;
  protocol: string;
  qrPayload: string;
  representative?: { name: string; source: string; title: string };
  signatureLabel: string;
  signatureName: string;
  signatureTitle?: string;
  student: {
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
  termination?: {
    occurredAt: string;
    reason: string | null;
    justification: string | null;
  } | null;
  version: number;
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
      }),
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
    if (sourceIssueId) {
      const source = await this.prisma.officialDocumentIssue.findFirst({
        where: { id: sourceIssueId, studentId, documentType },
      });
      if (!source) {
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
              protocol,
              sourceIssueId,
              studentId,
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

  async getIssue(studentId: string, issueId: string, currentUser: AuthUser) {
    await this.getStudent(studentId, currentUser);
    const issue = await this.findIssue(studentId, issueId);
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

  private async buildSnapshot(
    student: StudentForOfficialDocument,
    documentType: OfficialDocumentType,
    issuedAt: Date,
    protocol: string,
    payload?: OfficialDocumentIssuePayload,
  ): Promise<OfficialDocumentSnapshot> {
    if (documentType === OfficialDocumentType.TERMINATION_TERM) {
      return this.buildTerminationTermSnapshot(student, issuedAt, protocol, payload);
    }
    return this.buildTerminationLetterSnapshot(student, documentType, issuedAt, protocol);
  }

  private buildTerminationLetterSnapshot(
    student: StudentForOfficialDocument,
    documentType: OfficialDocumentType,
    issuedAt: Date,
    protocol: string,
  ): OfficialDocumentSnapshot {
    const termination = student.historyEvents[0] ?? null;
    const definition = getOfficialDocumentDefinition(documentType);
    const address = this.formatAddress(student.person);
    const issuedCity = student.person.addressCity || "Terra Rica";
    const body = [
      "Prezada Diretoria,",
      `Eu, ${student.person.fullName}, RG: ${this.formatRg(student.person.rg)}, CPF: ${this.formatCpf(student.person.cpf)}, residente e à ${address}, venho, por meio desta solicitação formal, requerer minha exclusão do quadro de sócios da ATRETU, com efeito imediato e caráter irrevogável, a partir da presente data. Solicito, outrossim, que seja cessada a emissão de cobranças de mensalidade em meu nome, e que a Tesouraria da ATRETU seja contatada para verificar eventuais pendências financeiras e/ou confirmar a quitação de meus compromissos como associado.`,
      "Declaro estar ciente de que, em caso de interesse em retornar ao quadro de sócios da ATRETU, poderei solicitar nova adesão somente após o prazo de 30 dias a contar da data de minha exclusão. Ademais, compreendo que, em caso de aprovação de minha nova adesão, o prazo para que eu possa ter direito aos serviços prestados pela associação será de 15 dias após a efetivação da nova inscrição.",
      "Atenciosamente,",
    ];
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
      signatureName: student.person.fullName,
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
    const representative = await this.resolveInstitutionalRepresentative();
    const studentName = student.person.fullName;
    const notificationDate = this.formatDate(term.notificationDate);
    const dueDate = this.formatDate(term.dueDate);
    const regularizationLimit = this.addDays(
      term.notificationDate,
      term.regularizationDeadlineDays,
    );
    const regularizationLimitText = this.formatDate(regularizationLimit);
    const body = [
      "Prezada Diretoria,",
      `Por meio deste Termo de Desligamento, a ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS - ATRETU notifica o(a) associado(a) ${studentName}, CPF ${this.formatCpf(student.person.cpf)}, RG ${this.formatRg(student.person.rg)}, acerca do processo de desligamento motivado por ${term.reason.toLowerCase()}.`,
      `Consta em nossos registros pendência com vencimento em ${dueDate}. A notificação formal foi realizada em ${notificationDate}, ficando concedido o prazo de ${term.regularizationDeadlineDays} dias para regularização, com término em ${regularizationLimitText}.`,
      "Caso a pendência não seja regularizada dentro do prazo informado, o(a) associado(a) será desligado(a) do quadro de sócios da ATRETU, com a consequente suspensão dos direitos e benefícios vinculados à associação, sem prejuízo da cobrança dos valores eventualmente devidos.",
      "Regularizada a situação dentro do prazo, este termo ficará sem efeito para fins de desligamento, permanecendo o(a) associado(a) sujeito(a) às demais regras estatutárias e administrativas da associação.",
      "E, para que produza seus efeitos, o presente termo é emitido e registrado no sistema oficial da ATRETU.",
    ];
    return {
      body,
      documentTitle: definition.title,
      documentType: OfficialDocumentType.TERMINATION_TERM,
      emittedAt: issuedAt.toISOString(),
      footerNote:
        "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
      protocol,
      qrPayload: `ATRETU:${protocol}`,
      representative,
      signatureLabel: `${student.person.addressCity || "Terra Rica"}, ${this.formatDate(issuedAt)}`,
      signatureName: representative.name,
      signatureTitle: representative.title,
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
      protocol: snapshot.protocol,
      qrPayload: snapshot.qrPayload,
      signatureLabel: snapshot.signatureLabel,
      signatureName: snapshot.signatureName,
      signatureTitle: snapshot.signatureTitle,
      studentName: snapshot.student.name,
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
      termDetails: this.termDetails(issue),
    };
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

  private issueNotes(snapshot: OfficialDocumentSnapshot) {
    if (snapshot.term?.notes) {
      return snapshot.term.notes;
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
    if (!payload?.dueDate || !payload.notificationDate) {
      throw new BadRequestException(
        "Data do vencimento e data da notificacao sao obrigatorias",
      );
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

  private async resolveInstitutionalRepresentative() {
    const boardMember = await this.prisma.boardMembership.findFirst({
      where: { status: BoardMembershipStatus.ACTIVE },
      include: { student: { include: { person: true } } },
      orderBy: { startedAt: "desc" },
    });
    const boardMemberName = boardMember?.student.person.fullName;
    if (!boardMemberName) {
      throw new BadRequestException(
        "Representante institucional oficial nao configurado para emissao do Termo de Desligamento",
      );
    }
    return {
      name: boardMemberName,
      source: "active_board_membership",
      title: "Presidente da ATRETU",
    };
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
