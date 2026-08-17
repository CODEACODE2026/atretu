import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcademicYearStatus,
  AdministrativeAuditEventType,
  BusAssignmentEventType,
  BusAssignmentStatus,
  EnrollmentStatus,
  Prisma,
  RecordStatus,
  StudentCardStatus,
  StudentCardType,
  StudentHistoryEventType,
  StudentStatus,
} from "@prisma/client";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { buildStudentCardNumber } from "../student-cards/card-number.js";
import { isValidCpf, maskCpf, normalizeCpf } from "../students/cpf.js";
import type { AuthUser } from "../users/users.service.js";
import {
  AnalyzeLegacyAcademicImportDto,
  ImportLegacyAcademicSelectionDto,
  LegacyAcademicRawRecordDto,
} from "./dto/legacy-import.dto.js";

type PreviewStatus = "PRONTO" | "PENDENCIA" | "BLOQUEADO" | "JA_IMPORTADO";
type RelationState = "FOUND" | "WILL_CREATE" | "DIVERGENCE" | "BLOCKED";
type CreatedBaseRecords = {
  institutions: string[];
  shifts: string[];
  buses: string[];
};
type PreparedRecord = ReturnType<LegacyImportService["prepareRecord"]>;
type LegacyRelationPreview = {
  legacyName: string | null;
  status: RelationState;
  message: string;
  resolved: { id: string; name: string } | null;
  willCreate: boolean;
};
type LegacyBusRelationPreview = LegacyRelationPreview & {
  legacyCapacity: number | null;
  resolvedCapacity: number | null;
};
type LegacyPreviewItem = {
  index: number;
  legacyId: number | null;
  name: string;
  cpf: string;
  cpfMasked: string;
  legacyCreatedYear: number | null;
  destinationAcademicYear: number;
  institutionLegacy: string;
  institution: { id: string; name: string } | null;
  course: string;
  grade: string;
  shiftLegacy: string;
  shift: { id: string; name: string } | null;
  busLegacy: string | null;
  bus: { id: string; name: string; capacity: number } | null;
  legacyCardNumber: string | null;
  card: {
    legacyNumber: string | null;
    hasConflict: boolean;
    canPreserve: boolean;
    needsAtretuNumber: boolean;
    reason: string;
  };
  observation: string | null;
  academicYear: { id: string; year: number } | null;
  relations: {
    institution: LegacyRelationPreview;
    shift: LegacyRelationPreview;
    bus: LegacyBusRelationPreview;
    academicYear: LegacyRelationPreview;
  };
  requiresBaseRecordCreation: boolean;
  status: PreviewStatus;
  canImport: boolean;
  reasons: string[];
  normalized: PreparedRecord;
};

const SOURCE = "LEGACY";
const LEGACY_TABLE = "tab_academico";
const MAX_RECORDS = 500;
const IMPORT_CHUNK_SIZE = 25;
const SUSPICIOUS_OBSERVATION = /\b(deslig\w*|mudan\w*|transfer\w*|cancel\w*|inativ\w*|suspend\w*|tranc\w*|fora|saiu)\b/i;
type LegacyImportJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
type LegacyImportJobResult = {
  legacyId: number | null;
  status: "IMPORTADO" | "FALHA" | "BLOQUEADO" | "JA_IMPORTADO";
  studentId?: string;
  cardNumber?: string;
  reason?: string;
};
type LegacyImportJob = {
  id: string;
  status: LegacyImportJobStatus;
  batchId: string | null;
  total: number;
  processed: number;
  imported: number;
  failed: number;
  ignored: number;
  percent: number;
  chunkSize: number;
  startedAt: string;
  finishedAt: string | null;
  message: string;
  results: LegacyImportJobResult[];
};
type PersistedImportProgress = {
  jobId?: string;
  status?: LegacyImportJobStatus;
  processed?: number;
  total?: number;
  imported?: number;
  failed?: number;
  ignored?: number;
  percent?: number;
  chunkSize?: number;
  startedAt?: string;
  finishedAt?: string | null;
  message?: string;
  results?: LegacyImportJobResult[];
};

@Injectable()
export class LegacyImportService {
  private readonly importJobs = new Map<string, LegacyImportJob>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  async analyzeAcademicImport(body: AnalyzeLegacyAcademicImportDto) {
    this.validateFileMetadata(body);
    const destinationAcademicYear = this.resolveDestinationAcademicYear(body);
    const prepared = body.records.map((record, index) =>
      this.prepareRecord(record, index, destinationAcademicYear),
    );
    const duplicateCpfs = this.findDuplicates(prepared.map((record) => record.cpf));
    const duplicateLegacyIds = this.findDuplicates(
      prepared
        .map((record) => record.legacyId)
        .filter((legacyId): legacyId is number => legacyId !== null),
    );
    const context = await this.loadResolutionContext(prepared);

    const items = prepared.map((record) =>
      this.buildPreviewItem(record, context, duplicateCpfs, duplicateLegacyIds),
    );
    return {
      file: {
        fileName: body.fileName ?? null,
        mimeType: body.mimeType ?? null,
        sizeBytes: body.sizeBytes ?? null,
      },
      limits: { maxRecordsPerBatch: MAX_RECORDS, chunkSize: IMPORT_CHUNK_SIZE },
      summary: this.summarize(items),
      items,
    };
  }

  async startAcademicImportJob(
    body: ImportLegacyAcademicSelectionDto,
    user: AuthUser,
  ) {
    const preview = await this.analyzeAcademicImport(body);
    const selection = this.resolveSelection(preview.items, body.selectedLegacyIds);
    this.assertImportConfirmation(selection.importable, body);

    const batch = await this.createImportBatch(body, preview, selection.importable.length, user.id);
    const job = this.createJob(batch.id, selection.items.length);
    this.importJobs.set(job.id, job);
    await this.persistJobProgress(batch.id, job, {
      institutions: [],
      shifts: [],
      buses: [],
    });

    await this.audit.record({
      eventType: AdministrativeAuditEventType.LEGACY_IMPORT_BATCH_CREATED,
      domain: "legacy_import_batches",
      recordId: batch.id,
      userId: user.id,
      metadata: {
        source: SOURCE,
        legacyTable: LEGACY_TABLE,
        fileName: body.fileName ?? "",
        totalRecords: body.records.length,
        selectedRecords: selection.items.length,
        chunkSize: IMPORT_CHUNK_SIZE,
      },
    });

    void this.processImportJob(job.id, body, user.id, selection.items);
    return this.serializeJob(job);
  }

  async getAcademicImportJob(jobId: string) {
    const job = this.importJobs.get(jobId);
    if (job) return this.serializeJob(job);

    const batch = await this.prisma.legacyImportBatch.findUnique({
      where: { id: jobId },
    });
    if (!batch) throw new NotFoundException("Job de importacao nao encontrado");
    return this.serializeJob(this.hydrateJobFromBatch(batch));
  }

  async importAcademicSelection(
    body: ImportLegacyAcademicSelectionDto,
    user: AuthUser,
  ) {
    const preview = await this.analyzeAcademicImport(body);
    const selection = this.resolveSelection(preview.items, body.selectedLegacyIds);
    this.assertImportConfirmation(selection.importable, body);
    const batch = await this.createImportBatch(body, preview, selection.importable.length, user.id);

    await this.audit.record({
      eventType: AdministrativeAuditEventType.LEGACY_IMPORT_BATCH_CREATED,
      domain: "legacy_import_batches",
      recordId: batch.id,
      userId: user.id,
      metadata: {
        source: SOURCE,
        legacyTable: LEGACY_TABLE,
        fileName: body.fileName ?? "",
        totalRecords: body.records.length,
        selectedRecords: selection.importable.length,
      },
    });

    const results = [];
    let importedCount = 0;
    let failedCount = 0;
    const createdBaseRecords: CreatedBaseRecords = {
      institutions: [],
      shifts: [],
      buses: [],
    };

    for (const item of selection.importable) {
      try {
        const imported = await this.importOne(
          body.records,
          item.legacyId!,
          batch.id,
          user.id,
          body.destinationAcademicYear,
          Boolean(body.createMissingBaseRecords),
        );
        this.mergeCreatedBaseRecords(createdBaseRecords, imported.createdBaseRecords);
        importedCount += 1;
        results.push({
          legacyId: item.legacyId,
          status: "IMPORTADO",
          studentId: imported.studentId,
          cardNumber: imported.generatedCardNumber,
        });
      } catch (error) {
        failedCount += 1;
        results.push({
          legacyId: item.legacyId,
          status: "FALHA",
          reason: this.toFriendlyError(error),
        });
      }
    }

    const updatedBatch = await this.prisma.legacyImportBatch.update({
      where: { id: batch.id },
      data: {
        importedCount,
        failedCount,
        createdBaseRecords: {
          ...createdBaseRecords,
          selectedRecords: selection.importable.length,
          chunkSize: IMPORT_CHUNK_SIZE,
          processed: selection.importable.length,
          total: selection.importable.length,
          imported: importedCount,
          failed: failedCount,
          ignored: 0,
          percent: selection.importable.length === 0 ? 100 : 100,
          status: "COMPLETED",
        },
      },
    });

    return {
      batch: updatedBatch,
      summary: {
        imported: importedCount,
        pending: selection.importable.filter((item) => item.status === "PENDENCIA").length,
        blocked: selection.blocked.length,
        failed: failedCount,
      },
      results,
    };
  }

  private resolveSelection(
    items: LegacyPreviewItem[],
    selectedLegacyIds: number[],
  ) {
    const selected = new Set(selectedLegacyIds);
    const selectedItems = items.filter(
      (item) => item.legacyId !== null && selected.has(item.legacyId),
    );
    if (selectedItems.length !== selected.size) {
      throw new BadRequestException("Selecao contem legacy_id ausente no JSON");
    }
    return {
      items: selectedItems,
      importable: selectedItems.filter((item) => item.canImport),
      blocked: selectedItems.filter((item) => !item.canImport),
    };
  }

  private assertImportConfirmation(
    selectedItems: LegacyPreviewItem[],
    body: ImportLegacyAcademicSelectionDto,
  ) {
    const reviewRequired = selectedItems.filter(
      (item) => item.status === "PENDENCIA",
    );
    if (reviewRequired.length > 0 && !body.confirmReviewRequired) {
      throw new BadRequestException(
        "Registros com pendencia exigem confirmacao explicita",
      );
    }
    const baseCreationRequired = selectedItems.filter(
      (item) => item.requiresBaseRecordCreation,
    );
    if (baseCreationRequired.length > 0 && !body.createMissingBaseRecords) {
      const details = baseCreationRequired
        .map((item) => `legacy_id ${item.legacyId ?? "-"}`)
        .join(", ");
      throw new BadRequestException(
        `Criacao de cadastros-base ausentes exige confirmacao SUPER_ADMIN. ${details}`,
      );
    }
  }

  private createImportBatch(
    body: ImportLegacyAcademicSelectionDto,
    preview: Awaited<ReturnType<LegacyImportService["analyzeAcademicImport"]>>,
    selectedRecords: number,
    userId: string,
  ) {
    return this.prisma.legacyImportBatch.create({
      data: {
        fileName: this.optional(body.fileName),
        totalRecords: body.records.length,
        pendingCount: preview.summary.PENDENCIA,
        blockedCount: preview.summary.BLOQUEADO,
        importedByUserId: userId,
        createdBaseRecords: {
          institutions: [],
          shifts: [],
          buses: [],
          selectedRecords,
          chunkSize: IMPORT_CHUNK_SIZE,
        },
      },
    });
  }

  private createJob(batchId: string, total: number): LegacyImportJob {
    return {
      id: batchId,
      status: "QUEUED",
      batchId,
      total,
      processed: 0,
      imported: 0,
      failed: 0,
      ignored: 0,
      percent: total === 0 ? 100 : 0,
      chunkSize: IMPORT_CHUNK_SIZE,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      message: "Job de importacao criado",
      results: [],
    };
  }

  private async processImportJob(
    jobId: string,
    body: ImportLegacyAcademicSelectionDto,
    userId: string,
    selectedItems: LegacyPreviewItem[],
  ) {
    const job = this.importJobs.get(jobId);
    if (!job || !job.batchId) return;
    job.status = "PROCESSING";
    job.message = "Importacao em processamento";
    const createdBaseRecords: CreatedBaseRecords = {
      institutions: [],
      shifts: [],
      buses: [],
    };

    try {
      for (const chunk of this.chunk(selectedItems, IMPORT_CHUNK_SIZE)) {
        for (const item of chunk) {
          if (item.status === "JA_IMPORTADO") {
            job.ignored += 1;
            job.results.push({
              legacyId: item.legacyId,
              status: "JA_IMPORTADO",
              reason: "Registro legado ja importado",
            });
          } else if (!item.canImport) {
            job.ignored += 1;
            job.results.push({
              legacyId: item.legacyId,
              status: "BLOQUEADO",
              reason: item.reasons.join("; "),
            });
          } else {
            try {
              const imported = await this.importOne(
                body.records,
                item.legacyId!,
                job.batchId,
                userId,
                body.destinationAcademicYear,
                Boolean(body.createMissingBaseRecords),
              );
              this.mergeCreatedBaseRecords(
                createdBaseRecords,
                imported.createdBaseRecords,
              );
              job.imported += 1;
              job.results.push({
                legacyId: item.legacyId,
                status: "IMPORTADO",
                studentId: imported.studentId,
                cardNumber: imported.generatedCardNumber,
              });
            } catch (error) {
              job.failed += 1;
              job.results.push({
                legacyId: item.legacyId,
                status: "FALHA",
                reason: this.toFriendlyError(error),
              });
            }
          }
          job.processed += 1;
          job.percent =
            job.total === 0 ? 100 : Math.floor((job.processed / job.total) * 100);
          await this.updateBatchProgress(job.batchId, job, createdBaseRecords);
        }
      }
      job.status = "COMPLETED";
      job.percent = 100;
      job.finishedAt = new Date().toISOString();
      job.message = "Importacao concluida";
      await this.updateBatchProgress(job.batchId, job, createdBaseRecords);
    } catch (error) {
      job.status = "FAILED";
      job.finishedAt = new Date().toISOString();
      job.message = this.toFriendlyError(error);
      await this.updateBatchProgress(job.batchId, job, createdBaseRecords);
    }
  }

  private async updateBatchProgress(
    batchId: string,
    job: LegacyImportJob,
    createdBaseRecords: CreatedBaseRecords,
  ) {
    await this.persistJobProgress(batchId, job, createdBaseRecords);
  }

  private async persistJobProgress(
    batchId: string,
    job: LegacyImportJob,
    createdBaseRecords: CreatedBaseRecords,
  ) {
    await this.prisma.legacyImportBatch.update({
      where: { id: batchId },
      data: {
        importedCount: job.imported,
        failedCount: job.failed,
        createdBaseRecords: {
          ...createdBaseRecords,
          jobId: job.id,
          status: job.status,
          ignored: job.ignored,
          processed: job.processed,
          total: job.total,
          imported: job.imported,
          failed: job.failed,
          percent: job.percent,
          chunkSize: IMPORT_CHUNK_SIZE,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          message: job.message,
          results: job.results.slice(-500),
        },
      },
    });
  }

  private serializeJob(job: LegacyImportJob) {
    return {
      ...job,
      results: job.results.slice(-500),
    };
  }

  private hydrateJobFromBatch(batch: {
    id: string;
    importedCount: number;
    failedCount: number;
    createdBaseRecords: Prisma.JsonValue;
  }): LegacyImportJob {
    const progress = this.parsePersistedImportProgress(batch.createdBaseRecords);
    const total = progress.total ?? progress.processed ?? batch.importedCount + batch.failedCount;
    const processed = progress.processed ?? batch.importedCount + batch.failedCount;
    const percent =
      progress.percent ?? (total === 0 ? 100 : Math.floor((processed / total) * 100));
    return {
      id: progress.jobId ?? batch.id,
      status: progress.status ?? "COMPLETED",
      batchId: batch.id,
      total,
      processed,
      imported: progress.imported ?? batch.importedCount,
      failed: progress.failed ?? batch.failedCount,
      ignored: progress.ignored ?? 0,
      percent,
      chunkSize: progress.chunkSize ?? IMPORT_CHUNK_SIZE,
      startedAt: progress.startedAt ?? new Date().toISOString(),
      finishedAt: progress.finishedAt ?? null,
      message: progress.message ?? "Progresso recuperado do batch",
      results: progress.results ?? [],
    };
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private toFriendlyError(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "string") return response;
      if (
        response &&
        typeof response === "object" &&
        "message" in response
      ) {
        const message = (response as { message?: unknown }).message;
        if (Array.isArray(message)) return message.join("; ");
        if (typeof message === "string") return message;
      }
      return error.message;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "Registro ja existe no ATRETU";
    }
    if (error instanceof ConflictException || error instanceof BadRequestException) {
      return error.message;
    }
    return "Falha ao importar registro legado";
  }

  async rollbackBatch(batchId: string, user: AuthUser) {
    const batch = await this.prisma.legacyImportBatch.findUnique({
      where: { id: batchId },
      include: { students: true },
    });
    if (!batch) {
      throw new NotFoundException("Batch de importacao nao encontrado");
    }
    if (batch.rolledBackAt) {
      throw new BadRequestException("Batch ja possui rollback");
    }
    if (batch.source !== SOURCE || batch.legacyTable !== LEGACY_TABLE) {
      throw new BadRequestException("Rollback permitido apenas para piloto legado");
    }

    const removed = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      const importedStudentIds = batch.students.map((record) => record.studentId);
      const touchedCardSequences: Array<{
        academicYearId: string;
        previous: number;
        sequenceNumber: number;
      }> = [];
      for (const record of batch.students) {
        await this.assertRollbackSafe(tx, record.studentId);
        const card = await tx.studentCard.findUnique({
          where: { id: record.studentCardId },
          select: { academicYearId: true, sequenceNumber: true },
        });
        if (card) {
          touchedCardSequences.push({
            academicYearId: card.academicYearId,
            previous: record.previousCardSequenceNumber,
            sequenceNumber: card.sequenceNumber,
          });
        }
        await tx.legacyStudentImport.delete({ where: { id: record.id } });
        await tx.studentHistoryEvent.deleteMany({
          where: {
            OR: [
              { studentId: record.studentId },
              { studentCardId: record.studentCardId },
              { busAssignmentId: record.busAssignmentId ?? undefined },
            ],
          },
        });
        if (record.busAssignmentId) {
          await tx.busAssignmentEvent.deleteMany({
            where: { busAssignmentId: record.busAssignmentId },
          });
          await tx.busAssignment.delete({ where: { id: record.busAssignmentId } });
        }
        await tx.studentCard.delete({ where: { id: record.studentCardId } });
        await tx.enrollment.delete({ where: { id: record.enrollmentId } });
        await tx.student.delete({ where: { id: record.studentId } });
        await tx.person.delete({ where: { id: record.personId } });
        count += 1;
      }
      for (const item of touchedCardSequences.sort(
        (left, right) => right.sequenceNumber - left.sequenceNumber,
      )) {
        await this.reconcileCardSequenceAfterRollback(tx, item);
      }
      await this.deleteCreatedBaseRecordsIfUnused(
        tx,
        this.parseCreatedBaseRecords(batch.createdBaseRecords),
      );
      await tx.legacyImportBatch.delete({ where: { id: batch.id } });
      await tx.administrativeAuditLog.deleteMany({
        where: {
          OR: [
            { domain: "legacy_import_batches", recordId: batch.id },
            {
              domain: "students",
              recordId: { in: importedStudentIds },
              eventType: AdministrativeAuditEventType.LEGACY_STUDENT_IMPORTED,
            },
          ],
        },
      });
      return count;
    });

    return { batchId, removed, residuals: 0 };
  }

  private async importOne(
    sourceRecords: LegacyAcademicRawRecordDto[],
    legacyId: number,
    batchId: string,
    userId: string,
    destinationAcademicYear: number,
    createMissingBaseRecords: boolean,
  ) {
    const source = sourceRecords.find((record) => record.legacy_id === legacyId);
    if (!source) {
      throw new BadRequestException("Registro selecionado nao encontrado");
    }
    const preview = await this.analyzeAcademicImport({
      records: [source],
      fileName: "single-record.json",
      mimeType: "application/json",
      sizeBytes: 1,
      destinationAcademicYear,
    });
    const item = preview.items[0];
    if (!item || !item.canImport) {
      throw new BadRequestException(item?.reasons.join("; ") ?? "Registro invalido");
    }
    if (item.requiresBaseRecordCreation && !createMissingBaseRecords) {
      throw new BadRequestException(
        "Criacao de cadastros-base ausentes exige confirmacao SUPER_ADMIN",
      );
    }
    this.assertImportableRequirements(item);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureLegacyNotImported(tx, legacyId);
      const baseRecords = await this.resolveBaseRecordsForImport(
        tx,
        item,
        createMissingBaseRecords,
      );
      const cardSequence = await this.nextCardSequence(tx, item.academicYear.id);
      const sequenceNumber = cardSequence.next;
      const cardNumber = buildStudentCardNumber(sequenceNumber, item.academicYear.year);
      const person = await tx.person.create({
        data: {
          fullName: item.normalized.fullName,
          normalizedName: item.normalized.nameKey,
          cpf: item.normalized.cpf,
          rg: item.normalized.rg,
          birthDate: item.normalized.birthDate!,
          phone: item.normalized.phone,
          email: item.normalized.email,
          addressStreet: item.normalized.addressStreet,
          addressNumber: "S/N",
          addressNeighborhood: "Nao informado",
          addressCity: "Nao informado",
        },
      });
      const student = await tx.student.create({
        data: {
          personId: person.id,
          status: StudentStatus.ACTIVE,
          joinedAt: item.normalized.joinedAt ?? new Date(),
        },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          academicYearId: item.academicYear.id,
          institutionId: baseRecords.institution.id,
          shiftId: baseRecords.shift.id,
          course: item.normalized.course,
          grade: item.normalized.grade,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      let busAssignmentId: string | null = null;
      if (baseRecords.bus) {
        const assignment = await tx.busAssignment.create({
          data: {
            enrollmentId: enrollment.id,
            busId: baseRecords.bus!.id,
            status: BusAssignmentStatus.ACTIVE,
            note: "Vinculo criado pela importacao piloto legado",
          },
        });
        busAssignmentId = assignment.id;
        await tx.busAssignmentEvent.create({
          data: {
            enrollmentId: enrollment.id,
            busAssignmentId: assignment.id,
            toBusId: baseRecords.bus!.id,
            eventType: BusAssignmentEventType.LINKED,
            note: "Importacao piloto legado",
          },
        });
      }
      const card = await tx.studentCard.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          academicYearId: item.academicYear.id,
          cardType: StudentCardType.STUDENT,
          sequenceNumber,
          cardNumber,
          status: StudentCardStatus.ACTIVE,
          issuedByUserId: userId,
        },
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: student.id,
          eventType: StudentHistoryEventType.STUDENT_CARD_ISSUED,
          studentCardId: card.id,
          justification: "Carteirinha gerada pela importacao piloto legado",
          performedByUserId: userId,
        },
      });
      await tx.legacyStudentImport.create({
        data: {
          batchId,
          legacyId,
          studentId: student.id,
          personId: person.id,
          enrollmentId: enrollment.id,
          studentCardId: card.id,
          busAssignmentId,
          legacyCardNumber: item.legacyCardNumber,
          legacyCreatedYear: item.normalized.legacyCreatedYear,
          previousCardSequenceNumber: cardSequence.previous,
          generatedCardNumber: cardNumber,
          importedByUserId: userId,
        },
      });
      await tx.administrativeAuditLog.create({
        data: {
          eventType: AdministrativeAuditEventType.LEGACY_STUDENT_IMPORTED,
          domain: "students",
          recordId: student.id,
          userId,
          metadata: {
            source: SOURCE,
            legacyTable: LEGACY_TABLE,
            legacyId,
            batchId,
            studentId: student.id,
            enrollmentId: enrollment.id,
            studentCardId: card.id,
            cardNumber,
            legacyCardNumber: item.legacyCardNumber,
            legacyCreatedYear: item.normalized.legacyCreatedYear,
            destinationAcademicYear: item.academicYear.year,
          },
        },
      });
      return {
        studentId: student.id,
        generatedCardNumber: cardNumber,
        createdBaseRecords: baseRecords.created,
      };
    });
  }

  private validateFileMetadata(body: AnalyzeLegacyAcademicImportDto) {
    if (body.records.length > MAX_RECORDS) {
      throw new BadRequestException("Importacao limitada a 500 registros por JSON");
    }
    if (body.fileName && !body.fileName.toLowerCase().endsWith(".json")) {
      throw new BadRequestException("Arquivo deve ter extensao .json");
    }
    if (
      body.mimeType &&
      !["application/json", "text/json", ""].includes(body.mimeType)
    ) {
      throw new BadRequestException("MIME do arquivo JSON invalido");
    }
  }

  private resolveDestinationAcademicYear(body: AnalyzeLegacyAcademicImportDto) {
    const destinationAcademicYear = Number(body.destinationAcademicYear);
    if (!Number.isInteger(destinationAcademicYear)) {
      throw new BadRequestException("Ano letivo destino obrigatorio");
    }
    return destinationAcademicYear;
  }

  private prepareRecord(
    record: LegacyAcademicRawRecordDto,
    index: number,
    destinationAcademicYear: number,
  ) {
    const legacyId = Number.isInteger(record.legacy_id) ? record.legacy_id! : null;
    const cpf = normalizeCpf(this.asString(record.cpf));
    const birthDate = this.parseBrazilianDate(this.asString(record.data_nacimento));
    const joinedAt = this.parseIsoDate(this.asString(record.data_cadastro));
    const fullName = this.cleanSpaces(this.asString(record.nome_aluno));
    const observation = this.cleanSpaces(this.asString(record.observacao));
    const legacyCreatedYear = Number(this.asString(record.criado));
    return {
      index,
      legacyId,
      statusRaw: Number(this.asString(record.status)),
      boardRaw: Number(this.asString(record.chapa)),
      cpf,
      birthDate,
      joinedAt,
      fullName,
      nameKey: this.normalizeNameKey(fullName),
      rg: this.optional(this.cleanSpaces(this.asString(record.rg))),
      phone: this.optional(this.asString(record.telefone).replace(/\D/g, "")),
      email: this.optional(this.asString(record.email).trim().toLowerCase()),
      addressStreet: this.cleanSpaces(this.asString(record.endereco)),
      institutionKey: this.normalizeNameKey(this.asString(record.nome_instituicao)),
      institutionRaw: this.cleanSpaces(this.asString(record.nome_instituicao)),
      course: this.cleanSpaces(this.asString(record.curso)),
      courseKey: this.normalizeNameKey(this.asString(record.curso)),
      grade: this.cleanSpaces(this.asString(record.serie)),
      gradeKey: this.normalizeNameKey(this.asString(record.serie)),
      shiftKey: this.normalizeNameKey(this.asString(record.nome_turno)),
      shiftRaw: this.cleanSpaces(this.asString(record.nome_turno)),
      busKey: this.normalizeNameKey(this.asString(record.nome_onibus)),
      busRaw: this.cleanSpaces(this.asString(record.nome_onibus)),
      busCapacity: Number(this.asString(record.capacidade_onibus)),
      legacyCardNumber: this.optional(this.asString(record.numero_carterinha).trim()),
      observation: observation.length > 0 ? observation : null,
      legacyCreatedYear: Number.isInteger(legacyCreatedYear) ? legacyCreatedYear : null,
      destinationAcademicYear,
    };
  }

  private async loadResolutionContext(records: PreparedRecord[]) {
    const [institutions, shifts, buses, academicYears, existingCpfs, imported, cards] =
      await Promise.all([
        this.prisma.institution.findMany(),
        this.prisma.shift.findMany(),
        this.prisma.bus.findMany(),
        this.prisma.academicYear.findMany({
          where: { status: AcademicYearStatus.ACTIVE },
        }),
        this.prisma.person.findMany({
          where: { cpf: { in: records.map((record) => record.cpf).filter(Boolean) } },
          select: { cpf: true, student: { select: { id: true } } },
        }),
        this.prisma.legacyStudentImport.findMany({
          where: {
            source: SOURCE,
            legacyTable: LEGACY_TABLE,
            legacyId: {
              in: records
                .map((record) => record.legacyId)
                .filter((legacyId): legacyId is number => legacyId !== null),
            },
          },
        }),
        this.prisma.studentCard.findMany({
          where: {
            cardNumber: {
              in: records
                .map((record) => record.legacyCardNumber)
                .filter((cardNumber): cardNumber is string => Boolean(cardNumber)),
            },
          },
        }),
      ]);
    return {
      institutions: new Map(institutions.map((record) => [record.normalizedName, record])),
      shifts: new Map(shifts.map((record) => [record.normalizedName, record])),
      buses: new Map(buses.map((record) => [record.normalizedName, record])),
      academicYears: new Map(academicYears.map((record) => [record.year, record])),
      existingCpfs: new Map(existingCpfs.map((record) => [record.cpf, record])),
      imported: new Map(imported.map((record) => [record.legacyId, record])),
      cards: new Map(cards.map((record) => [record.cardNumber, record])),
    };
  }

  private buildPreviewItem(
    record: PreparedRecord,
    context: Awaited<ReturnType<LegacyImportService["loadResolutionContext"]>>,
    duplicateCpfs: Set<string>,
    duplicateLegacyIds: Set<number>,
  ): LegacyPreviewItem {
    const reasons: string[] = [];
    let status: PreviewStatus = "PRONTO";
    const block = (reason: string) => {
      if (status === "JA_IMPORTADO") {
        reasons.push(reason);
        return;
      }
      status = "BLOQUEADO";
      reasons.push(reason);
    };
    const pending = (reason: string) => {
      if (status !== "BLOQUEADO" && status !== "JA_IMPORTADO") {
        status = "PENDENCIA";
      }
      reasons.push(reason);
    };

    if (record.legacyId === null) block("legacy_id obrigatorio");
    if (record.legacyId !== null && context.imported.has(record.legacyId)) {
      status = "JA_IMPORTADO";
      reasons.push("Registro legado ja importado");
    }
    if (record.legacyId !== null && duplicateLegacyIds.has(record.legacyId)) {
      block("legacy_id duplicado dentro do JSON");
    }
    if (record.statusRaw !== 1) block("Sprint aceita somente status = 1");
    if (record.boardRaw !== 0) block("Sprint nao importa diretoria chapa = 1");
    if (!record.cpf) block("CPF obrigatorio");
    else if (!isValidCpf(record.cpf)) block("CPF invalido");
    else if (context.existingCpfs.has(record.cpf)) block("CPF ja existente no ATRETU");
    else if (duplicateCpfs.has(record.cpf)) block("CPF duplicado dentro do JSON");
    if (!record.birthDate) block("Nascimento DD/MM/YYYY invalido");
    if (!record.fullName) block("Nome obrigatorio");
    if (!record.addressStreet) block("Endereco legado ausente");
    const institution = context.institutions.get(record.institutionKey) ?? null;
    const institutionRelation: LegacyRelationPreview = institution
      ? {
          legacyName: record.institutionRaw,
          status: "FOUND",
          message: "Encontrado no ATRETU",
          resolved: institution,
          willCreate: false,
        }
      : {
          legacyName: record.institutionRaw || null,
          status: record.institutionRaw ? "WILL_CREATE" : "BLOCKED",
          message: record.institutionRaw
            ? "NAO EXISTE NO ATRETU; sera criada ao importar"
            : "Instituicao obrigatoria ausente no legado",
          resolved: null,
          willCreate: Boolean(record.institutionRaw),
        };
    if (!record.institutionRaw) block("Instituicao obrigatoria ausente no legado");
    else if (!institution) pending("Instituicao nao existe no ATRETU; sera criada ao importar");

    const shift = context.shifts.get(record.shiftKey) ?? null;
    const shiftRelation: LegacyRelationPreview = shift
      ? {
          legacyName: record.shiftRaw,
          status: "FOUND",
          message: "Encontrado no ATRETU",
          resolved: shift,
          willCreate: false,
        }
      : {
          legacyName: record.shiftRaw || null,
          status: record.shiftRaw ? "WILL_CREATE" : "BLOCKED",
          message: record.shiftRaw
            ? "NAO EXISTE NO ATRETU; sera criado ao importar"
            : "Turno obrigatorio ausente no legado",
          resolved: null,
          willCreate: Boolean(record.shiftRaw),
        };
    if (!record.shiftRaw) block("Turno obrigatorio ausente no legado");
    else if (!shift) pending("Turno nao existe no ATRETU; sera criado ao importar");

    const bus = record.busKey ? context.buses.get(record.busKey) ?? null : null;
    const hasValidBusCapacity =
      Number.isInteger(record.busCapacity) && record.busCapacity > 0;
    let busRelation: LegacyBusRelationPreview = {
      legacyName: record.busRaw || null,
      status: "FOUND",
      message: record.busRaw ? "Encontrado no ATRETU" : "Sem onibus no legado",
      resolved: bus,
      willCreate: false,
      legacyCapacity: hasValidBusCapacity ? record.busCapacity : null,
      resolvedCapacity: bus?.capacity ?? null,
    };
    if (record.busKey && !bus) {
      busRelation = {
        legacyName: record.busRaw,
        status: hasValidBusCapacity ? "WILL_CREATE" : "BLOCKED",
        message: hasValidBusCapacity
          ? `NAO EXISTE NO ATRETU; sera criado ao importar com capacidade ${record.busCapacity}`
          : "Onibus nao existe no ATRETU e capacidade legada e invalida",
        resolved: null,
        willCreate: hasValidBusCapacity,
        legacyCapacity: hasValidBusCapacity ? record.busCapacity : null,
        resolvedCapacity: null,
      };
      if (hasValidBusCapacity) pending("Onibus nao existe no ATRETU; sera criado ao importar");
      else block("Onibus nao existe no ATRETU e capacidade legada e invalida");
    }
    if (bus && hasValidBusCapacity && bus.capacity !== record.busCapacity) {
      busRelation = {
        ...busRelation,
        status: "DIVERGENCE",
        message: "Capacidade divergente; cadastro existente sera reutilizado",
      };
      pending("Capacidade do onibus legado diverge do ATRETU");
    }
    const academicYear =
      context.academicYears.get(record.destinationAcademicYear) ?? null;
    const academicYearRelation: LegacyRelationPreview = academicYear
      ? {
          legacyName: String(record.destinationAcademicYear),
          status: "FOUND",
          message: "Encontrado no ATRETU",
          resolved: { id: academicYear.id, name: String(academicYear.year) },
          willCreate: false,
        }
      : {
          legacyName: String(record.destinationAcademicYear),
          status: "BLOCKED",
          message: "Ano letivo nao possui correspondencia ativa",
          resolved: null,
          willCreate: false,
        };
    if (!academicYear) block("Ano letivo nao possui correspondencia ativa");
    if (!record.course || !record.grade) block("Curso/serie obrigatorios");
    if (record.legacyCardNumber && context.cards.has(record.legacyCardNumber)) {
      pending("Numero de carteirinha legado conflita no ATRETU");
    }
    if (record.observation && SUSPICIOUS_OBSERVATION.test(record.observation)) {
      pending("Observacao sugere desligamento, mudanca ou inativacao");
    }
    if (reasons.length === 0) reasons.push("Apto para importacao piloto");

    const finalStatus: PreviewStatus = status;
    const canImport = (["PRONTO", "PENDENCIA"] as PreviewStatus[]).includes(
      finalStatus,
    );
    const requiresBaseRecordCreation =
      institutionRelation.willCreate || shiftRelation.willCreate || busRelation.willCreate;
    return {
      index: record.index,
      legacyId: record.legacyId,
      name: record.fullName,
      cpf: record.cpf,
      cpfMasked: record.cpf ? maskCpf(record.cpf) : "",
      legacyCreatedYear: record.legacyCreatedYear,
      destinationAcademicYear: record.destinationAcademicYear,
      institutionLegacy: record.institutionRaw,
      institution,
      course: record.course,
      grade: record.grade,
      shiftLegacy: record.shiftRaw,
      shift,
      busLegacy: record.busRaw || null,
      bus,
      legacyCardNumber: record.legacyCardNumber ?? null,
      card: {
        legacyNumber: record.legacyCardNumber ?? null,
        hasConflict: Boolean(record.legacyCardNumber && context.cards.has(record.legacyCardNumber)),
        canPreserve: false,
        needsAtretuNumber: true,
        reason: "Importacao piloto gera numero ATRETU para preservar a sequencia anual",
      },
      observation: record.observation,
      academicYear,
      relations: {
        institution: institutionRelation,
        shift: shiftRelation,
        bus: busRelation,
        academicYear: academicYearRelation,
      },
      requiresBaseRecordCreation,
      status: finalStatus,
      canImport,
      reasons,
      normalized: record,
    };
  }

  private summarize(items: Array<{ status: PreviewStatus }>) {
    return items.reduce(
      (summary, item) => {
        summary[item.status] += 1;
        return summary;
      },
      { PRONTO: 0, PENDENCIA: 0, BLOQUEADO: 0, JA_IMPORTADO: 0 },
    );
  }

  private async ensureLegacyNotImported(tx: Prisma.TransactionClient, legacyId: number) {
    const existing = await tx.legacyStudentImport.findUnique({
      where: {
        source_legacyTable_legacyId: {
          source: SOURCE,
          legacyTable: LEGACY_TABLE,
          legacyId,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Registro legado ja importado");
    }
  }

  private assertImportableRequirements(
    item: LegacyPreviewItem,
  ): asserts item is LegacyPreviewItem & {
    academicYear: { id: string; year: number };
  } {
    if (!item.academicYear) {
      throw new BadRequestException(
        "Ano letivo nao possui correspondencia ativa",
      );
    }
    if (!item.institution && !item.relations.institution.willCreate) {
      throw new BadRequestException("Instituicao nao encontrada no ATRETU");
    }
    if (!item.shift && !item.relations.shift.willCreate) {
      throw new BadRequestException("Turno nao encontrado no ATRETU");
    }
  }

  private async resolveBaseRecordsForImport(
    tx: Prisma.TransactionClient,
    item: LegacyPreviewItem & { academicYear: { id: string; year: number } },
    createMissing: boolean,
  ) {
    const created: CreatedBaseRecords = { institutions: [], shifts: [], buses: [] };
    const institution = await this.findOrCreateInstitution(tx, item, createMissing);
    if (institution.created) created.institutions.push(institution.record.id);
    const shift = await this.findOrCreateShift(tx, item, createMissing);
    if (shift.created) created.shifts.push(shift.record.id);
    const bus = await this.findOrCreateBus(tx, item, createMissing);
    if (bus.created && bus.record) created.buses.push(bus.record.id);
    return {
      institution: institution.record,
      shift: shift.record,
      bus: bus.record,
      created,
    };
  }

  private async findOrCreateInstitution(
    tx: Prisma.TransactionClient,
    item: LegacyPreviewItem,
    createMissing: boolean,
  ) {
    const existing = item.institution
      ? await tx.institution.findUnique({ where: { id: item.institution.id } })
      : await tx.institution.findUnique({
          where: { normalizedName: item.normalized.institutionKey },
        });
    if (existing) return { record: existing, created: false };
    if (!createMissing || !item.normalized.institutionRaw) {
      throw new BadRequestException("Instituicao nao encontrada no ATRETU");
    }
    const created = await tx.institution.create({
      data: {
        name: item.normalized.institutionRaw,
        normalizedName: item.normalized.institutionKey,
      },
    });
    return { record: created, created: true };
  }

  private async findOrCreateShift(
    tx: Prisma.TransactionClient,
    item: LegacyPreviewItem,
    createMissing: boolean,
  ) {
    const existing = item.shift
      ? await tx.shift.findUnique({ where: { id: item.shift.id } })
      : await tx.shift.findUnique({ where: { normalizedName: item.normalized.shiftKey } });
    if (existing) return { record: existing, created: false };
    if (!createMissing || !item.normalized.shiftRaw) {
      throw new BadRequestException("Turno nao encontrado no ATRETU");
    }
    const created = await tx.shift.create({
      data: {
        name: item.normalized.shiftRaw,
        normalizedName: item.normalized.shiftKey,
      },
    });
    return { record: created, created: true };
  }

  private async findOrCreateBus(
    tx: Prisma.TransactionClient,
    item: LegacyPreviewItem,
    createMissing: boolean,
  ) {
    if (!item.normalized.busRaw) {
      return { record: null, created: false };
    }
    const existing = item.bus
      ? await tx.bus.findUnique({ where: { id: item.bus.id } })
      : await tx.bus.findUnique({ where: { normalizedName: item.normalized.busKey } });
    if (existing) return { record: existing, created: false };
    if (
      !createMissing ||
      !Number.isInteger(item.normalized.busCapacity) ||
      item.normalized.busCapacity <= 0
    ) {
      throw new BadRequestException("Onibus nao encontrado no ATRETU");
    }
    const created = await tx.bus.create({
      data: {
        name: item.normalized.busRaw,
        normalizedName: item.normalized.busKey,
        capacity: item.normalized.busCapacity,
      },
    });
    return { record: created, created: true };
  }

  private mergeCreatedBaseRecords(
    target: CreatedBaseRecords,
    source: CreatedBaseRecords,
  ) {
    for (const key of ["institutions", "shifts", "buses"] as const) {
      for (const id of source[key]) {
        if (!target[key].includes(id)) target[key].push(id);
      }
    }
  }

  private parseCreatedBaseRecords(value: Prisma.JsonValue): CreatedBaseRecords {
    const record = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    return {
      institutions: Array.isArray(record.institutions)
        ? record.institutions.filter((id): id is string => typeof id === "string")
        : [],
      shifts: Array.isArray(record.shifts)
        ? record.shifts.filter((id): id is string => typeof id === "string")
        : [],
      buses: Array.isArray(record.buses)
        ? record.buses.filter((id): id is string => typeof id === "string")
        : [],
    };
  }

  private parsePersistedImportProgress(
    value: Prisma.JsonValue,
  ): PersistedImportProgress {
    const record = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    const status = typeof record.status === "string" &&
      ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"].includes(record.status)
      ? record.status as LegacyImportJobStatus
      : undefined;
    const results = Array.isArray(record.results)
      ? record.results.filter((item): item is LegacyImportJobResult => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return false;
          const candidate = item as Record<string, unknown>;
          return typeof candidate.status === "string";
        })
      : undefined;
    return {
      jobId: typeof record.jobId === "string" ? record.jobId : undefined,
      status,
      processed: this.asOptionalNumber(record.processed),
      total: this.asOptionalNumber(record.total),
      imported: this.asOptionalNumber(record.imported),
      failed: this.asOptionalNumber(record.failed),
      ignored: this.asOptionalNumber(record.ignored),
      percent: this.asOptionalNumber(record.percent),
      chunkSize: this.asOptionalNumber(record.chunkSize),
      startedAt: typeof record.startedAt === "string" ? record.startedAt : undefined,
      finishedAt:
        typeof record.finishedAt === "string" || record.finishedAt === null
          ? record.finishedAt
          : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      results,
    };
  }

  private async deleteCreatedBaseRecordsIfUnused(
    tx: Prisma.TransactionClient,
    created: CreatedBaseRecords,
  ) {
    for (const busId of created.buses) {
      const usage = await tx.bus.findUnique({
        where: { id: busId },
        select: {
          _count: {
            select: {
              assignments: true,
              eventsFrom: true,
              eventsTo: true,
              studentHistoryEvents: true,
            },
          },
        },
      });
      if (
        usage &&
        usage._count.assignments === 0 &&
        usage._count.eventsFrom === 0 &&
        usage._count.eventsTo === 0 &&
        usage._count.studentHistoryEvents === 0
      ) {
        await tx.bus.delete({ where: { id: busId } });
      }
    }
    for (const shiftId of created.shifts) {
      const usage = await tx.shift.findUnique({
        where: { id: shiftId },
        select: {
          _count: {
            select: {
              enrollments: true,
              preRegistrations: true,
              bankSlipIssueBatches: true,
            },
          },
        },
      });
      if (
        usage &&
        usage._count.enrollments === 0 &&
        usage._count.preRegistrations === 0 &&
        usage._count.bankSlipIssueBatches === 0
      ) {
        await tx.shift.delete({ where: { id: shiftId } });
      }
    }
    for (const institutionId of created.institutions) {
      const usage = await tx.institution.findUnique({
        where: { id: institutionId },
        select: {
          _count: {
            select: {
              enrollments: true,
              preRegistrations: true,
              bankSlipIssueBatches: true,
              users: true,
            },
          },
        },
      });
      if (
        usage &&
        usage._count.enrollments === 0 &&
        usage._count.preRegistrations === 0 &&
        usage._count.bankSlipIssueBatches === 0 &&
        usage._count.users === 0
      ) {
        await tx.institution.delete({ where: { id: institutionId } });
      }
    }
  }

  private async nextCardSequence(tx: Prisma.TransactionClient, academicYearId: string) {
    await tx.cardSequence.upsert({
      where: { academicYearId },
      create: { academicYearId, lastSequenceNumber: 0 },
      update: {},
    });
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM card_sequences
      WHERE academic_year_id = ${academicYearId}::uuid
      FOR UPDATE
    `;
    const sequence = await tx.cardSequence.findUnique({ where: { academicYearId } });
    if (!sequence) throw new BadRequestException("Sequencia de carteirinha ausente");
    const previous = sequence.lastSequenceNumber;
    const next = previous + 1;
    await tx.cardSequence.update({
      where: { id: sequence.id },
      data: { lastSequenceNumber: next },
    });
    return { previous, next };
  }

  private async assertRollbackSafe(tx: Prisma.TransactionClient, studentId: string) {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      include: {
        _count: {
          select: {
            documents: true,
            invoices: true,
            officialDocuments: true,
            boardMemberships: true,
            manualFinancialMovements: true,
            approvedPreRegistrations: true,
          },
        },
      },
    });
    if (!student) return;
    const counts = student._count;
    const hasExternalData =
      counts.documents > 0 ||
      counts.invoices > 0 ||
      counts.officialDocuments > 0 ||
      counts.boardMemberships > 0 ||
      counts.manualFinancialMovements > 0 ||
      counts.approvedPreRegistrations > 0;
    if (hasExternalData) {
      throw new ConflictException(
        "Rollback bloqueado: academico importado recebeu dados fora do batch",
      );
    }
  }

  private async reconcileCardSequenceAfterRollback(
    tx: Prisma.TransactionClient,
    input: { academicYearId: string; previous: number; sequenceNumber: number },
  ) {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM card_sequences
      WHERE academic_year_id = ${input.academicYearId}::uuid
      FOR UPDATE
    `;
    await tx.cardSequence.updateMany({
      where: {
        academicYearId: input.academicYearId,
        lastSequenceNumber: input.sequenceNumber,
      },
      data: { lastSequenceNumber: input.previous },
    });
  }

  private parseBrazilianDate(value: string) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)
    ) {
      return null;
    }
    return date;
  }

  private parseIsoDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
    const date = new Date(`${value.trim()}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private findDuplicates<T extends string | number>(values: T[]) {
    const seen = new Set<T>();
    const duplicates = new Set<T>();
    for (const value of values) {
      if (!value) continue;
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    }
    return duplicates;
  }

  private normalizeNameKey(value: string) {
    return this.cleanSpaces(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private cleanSpaces(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  private asString(value: unknown) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  private asOptionalNumber(value: unknown) {
    return Number.isFinite(value) ? Number(value) : undefined;
  }

  private optional(value?: string | null) {
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }
}
