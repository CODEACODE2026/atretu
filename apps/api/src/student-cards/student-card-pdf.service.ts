import {
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

const A4 = { width: 595.28, height: 841.89 };
// PDFKit uses points. 360 x 230 px at 96 DPI equals 270 x 172.5 pt.
const CARD = {
  width: 270,
  height: 172.5,
};
const PHOTO = {
  width: 58.5,
  height: 78,
};
export const STUDENT_CARD_PDF_LAYOUT = {
  card: CARD,
  photo: PHOTO,
  placeholderLabel: "Sem foto",
} as const;
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
    const photoBuffer = photo ? await this.storage.read(photo.storageKey) : null;
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
    photoBuffer: Buffer | null,
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
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
  ) {
    const x = (A4.width - CARD.width) / 2;
    const y = 95;
    this.drawCutMarks(doc, x, y, CARD.width, CARD.height);
    this.drawCard(doc, x, y, card, photoBuffer, logoBuffer);

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text("Carteirinha individual preparada para impressao e recorte.", 0, y + CARD.height + 20, {
        align: "center",
        width: A4.width,
      });
  }

  private drawCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    card: StudentCardPdfRecord,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer,
  ) {
    doc
      .roundedRect(x, y, CARD.width, CARD.height, 6)
      .fillAndStroke("#FFFFFF", COLORS.line);
    doc
      .roundedRect(x + 4.5, y + 4.5, CARD.width - 9, CARD.height - 9, 4.5)
      .strokeColor("#EDF2F7")
      .stroke();
    doc.rect(x, y, CARD.width, 31.5).fill(COLORS.blue);
    doc.rect(x, y + 31.5, CARD.width, 3.75).fill(COLORS.red);

    this.drawLogo(doc, x + 9, y + 6, logoBuffer);
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#FFFFFF")
      .text("CARTEIRINHA DO ACADEMICO", x + 87, y + 8.25, {
        width: CARD.width - 97.5,
        align: "right",
      });
    doc
      .font("Helvetica")
      .fontSize(5.25)
      .fillColor("#DDEBFA")
      .text(`Ano letivo ${card.academicYear.year}`, x + 87, y + 20.25, {
        width: CARD.width - 97.5,
        align: "right",
      });

    const contentTop = y + 43.5;
    const photoX = x + 12;
    const photoY = contentTop;
    doc
      .roundedRect(photoX - 1.5, photoY - 1.5, PHOTO.width + 3, PHOTO.height + 3, 3)
      .fill("#FFFFFF")
      .strokeColor(COLORS.line)
      .stroke();
    this.drawPhoto(doc, photoBuffer, photoX, photoY);

    const infoX = photoX + PHOTO.width + 12;
    const infoWidth = CARD.width - (infoX - x) - 13.5;
    this.drawFitText(doc, card.student.person.fullName, infoX, contentTop, infoWidth, {
      maxFontSize: 9.75,
      minFontSize: 6.5,
      font: "Helvetica-Bold",
      color: COLORS.ink,
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(4.9)
      .fillColor(COLORS.muted)
      .text("NUMERO", infoX, contentTop + 18);
    doc
      .font("Helvetica-Bold")
      .fontSize(12.75)
      .fillColor(COLORS.blueDark)
      .text(card.cardNumber, infoX, contentTop + 24, {
        width: infoWidth,
      });

    const detailY = contentTop + 47.25;
    this.drawLabelValue(doc, "Instituicao", card.enrollment.institution.name, infoX, detailY, infoWidth, 2);
    this.drawLabelValue(doc, "Curso", card.enrollment.course, infoX, detailY + 23.25, infoWidth, 2);

    const bottomY = y + CARD.height - 23.25;
    const bottomX = x + 12;
    const bottomGap = 7.5;
    const bottomWidth = CARD.width - 24;
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
      fit: [57, 19.5],
      valign: "center",
    });
  }

  private drawPhoto(
    doc: PDFKit.PDFDocument,
    photoBuffer: Buffer | null,
    x: number,
    y: number,
  ) {
    doc.save();
    doc.roundedRect(x, y, PHOTO.width, PHOTO.height, 2.25).clip();
    if (photoBuffer) {
      doc.image(photoBuffer, x, y, {
        cover: [PHOTO.width, PHOTO.height],
        align: "center",
        valign: "center",
      });
    } else {
      doc.rect(x, y, PHOTO.width, PHOTO.height).fill("#EEF3F8");
      doc
        .circle(x + PHOTO.width / 2, y + 26.25, 12)
        .fill("#CBD5E1");
      doc
        .roundedRect(x + 13.5, y + 43.5, PHOTO.width - 27, 21, 9)
        .fill("#CBD5E1");
      doc
        .font("Helvetica-Bold")
        .fontSize(5.25)
        .fillColor(COLORS.muted)
        .text(STUDENT_CARD_PDF_LAYOUT.placeholderLabel, x, y + PHOTO.height - 12.75, {
          align: "center",
          width: PHOTO.width,
          lineBreak: false,
        });
    }
    doc.restore();
  }

  private drawCutMarks(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const size = 6;
    const gap = 2.25;
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
    doc.font("Helvetica-Bold").fontSize(4.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, {
      width,
    });
    this.drawWrappedText(doc, value, x, y + 5.25, width, {
      font: "Helvetica",
      fontSize: 5.7,
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
      doc.text(line, x, y + index * (options.fontSize + 1.35), {
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
