import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  StudentCardType,
  StudentDocumentStatus,
  StudentDocumentType,
} from "@prisma/client";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AssociationSettingsService,
  type AssociationSnapshot,
} from "../association-settings/association-settings.service.js";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import { FileDisposition } from "../documents/dto/documents.dto.js";
import { scopedInstitutionFilter } from "../auth/institution-scope.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser } from "../users/users.service.js";

// PDFKit uses points. 360 x 230 px at 96 DPI equals 270 x 172.5 pt.
const CARD = {
  width: 270,
  height: 172.5,
};
const PHOTO = {
  width: 104,
  height: 124,
};
export const STUDENT_CARD_PDF_LAYOUT = {
  card: CARD,
  photo: PHOTO,
  placeholderLabel: "Sem foto",
} as const;
const COLORS = {
  boardBlue: "#366092",
  blue: "#174A7C",
  blueDark: "#0F2E4D",
  red: "#C83D3D",
  ink: "#172033",
  muted: "#526173",
  line: "#D8E0EA",
  paper: "#F7FAFC",
};

@Injectable()
export class StudentCardPdfService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentStorageService)
    private readonly storage: DocumentStorageService,
    @Inject(AssociationSettingsService)
    private readonly associationSettings: AssociationSettingsService,
  ) {}

  async generate(
    cardId: string,
    disposition: FileDisposition,
    currentUser?: AuthUser,
  ) {
    const institutionFilter = scopedInstitutionFilter(currentUser);
    const card = await this.prisma.studentCard.findFirst({
      where: {
        id: cardId,
        ...(institutionFilter
          ? { enrollment: { institutionId: institutionFilter } }
          : {}),
      },
      include: this.cardInclude(),
    });
    if (!card) {
      throw new NotFoundException("Carteirinha nao encontrada");
    }

    const photo = await this.prisma.studentDocument.findFirst({
      where: {
        studentId: card.studentId,
        documentType: StudentDocumentType.PHOTO,
        status: StudentDocumentStatus.ACTIVE,
      },
    });
    const photoBuffer = photo ? await this.storage.read(photo.storageKey) : null;
    const { logoBuffer, snapshot } = await this.resolveAssociationIdentity(card);
    const normalizedLogo = await this.normalizeLogoForPdf(logoBuffer);
    const buffer = await this.renderPdf(card, photoBuffer, normalizedLogo, snapshot);
    return {
      bytes: buffer,
      filename: this.filename(card),
      sizeBytes: buffer.byteLength,
      disposition,
    };
  }

  private cardInclude() {
    return {
      student: { include: { person: true } },
      enrollment: {
        include: {
          academicYear: true,
          institution: true,
          shift: true,
        },
      },
      academicYear: true,
    } satisfies Prisma.StudentCardInclude;
  }

  private renderPdf(
    card: StudentCardPdfRecord,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
    snapshot: AssociationSnapshot,
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: [CARD.width, CARD.height],
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: `Carteirinha ${snapshot.displayName ?? snapshot.legalName}`,
          Author: snapshot.legalName,
          Creator: snapshot.displayName ?? snapshot.legalName,
          Producer: snapshot.displayName ?? snapshot.legalName,
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      this.drawPage(doc, card, photoBuffer, logoBuffer);
      doc.end();
    });
  }

  private drawPage(
    doc: PDFKit.PDFDocument,
    card: StudentCardPdfRecord,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
  ) {
    this.drawCard(doc, 0, 0, card, photoBuffer, logoBuffer);
  }

  private drawCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    card: StudentCardPdfRecord,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
  ) {
    if (card.cardType === StudentCardType.BOARD_MEMBER) {
      this.drawBoardMemberCard(doc, x, y, card, photoBuffer, logoBuffer);
      return;
    }
    this.drawStudentCard(doc, x, y, card, photoBuffer, logoBuffer);
  }

  private drawStudentCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    card: StudentCardPdfRecord,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
  ) {
    doc
      .rect(x, y, CARD.width, CARD.height)
      .fillAndStroke("#FFFFFF", COLORS.ink);

    const leftWidth = 108;
    const gap = 8;
    const photoX = x + 6;
    const photoY = y + 6;
    const photoWidth = leftWidth - 9;
    const photoHeight = 120;
    doc
      .rect(photoX - 0.5, photoY - 0.5, photoWidth + 1, photoHeight + 1)
      .strokeColor("#D0D0D0")
      .lineWidth(0.5)
      .stroke();
    this.drawPhoto(doc, photoBuffer, photoX, photoY, photoWidth, photoHeight);

    const rightX = x + leftWidth + gap;
    const rightWidth = CARD.width - leftWidth - gap - 9;
    this.drawLogo(doc, rightX + 15, y + 10, logoBuffer, 92, 58);
    this.drawCenteredBlock(doc, card.student.person.fullName, rightX, y + 73, rightWidth, {
      maxHeight: 23,
      maxFontSize: 10,
      minFontSize: 6.5,
      font: "Helvetica-Bold",
      color: COLORS.ink,
    });
    this.drawCenteredLine(doc, this.formatPhone(card.student.person.phone), rightX, y + 100, rightWidth, {
      font: "Helvetica-Bold",
      fontSize: 9,
      color: COLORS.ink,
    });
    this.drawCenteredBlock(doc, card.enrollment.course, rightX, y + 116, rightWidth, {
      maxHeight: 19,
      maxFontSize: 8,
      minFontSize: 5.7,
      font: "Helvetica-Bold",
      color: COLORS.ink,
    });
    this.drawCenteredBlock(doc, card.enrollment.institution.name, rightX, y + 140, rightWidth, {
      maxHeight: 18,
      maxFontSize: 7.3,
      minFontSize: 5.2,
      font: "Helvetica-Bold",
      color: COLORS.ink,
    });

    this.drawCenteredLine(doc, card.cardNumber, x + 7, y + 131, leftWidth - 10, {
      font: "Helvetica",
      fontSize: 11,
      color: COLORS.ink,
    });
    this.drawCenteredFitLine(doc, card.enrollment.shift.name.toUpperCase(), x + 7, y + 148, leftWidth - 10, {
      font: "Helvetica-Bold",
      maxFontSize: 8.2,
      minFontSize: 5.7,
      color: COLORS.ink,
    });
    this.drawValidity(doc, x + 4, y + CARD.height - 10, leftWidth - 4, card.academicYear.year, COLORS.ink);
  }

  private drawBoardMemberCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    card: StudentCardPdfRecord,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
  ) {
    doc
      .rect(x, y, CARD.width, CARD.height)
      .fillAndStroke(COLORS.boardBlue, COLORS.ink);

    const leftWidth = 108;
    const photoX = x + 6;
    const photoY = y + 6;
    const photoWidth = leftWidth - 9;
    const photoHeight = 119;
    doc
      .rect(photoX - 0.5, photoY - 0.5, photoWidth + 1, photoHeight + 1)
      .fillAndStroke("#FFFFFF", "#FFFFFF");
    this.drawPhoto(doc, photoBuffer, photoX, photoY, photoWidth, photoHeight);

    const rightX = x + leftWidth + 7;
    const rightWidth = CARD.width - leftWidth - 16;
    doc.rect(rightX + 3, y + 4.5, rightWidth - 6, 68).fill("#FFFFFF");
    this.drawLogo(doc, rightX + 15, y + 9, logoBuffer, rightWidth - 30, 58);
    this.drawCenteredBlock(doc, card.student.person.fullName, rightX, y + 78, rightWidth, {
      maxHeight: 27,
      maxFontSize: 10,
      minFontSize: 6.5,
      font: "Helvetica-Bold",
      color: "#FFFFFF",
    });
    this.drawCenteredLine(doc, this.formatPhone(card.student.person.phone), rightX, y + 108, rightWidth, {
      font: "Helvetica-Bold",
      fontSize: 9,
      color: "#FFFFFF",
    });
    this.drawCenteredBlock(doc, card.enrollment.course, rightX, y + 124, rightWidth, {
      maxHeight: 18,
      maxFontSize: 7.6,
      minFontSize: 5.4,
      font: "Helvetica-Bold",
      color: "#FFFFFF",
    });
    this.drawCenteredBlock(doc, card.enrollment.institution.name, rightX, y + 145, rightWidth, {
      maxHeight: 16,
      maxFontSize: 6.8,
      minFontSize: 5,
      font: "Helvetica-Bold",
      color: "#FFFFFF",
    });

    this.drawCenteredLine(doc, card.cardNumber, x + 7, y + 132, leftWidth - 10, {
      font: "Helvetica-Bold",
      fontSize: 11.2,
      color: "#FFFFFF",
    });
    this.drawCenteredFitLine(doc, card.enrollment.shift.name.toUpperCase(), x + 7, y + 150, leftWidth - 10, {
      font: "Helvetica-Bold",
      maxFontSize: 8.2,
      minFontSize: 5.7,
      color: "#FFFFFF",
    });
    this.drawValidity(doc, x + 4, y + CARD.height - 10, leftWidth - 4, card.academicYear.year, "#FFFFFF");
  }

  private drawLogo(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    logoBuffer: Buffer,
    width = 57,
    height = 19.5,
  ) {
    doc.image(logoBuffer, x, y, {
      fit: [width, height],
      align: "center",
      valign: "center",
    });
  }

  private async normalizeLogoForPdf(logoBuffer: Buffer) {
    try {
      return await sharp(logoBuffer, { failOn: "none" }).png().toBuffer();
    } catch {
      throw new InternalServerErrorException(
        "Logo institucional da carteirinha indisponivel.",
      );
    }
  }

  private drawPhoto(
    doc: PDFKit.PDFDocument,
    photoBuffer: Buffer | null,
    x: number,
    y: number,
    width = PHOTO.width,
    height = PHOTO.height,
  ) {
    doc.save();
    doc.rect(x, y, width, height).clip();
    if (photoBuffer) {
      doc.image(photoBuffer, x, y, {
        cover: [width, height],
        align: "center",
        valign: "center",
      });
    } else {
      doc.rect(x, y, width, height).fill("#D9D9D9");
      doc
        .circle(x + width / 2, y + height * 0.32, Math.min(width, height) * 0.17)
        .fill("#FFFFFF");
      doc
        .roundedRect(x + width * 0.18, y + height * 0.55, width * 0.64, height * 0.31, height * 0.16)
        .fill("#FFFFFF");
      doc
        .font("Helvetica-Bold")
        .fontSize(5.25)
        .fillColor("#6B7280")
        .text(STUDENT_CARD_PDF_LAYOUT.placeholderLabel, x, y + height - 12.75, {
          align: "center",
          width,
          lineBreak: false,
        });
    }
    doc.restore();
  }

  private drawValidity(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    year: number,
    color: string,
  ) {
    this.drawCenteredLine(doc, `VÁLIDA PARA O ANO LETIVO ${year}`, x, y, width, {
      font: "Helvetica-Bold",
      fontSize: 5.5,
      color,
    });
  }

  private drawCenteredLine(
    doc: PDFKit.PDFDocument,
    value: string,
    x: number,
    y: number,
    width: number,
    options: {
      font: string;
      fontSize: number;
      color: string;
    },
  ) {
    doc
      .font(options.font)
      .fontSize(options.fontSize)
      .fillColor(options.color)
      .text(this.truncateToWidth(doc, this.cleanText(value), width), x, y, {
        width,
        align: "center",
        lineBreak: false,
      });
  }

  private drawCenteredFitLine(
    doc: PDFKit.PDFDocument,
    value: string,
    x: number,
    y: number,
    width: number,
    options: {
      font: string;
      maxFontSize: number;
      minFontSize: number;
      color: string;
    },
  ) {
    const text = this.cleanText(value);
    let fontSize = options.maxFontSize;
    doc.font(options.font).fontSize(fontSize);
    while (fontSize > options.minFontSize && doc.widthOfString(text) > width) {
      fontSize -= 0.4;
      doc.fontSize(fontSize);
    }
    doc
      .fillColor(options.color)
      .text(this.truncateToWidth(doc, text, width), x, y, {
        width,
        align: "center",
        lineBreak: false,
      });
  }

  private drawCenteredBlock(
    doc: PDFKit.PDFDocument,
    value: string,
    x: number,
    y: number,
    width: number,
    options: {
      maxHeight: number;
      maxFontSize: number;
      minFontSize: number;
      font: string;
      color: string;
    },
  ) {
    const text = this.cleanText(value).toUpperCase();
    let fontSize = options.maxFontSize;
    let rendered = text;
    doc.font(options.font).fontSize(fontSize);
    while (fontSize > options.minFontSize) {
      const height = doc.heightOfString(text, {
        width,
        align: "center",
        lineGap: 0,
      });
      const longestWordTooWide = text
        .split(/\s+/)
        .some((word) => doc.widthOfString(word) > width);
      if (height <= options.maxHeight && !longestWordTooWide) {
        break;
      }
      fontSize -= 0.4;
      doc.fontSize(fontSize);
    }
    while (
      rendered.length > 1 &&
      doc.heightOfString(rendered, { width, align: "center", lineGap: 0 }) >
        options.maxHeight
    ) {
      rendered = `${rendered.slice(0, -4).trimEnd()}...`;
    }
    doc.fillColor(options.color).text(rendered, x, y, {
      width,
      align: "center",
      lineGap: 0,
    });
  }

  private truncateToWidth(
    doc: PDFKit.PDFDocument,
    value: string,
    width: number,
  ) {
    if (doc.widthOfString(value) <= width) {
      return value;
    }
    let text = value;
    while (text.length > 1 && doc.widthOfString(`${text}...`) > width) {
      text = text.slice(0, -1).trimEnd();
    }
    return `${text}...`;
  }

  private cleanText(value: string | null | undefined) {
    return value?.trim().replace(/\s+/g, " ") || "-";
  }

  private formatPhone(value: string | null | undefined) {
    const digits = value?.replace(/\D/g, "") ?? "";
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return this.cleanText(value);
  }

  private filename(card: StudentCardPdfRecord) {
    const name = this.sanitizeFileToken(card.student.person.fullName);
    const number = this.sanitizeFileToken(card.cardNumber);
    return `carteirinha_${name}_${number}.pdf`;
  }

  private sanitizeFileToken(value: string) {
    const token = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return token || "academico";
  }

  private async resolveAssociationIdentity(card: StudentCardPdfRecord) {
    const snapshot = this.toAssociationSnapshot(card.associationSnapshot);
    if (snapshot) {
      const logoBuffer = await this.associationSettings.readLogoForSnapshot(snapshot);
      if (!logoBuffer) {
        throw new InternalServerErrorException(
          "Logo institucional da carteirinha indisponivel.",
        );
      }
      return { logoBuffer, snapshot };
    }

    const legacySnapshot = this.associationSettings.legacySnapshot();
    const logoBuffer =
      (await this.associationSettings.readLogoForSnapshot(legacySnapshot)) ??
      this.loadLegacyLogo();
    return { logoBuffer, snapshot: legacySnapshot };
  }

  private toAssociationSnapshot(value: Prisma.JsonValue): AssociationSnapshot | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const snapshot = value as Partial<AssociationSnapshot>;
    if (
      typeof snapshot.legalName !== "string" ||
      typeof snapshot.cnpj !== "string" ||
      typeof snapshot.city !== "string" ||
      typeof snapshot.state !== "string"
    ) {
      return null;
    }
    return snapshot as AssociationSnapshot;
  }

  private loadLegacyLogo() {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.join(moduleDir, "assets/atretu-logo.png"),
      path.join(process.cwd(), "apps/api/src/student-cards/assets/atretu-logo.png"),
      path.join(process.cwd(), "src/student-cards/assets/atretu-logo.png"),
      path.join(process.cwd(), "dist/student-cards/assets/atretu-logo.png"),
    ];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      throw new InternalServerErrorException(
        "Logo institucional da carteirinha indisponivel.",
      );
    }
    return readFileSync(found);
  }
}

type StudentCardPdfRecord = Prisma.StudentCardGetPayload<{
  include: ReturnType<StudentCardPdfService["cardInclude"]>;
}>;
