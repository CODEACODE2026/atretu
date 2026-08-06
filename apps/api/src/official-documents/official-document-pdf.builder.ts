import { Injectable, InternalServerErrorException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const A4 = { width: 595.28, height: 841.89 };
const COLORS = {
  brand: "#0F2E2E",
  accent: "#1F6F5F",
  ink: "#172033",
  muted: "#526173",
  line: "#D8E0EA",
  panel: "#F4F8F7",
};

export type OfficialDocumentPdfInput = {
  body: string[];
  documentTitle: string;
  emittedBy: string;
  emittedAt: Date;
  footerNote: string;
  protocol: string;
  qrPayload: string;
  signatureLabel: string;
  signatureName: string;
  signatureTitle?: string;
  studentName: string;
  version: number;
};

@Injectable()
export class OfficialDocumentPdfBuilder {
  render(input: OfficialDocumentPdfInput) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 56,
        autoFirstPage: true,
        bufferPages: true,
        compress: false,
        info: {
          Title: input.documentTitle,
          Author: "ATRETU",
          Creator: "ATRETU",
          Producer: "ATRETU",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      this.draw(input, doc);
      doc.end();
    });
  }

  private draw(input: OfficialDocumentPdfInput, doc: PDFKit.PDFDocument) {
    const logo = this.loadOfficialLogo();
    let pageNumber = 1;
    const startBodyY = 230;
    const footerTopY = A4.height - 104;
    const contentBottomLimit = footerTopY - 24;
    const drawPageChrome = () => {
      this.drawHeader(doc, logo);
      this.drawFooter(doc, input, pageNumber);
    };
    const addPage = () => {
      doc.addPage();
      pageNumber += 1;
      drawPageChrome();
      return 126;
    };

    drawPageChrome();
    this.drawDocumentMeta(doc, input);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(COLORS.ink)
      .text(input.documentTitle.toUpperCase(), 56, 168, {
        align: "center",
        width: A4.width - 112,
      });

    let y = startBodyY;
    input.body.forEach((paragraph) => {
      const paragraphHeight = doc
        .font("Helvetica")
        .fontSize(11)
        .heightOfString(paragraph, {
          align: "justify",
          lineGap: 4,
          width: A4.width - 144,
        });
      if (y + paragraphHeight > contentBottomLimit) {
        y = addPage();
      }
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(COLORS.ink)
        .text(paragraph, 72, y, {
          align: "justify",
          lineGap: 4,
          width: A4.width - 144,
        });
      y = doc.y + 16;
    });

    y = Math.max(y + 18, 500);
    if (y + 58 > contentBottomLimit) {
      y = addPage() + 24;
    }
    doc
      .moveTo(184, y)
      .lineTo(A4.width - 184, y)
      .strokeColor(COLORS.line)
      .lineWidth(1)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(input.signatureName, 72, y + 10, {
        align: "center",
        width: A4.width - 144,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(input.signatureLabel, 72, y + 26, {
        align: "center",
        width: A4.width - 144,
      });
    if (input.signatureTitle) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(input.signatureTitle, 72, y + 40, {
          align: "center",
          width: A4.width - 144,
        });
    }

    this.drawQrPreparedBlock(
      doc,
      input,
      A4.width - 158,
      Math.min(y + 56, footerTopY - 150),
    );
  }

  private drawHeader(doc: PDFKit.PDFDocument, logo: Buffer) {
    doc.rect(0, 0, A4.width, 88).fill(COLORS.brand);
    doc.image(logo, 56, 24, { fit: [120, 40], valign: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#FFFFFF")
      .text("ASSOCIAÇÃO DE TRANSPORTE UNIVERSITÁRIO", 206, 24, {
        align: "right",
        width: A4.width - 262,
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#DDEBFA")
      .text("Documento oficial emitido pelo sistema Atretu", 206, 43, {
        align: "right",
        width: A4.width - 262,
      });
    doc.rect(0, 88, A4.width, 5).fill(COLORS.accent);
  }

  private drawDocumentMeta(
    doc: PDFKit.PDFDocument,
    input: OfficialDocumentPdfInput,
  ) {
    doc.roundedRect(56, 112, A4.width - 112, 34, 8).fill(COLORS.panel);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text("PROTOCOLO", 72, 122, { width: 88 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(input.protocol, 72, 133, { width: 150 });
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text("DATA", 252, 122, { width: 60 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(this.formatDate(input.emittedAt), 252, 133, { width: 90 });
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text("VERSÃO", 420, 122, { width: 50 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(`v${input.version}`, 420, 133, { width: 60 });
  }

  private drawQrPreparedBlock(
    doc: PDFKit.PDFDocument,
    input: OfficialDocumentPdfInput,
    x: number,
    y: number,
  ) {
    const size = 82;
    doc.roundedRect(x - 10, y - 10, size + 20, 142, 8).fill("#FFFFFF").stroke(COLORS.line);
    doc.rect(x, y, size, size).fill("#FFFFFF").stroke(COLORS.ink);
    const cells = 9;
    const cell = size / cells;
    const seed = input.protocol
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    for (let row = 0; row < cells; row += 1) {
      for (let col = 0; col < cells; col += 1) {
        const finder =
          (row < 3 && col < 3) ||
          (row < 3 && col > 5) ||
          (row > 5 && col < 3);
        const filled = finder || (row * 7 + col * 11 + seed) % 5 === 0;
        if (filled) {
          doc.rect(x + col * cell, y + row * cell, cell, cell).fill(COLORS.ink);
        }
      }
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(COLORS.ink)
      .text("QR preparado", x - 4, y + size + 10, {
        align: "center",
        width: size + 8,
      });
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text(input.qrPayload, x - 4, y + size + 22, {
        align: "center",
        width: size + 8,
      });
  }

  private drawFooter(
    doc: PDFKit.PDFDocument,
    input: OfficialDocumentPdfInput,
    pageNumber: number,
  ) {
    const y = A4.height - 104;
    const footerLines = input.footerNote.split(" | ");
    const previousBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    try {
      doc.rect(0, y, A4.width, 104).fill(COLORS.panel);
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(`Emitido por ${input.emittedBy} | Documento: ${input.documentTitle} | Acadêmico: ${input.studentName}`, 56, y + 14, {
          align: "center",
          lineBreak: false,
          width: A4.width - 112,
        });
      footerLines.forEach((line, index) => {
        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor(COLORS.muted)
          .text(line, 56, y + 40 + index * 14, {
            align: "center",
            lineBreak: false,
            width: A4.width - 112,
          });
      });
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(`Pagina ${pageNumber}`, 56, A4.height - 18, {
          align: "center",
          width: A4.width - 112,
        });
    } finally {
      doc.page.margins.bottom = previousBottomMargin;
    }
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }

  private loadOfficialLogo() {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.join(moduleDir, "../student-cards/assets/atretu-logo.png"),
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
