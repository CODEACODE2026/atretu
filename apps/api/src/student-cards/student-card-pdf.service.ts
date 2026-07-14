import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  StudentDocumentStatus,
  StudentDocumentType,
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentStorageService } from "../documents/document-storage.service.js";
import { FileDisposition } from "../documents/dto/documents.dto.js";
import { PrismaService } from "../database/prisma.service.js";

const MM_TO_PT = 72 / 25.4;
const CARD_SCALE = 1.55;
const A4 = { width: 595.28, height: 841.89 };
const CARD = {
  width: 85.6 * MM_TO_PT * CARD_SCALE,
  height: 53.98 * MM_TO_PT * CARD_SCALE,
};
const PHOTO = {
  width: 24 * MM_TO_PT * CARD_SCALE,
  height: 32 * MM_TO_PT * CARD_SCALE,
};
const COLORS = {
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
  ) {}

  async generate(cardId: string, disposition: FileDisposition) {
    const card = await this.prisma.studentCard.findUnique({
      where: { id: cardId },
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
    if (!photo) {
      throw new BadRequestException(
        "Adicione uma foto oficial do academico para gerar o PDF da carteirinha",
      );
    }

    const photoBuffer = await this.storage.read(photo.storageKey);
    const logoBuffer = this.loadOfficialLogo();
    const buffer = await this.renderPdf(card, photoBuffer, logoBuffer);
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
    photoBuffer: Buffer,
    logoBuffer: Buffer,
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: "Carteirinha ATRETU",
          Author: "ATRETU",
          Creator: "ATRETU",
          Producer: "ATRETU",
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
    photoBuffer: Buffer,
    logoBuffer: Buffer,
  ) {
    const x = (A4.width - CARD.width) / 2;
    const y = 95;
    this.drawCutMarks(doc, x, y, CARD.width, CARD.height);
    this.drawCard(doc, x, y, card, photoBuffer, logoBuffer);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text("Carteirinha individual preparada para impressao e recorte.", 0, y + CARD.height + 26, {
        align: "center",
        width: A4.width,
      });
  }

  private drawCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    card: StudentCardPdfRecord,
    photoBuffer: Buffer,
    logoBuffer: Buffer,
  ) {
    doc
      .roundedRect(x, y, CARD.width, CARD.height, 8)
      .fillAndStroke("#FFFFFF", COLORS.line);
    doc
      .roundedRect(x + 6, y + 6, CARD.width - 12, CARD.height - 12, 6)
      .strokeColor("#EDF2F7")
      .stroke();
    doc.rect(x, y, CARD.width, 42).fill(COLORS.blue);
    doc.rect(x, y + 42, CARD.width, 5).fill(COLORS.red);

    this.drawLogo(doc, x + 12, y + 8, logoBuffer);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#FFFFFF")
      .text("CARTEIRINHA DO ACADEMICO", x + 116, y + 11, {
        width: CARD.width - 130,
        align: "right",
      });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#DDEBFA")
      .text(`Ano letivo ${card.academicYear.year}`, x + 116, y + 27, {
        width: CARD.width - 130,
        align: "right",
      });

    const contentTop = y + 60;
    const photoX = x + 16;
    const photoY = contentTop;
    doc
      .roundedRect(photoX - 2, photoY - 2, PHOTO.width + 4, PHOTO.height + 4, 4)
      .fill("#FFFFFF")
      .strokeColor(COLORS.line)
      .stroke();
    doc.image(photoBuffer, photoX, photoY, {
      cover: [PHOTO.width, PHOTO.height],
      align: "center",
      valign: "center",
    });

    const infoX = photoX + PHOTO.width + 16;
    const infoWidth = CARD.width - (infoX - x) - 18;
    this.drawFitText(doc, card.student.person.fullName, infoX, contentTop, infoWidth, {
      maxFontSize: 14,
      minFontSize: 8.5,
      font: "Helvetica-Bold",
      color: COLORS.ink,
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(COLORS.muted)
      .text("NUMERO", infoX, contentTop + 24);
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(COLORS.blueDark)
      .text(card.cardNumber, infoX, contentTop + 32, {
        width: infoWidth,
      });

    const detailY = contentTop + 67;
    this.drawLabelValue(doc, "Instituicao", card.enrollment.institution.name, infoX, detailY, infoWidth, 2);
    this.drawLabelValue(doc, "Curso", card.enrollment.course, infoX, detailY + 32, infoWidth, 2);

    const bottomY = y + CARD.height - 33;
    const bottomX = x + 16;
    const bottomGap = 10;
    const bottomWidth = CARD.width - 32;
    const bottomCol = (bottomWidth - bottomGap * 2) / 3;
    this.drawLabelValue(doc, "Turno", card.enrollment.shift.name, bottomX, bottomY, bottomCol, 1);
    this.drawLabelValue(
      doc,
      "Telefone",
      this.formatPhone(card.student.person.phone),
      bottomX + bottomCol + bottomGap,
      bottomY,
      bottomCol,
      1,
    );
    this.drawLabelValue(
      doc,
      "Validade",
      String(card.academicYear.year),
      bottomX + (bottomCol + bottomGap) * 2,
      bottomY,
      bottomCol,
      1,
    );
  }

  private drawLogo(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    logoBuffer: Buffer,
  ) {
    doc.image(logoBuffer, x, y, {
      fit: [76, 26],
      valign: "center",
    });
  }

  private drawCutMarks(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const size = 8;
    const gap = 3;
    doc.strokeColor("#94A3B8").lineWidth(0.5);
    const marks: Array<[number, number, number, number]> = [
      [x - gap - size, y, x - gap, y],
      [x, y - gap - size, x, y - gap],
      [x + width + gap, y, x + width + gap + size, y],
      [x + width, y - gap - size, x + width, y - gap],
      [x - gap - size, y + height, x - gap, y + height],
      [x, y + height + gap, x, y + height + gap + size],
      [x + width + gap, y + height, x + width + gap + size, y + height],
      [x + width, y + height + gap, x + width, y + height + gap + size],
    ];
    marks.forEach(([x1, y1, x2, y2]) => {
      doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
    });
  }

  private drawLabelValue(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    maxLines: number,
  ) {
    doc.font("Helvetica-Bold").fontSize(5.4).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, {
      width,
    });
    this.drawWrappedText(doc, value, x, y + 7, width, {
      font: "Helvetica",
      fontSize: 7.2,
      color: COLORS.ink,
      maxLines,
    });
  }

  private drawFitText(
    doc: PDFKit.PDFDocument,
    value: string,
    x: number,
    y: number,
    width: number,
    options: {
      maxFontSize: number;
      minFontSize: number;
      font: string;
      color: string;
    },
  ) {
    const text = this.cleanText(value);
    let fontSize = options.maxFontSize;
    doc.font(options.font).fontSize(fontSize);
    while (fontSize > options.minFontSize && doc.widthOfString(text) > width) {
      fontSize -= 0.5;
      doc.fontSize(fontSize);
    }
    doc.fillColor(options.color).text(this.truncateToWidth(doc, text, width), x, y, {
      width,
      lineBreak: false,
    });
  }

  private drawWrappedText(
    doc: PDFKit.PDFDocument,
    value: string,
    x: number,
    y: number,
    width: number,
    options: {
      font: string;
      fontSize: number;
      color: string;
      maxLines: number;
    },
  ) {
    doc.font(options.font).fontSize(options.fontSize).fillColor(options.color);
    const words = this.cleanText(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (doc.widthOfString(next) <= width) {
        current = next;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    });
    if (current) {
      lines.push(current);
    }
    const limited = lines.slice(0, options.maxLines);
    if (lines.length > options.maxLines && limited.length > 0) {
      const lastLine = limited[limited.length - 1] ?? "";
      limited[limited.length - 1] = this.truncateToWidth(
        doc,
        lastLine,
        width,
      );
    }
    limited.forEach((line, index) => {
      doc.text(line, x, y + index * (options.fontSize + 1.8), {
        width,
        lineBreak: false,
      });
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

  private loadOfficialLogo() {
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
        "Logo oficial da ATRETU nao configurada",
      );
    }
    return readFileSync(found);
  }
}

type StudentCardPdfRecord = Prisma.StudentCardGetPayload<{
  include: ReturnType<StudentCardPdfService["cardInclude"]>;
}>;
