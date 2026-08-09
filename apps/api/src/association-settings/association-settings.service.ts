import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  type AssociationSettings,
  Prisma,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import type { AuthUser } from "../users/users.service.js";
import type { UpdateAssociationSettingsDto } from "./dto/association-settings.dto.js";

export const ASSOCIATION_SETTINGS_ID = "association-settings";
const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const SEEDED_LOGO_STORAGE_KEY = "association/logo/seed-atretu-logo.png";

const LEGACY_ASSOCIATION_DATA = {
  city: "Terra Rica",
  cnpj: "49.682.667/0001-00",
  displayName: "ATRETU",
  district: "Centro",
  email: "atretu2022@gmail.com",
  legalName:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
  number: "1276",
  postalCode: "87890-000",
  primaryPhone: "44 99941-3565",
  secondaryPhone: "44 99144-1176",
  state: "PR",
  street: "Av. Claudio Domingos Soletti",
  website: null,
} as const;

export type AssociationSnapshot = {
  legalName: string;
  displayName: string | null;
  cnpj: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string;
  website: string | null;
  logoStorageKey: string | null;
  logoContentType: string | null;
  logoFileName: string | null;
  logoSizeBytes: number | null;
  footerText: string;
  issuePlace: string;
  issuePlaceWithState: string;
};

@Injectable()
export class AssociationSettingsService {
  private cachedSnapshot: AssociationSnapshot | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentStorageService)
    private readonly storage: DocumentStorageService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  async getSettings() {
    const settings = await this.ensureSettings();
    await this.ensureSeededLogo(settings.logoStorageKey);
    const refreshed = await this.ensureSettings();
    return this.toResponse(refreshed);
  }

  async updateSettings(input: UpdateAssociationSettingsDto, currentUser: AuthUser) {
    const previous = await this.ensureSettings();
    const data = this.normalizeSettingsInput(input);
    const changedFields = this.changedFields(previous, data);
    const updated = await this.prisma.associationSettings.update({
      where: { id: ASSOCIATION_SETTINGS_ID },
      data: {
        ...data,
        updatedByUserId: currentUser.id,
      },
    });
    this.cachedSnapshot = null;
    if (changedFields.length > 0) {
      await this.audit.record({
        eventType: AdministrativeAuditEventType.ASSOCIATION_SETTINGS_UPDATED,
        userId: currentUser.id,
        domain: "association_settings",
        recordId: currentUser.id,
        metadata: {
          changedFields,
          after: this.auditValues(updated),
          before: this.auditValues(previous),
        },
      });
    }
    return this.toResponse(updated);
  }

  async updateLogo(file: Express.Multer.File | undefined, currentUser: AuthUser) {
    if (!file) {
      throw new BadRequestException("Envie a logo oficial.");
    }
    if (file.size <= 0 || file.size > LOGO_MAX_SIZE_BYTES) {
      throw new BadRequestException("Logo excede o limite de 2 MB.");
    }
    const detected = this.detectLogoType(file);
    const storageKey = `association/logo/${new Date()
      .toISOString()
      .slice(0, 10)}/${randomUUID()}.${detected.extension}`;
    await this.storage.write(storageKey, file.buffer);
    const previous = await this.ensureSettings();
    const updated = await this.prisma.associationSettings.update({
      where: { id: ASSOCIATION_SETTINGS_ID },
      data: {
        logoContentType: detected.mimeType,
        logoFileName: file.originalname.slice(0, 180),
        logoSizeBytes: file.size,
        logoStorageKey: storageKey,
        updatedByUserId: currentUser.id,
      },
    });
    this.cachedSnapshot = null;
    await this.audit.record({
      eventType: AdministrativeAuditEventType.ASSOCIATION_LOGO_UPDATED,
      userId: currentUser.id,
      domain: "association_settings",
      recordId: currentUser.id,
      metadata: {
        after: {
          logoContentType: updated.logoContentType,
          logoFileName: updated.logoFileName,
          logoSizeBytes: updated.logoSizeBytes,
          logoStorageKey: updated.logoStorageKey,
        },
        before: {
          logoContentType: previous.logoContentType,
          logoFileName: previous.logoFileName,
          logoSizeBytes: previous.logoSizeBytes,
          logoStorageKey: previous.logoStorageKey,
        },
      },
    });
    return this.toResponse(updated);
  }

  async getLogoFile(storageKey?: string | null) {
    const settings = await this.ensureSettings();
    await this.ensureSeededLogo(settings.logoStorageKey);
    const refreshed = await this.ensureSettings();
    const key = storageKey || refreshed.logoStorageKey;
    if (!key) {
      throw new NotFoundException("Logo oficial nao configurada.");
    }
    if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
      throw new BadRequestException("Referencia da logo invalida.");
    }
    return {
      buffer: await this.storage.read(key),
      mimeType:
        storageKey === refreshed.logoStorageKey
          ? refreshed.logoContentType || "image/png"
          : this.mimeFromStorageKey(key),
    };
  }

  async getSnapshotForDocuments(): Promise<AssociationSnapshot> {
    const settings = await this.ensureSettings();
    await this.ensureSeededLogo(settings.logoStorageKey);
    const refreshed = await this.ensureSettings();
    const snapshot = this.toSnapshot(refreshed);
    this.assertSnapshotReady(snapshot);
    this.cachedSnapshot = snapshot;
    return snapshot;
  }

  async readLogoForSnapshot(snapshot: AssociationSnapshot | undefined | null) {
    const key = snapshot?.logoStorageKey;
    if (!key) {
      return null;
    }
    try {
      return await this.storage.read(key);
    } catch {
      return null;
    }
  }

  legacySnapshot(): AssociationSnapshot {
    return this.toSnapshot({
      ...LEGACY_ASSOCIATION_DATA,
      complement: null,
      logoContentType: "image/png",
      logoFileName: "atretu-logo.png",
      logoSizeBytes: null,
      logoStorageKey: SEEDED_LOGO_STORAGE_KEY,
    });
  }

  private async ensureSettings() {
    return this.prisma.associationSettings.upsert({
      where: { id: ASSOCIATION_SETTINGS_ID },
      update: {},
      create: {
        id: ASSOCIATION_SETTINGS_ID,
        ...LEGACY_ASSOCIATION_DATA,
      },
    });
  }

  private async ensureSeededLogo(currentStorageKey: string | null) {
    if (currentStorageKey) {
      return;
    }
    const source = this.defaultLogoPath();
    if (!existsSync(source)) {
      return;
    }
    const buffer = readFileSync(source);
    try {
      await this.storage.write(SEEDED_LOGO_STORAGE_KEY, buffer);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    await this.prisma.associationSettings.update({
      where: { id: ASSOCIATION_SETTINGS_ID },
      data: {
        logoContentType: "image/png",
        logoFileName: "atretu-logo.png",
        logoSizeBytes: buffer.byteLength,
        logoStorageKey: SEEDED_LOGO_STORAGE_KEY,
      },
    });
    this.cachedSnapshot = null;
  }

  private normalizeSettingsInput(input: UpdateAssociationSettingsDto) {
    const normalized = {
      city: this.required(input.city, "Cidade obrigatoria."),
      cnpj: this.validateCnpj(input.cnpj),
      complement: this.optional(input.complement),
      displayName: this.optional(input.displayName),
      district: this.required(input.district, "Bairro obrigatorio."),
      email: this.validateEmail(input.email),
      legalName: this.required(input.legalName, "Nome institucional obrigatorio."),
      number: this.required(input.number, "Numero obrigatorio."),
      postalCode: this.validatePostalCode(input.postalCode),
      primaryPhone: this.validatePhone(input.primaryPhone, "Telefone principal invalido."),
      secondaryPhone: input.secondaryPhone
        ? this.validatePhone(input.secondaryPhone, "Telefone secundario invalido.")
        : null,
      state: this.validateState(input.state),
      street: this.required(input.street, "Logradouro obrigatorio."),
      website: this.optional(input.website),
    };
    return normalized;
  }

  private required(value: string | undefined, message: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException(message);
    }
    return trimmed;
  }

  private optional(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private validateCnpj(value: string) {
    const trimmed = this.required(value, "CNPJ obrigatorio.");
    if (!/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(trimmed)) {
      throw new BadRequestException("CNPJ invalido.");
    }
    return trimmed;
  }

  private validatePostalCode(value: string) {
    const trimmed = this.required(value, "CEP obrigatorio.");
    if (!/^\d{5}-?\d{3}$/.test(trimmed)) {
      throw new BadRequestException("CEP invalido.");
    }
    return trimmed;
  }

  private validateState(value: string) {
    const trimmed = this.required(value, "UF obrigatoria.").toUpperCase();
    if (!/^[A-Z]{2}$/.test(trimmed)) {
      throw new BadRequestException("UF invalida.");
    }
    return trimmed;
  }

  private validateEmail(value: string) {
    const trimmed = this.required(value, "E-mail obrigatorio.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new BadRequestException("E-mail invalido.");
    }
    return trimmed;
  }

  private validatePhone(value: string, message: string) {
    const trimmed = this.required(value, message);
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      throw new BadRequestException(message);
    }
    return trimmed;
  }

  private detectLogoType(file: Express.Multer.File) {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
    if (!allowedExtensions.has(extension)) {
      throw new BadRequestException("Formato de logo nao permitido.");
    }
    const buffer = file.buffer;
    const isPng =
      buffer.length > 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp =
      buffer.length > 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
    const detected = isPng
      ? { extension: "png", mimeType: "image/png" }
      : isJpeg
        ? { extension: "jpg", mimeType: "image/jpeg" }
        : isWebp
          ? { extension: "webp", mimeType: "image/webp" }
          : null;
    if (!detected || file.mimetype !== detected.mimeType) {
      throw new BadRequestException("MIME real da logo nao corresponde ao arquivo.");
    }
    if (extension === "jpeg" && detected.extension === "jpg") {
      return detected;
    }
    if (extension !== detected.extension) {
      throw new BadRequestException("Extensao da logo nao corresponde ao conteudo.");
    }
    return detected;
  }

  private toResponse(settings: AssociationSettings) {
    const snapshot = this.toSnapshot(settings);
    return {
      ...snapshot,
      createdAt: settings.createdAt.toISOString(),
      id: settings.id,
      logoUrl: snapshot.logoStorageKey
        ? `/admin/association-settings/logo?key=${encodeURIComponent(snapshot.logoStorageKey)}`
        : null,
      updatedAt: settings.updatedAt.toISOString(),
      updatedByUserId: settings.updatedByUserId,
    };
  }

  private toSnapshot(settings: {
    city: string;
    cnpj: string;
    complement: string | null;
    displayName: string | null;
    district: string;
    email: string;
    legalName: string;
    logoContentType: string | null;
    logoFileName: string | null;
    logoSizeBytes: number | null;
    logoStorageKey: string | null;
    number: string;
    postalCode: string;
    primaryPhone: string;
    secondaryPhone: string | null;
    state: string;
    street: string;
    website: string | null;
  }): AssociationSnapshot {
    const address = [
      `${settings.street}, ${settings.number}`,
      settings.complement,
      settings.district,
      `CEP ${settings.postalCode}`,
      settings.city,
      settings.state,
    ].filter(Boolean);
    const phones = [settings.primaryPhone, settings.secondaryPhone]
      .filter(Boolean)
      .join(" ");
    return {
      city: settings.city,
      cnpj: settings.cnpj,
      complement: settings.complement,
      displayName: settings.displayName,
      district: settings.district,
      email: settings.email,
      footerText: `${settings.legalName} CNPJ ${settings.cnpj} | ${address.join(" ")} FONE:${phones} email - ${settings.email}`,
      issuePlace: settings.city,
      issuePlaceWithState: `${settings.city} - ${settings.state}`,
      legalName: settings.legalName,
      logoContentType: settings.logoContentType,
      logoFileName: settings.logoFileName,
      logoSizeBytes: settings.logoSizeBytes,
      logoStorageKey: settings.logoStorageKey,
      number: settings.number,
      postalCode: settings.postalCode,
      primaryPhone: settings.primaryPhone,
      secondaryPhone: settings.secondaryPhone,
      state: settings.state,
      street: settings.street,
      website: settings.website,
    };
  }

  private assertSnapshotReady(snapshot: AssociationSnapshot) {
    if (!snapshot.legalName || !snapshot.cnpj || !snapshot.city || !snapshot.state) {
      throw new BadRequestException(
        "Configuracao institucional incompleta para emitir documentos oficiais.",
      );
    }
  }

  private changedFields(
    previous: AssociationSettings,
    next: ReturnType<AssociationSettingsService["normalizeSettingsInput"]>,
  ) {
    return Object.entries(next)
      .filter(([key, value]) => previous[key as keyof typeof previous] !== value)
      .map(([key]) => key);
  }

  private auditValues(settings: AssociationSettings) {
    return {
      city: settings.city,
      cnpj: settings.cnpj,
      district: settings.district,
      email: settings.email,
      legalName: settings.legalName,
      number: settings.number,
      postalCode: settings.postalCode,
      primaryPhone: settings.primaryPhone,
      secondaryPhone: settings.secondaryPhone,
      state: settings.state,
      street: settings.street,
    };
  }

  private mimeFromStorageKey(key: string) {
    if (key.endsWith(".webp")) {
      return "image/webp";
    }
    if (key.endsWith(".jpg") || key.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    return "image/png";
  }

  private defaultLogoPath() {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(currentDir, "../student-cards/assets/atretu-logo.png");
  }
}
