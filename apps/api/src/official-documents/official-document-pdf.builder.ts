import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

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
  body: OfficialDocumentPdfBlock[];
  documentTitle: string;
  emittedBy: string;
  emittedAt: Date;
  footerNote: string;
  associationName?: string;
  associationCnpj?: string | null;
  associationLogo?: Buffer | null;
  layout?: "compact" | "standard";
  protocol: string;
  qrPayload: string;
  signaturePlacement?: "body" | "end";
  signatureLabel: string;
  signatureName: string;
  signatures?: Array<{ label?: string; name: string }>;
  signatureTitle?: string;
  subjectLabel?: string;
  subjectName?: string;
  studentName: string;
  version: number;
};

export type OfficialDocumentPdfBlock =
  | { text: string; type: "chapter" | "heading" | "paragraph" | "section" }
  | { text: string; type: "boldParagraph" }
  | { items: string[]; type: "list" }
  | {
      intro?: string;
      signatures: Array<{ details?: string[]; label?: string; name: string }>;
      type: "signatureGroup";
    }
  | { headers: string[]; rows: string[][]; type: "table" }
  | { label: string; text: string; type: "article" }
  | { size?: number; type: "spacer" };

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
          Author: input.associationName ?? "ATRETU",
          Creator: input.associationName ?? "ATRETU",
          Producer: input.associationName ?? "ATRETU",
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
    const logo = input.associationLogo ?? null;
    let pageNumber = 1;
    const compact = input.layout === "compact";
    const bodyX = compact ? 54 : 72;
    const bodyWidth = A4.width - bodyX * 2;
    const bodyFontSize = compact ? 9.4 : 11;
    const bodyLineGap = compact ? 0.2 : 4;
    const pageBodyStartY = compact ? 58 : 72;
    const titleY = compact ? 112 : 126;
    const footerTopY = A4.height - 104;
    const contentBottomLimit = footerTopY - 24;
    const addPage = () => {
      doc.addPage();
      pageNumber += 1;
      return pageBodyStartY;
    };

    this.drawHeader(doc, input, logo);

    doc
      .font("Helvetica-Bold")
      .fontSize(compact ? 11.5 : 18)
      .fillColor(COLORS.ink)
      .text(input.documentTitle.toUpperCase(), 56, titleY, {
        align: "center",
        width: A4.width - 112,
      });

    let y = compact ? Math.max(doc.y + 12, 150) : 176;
    input.body.forEach((block, index) => {
      const nextBlock = input.body[index + 1];
      const blockHeight = this.blockHeight(doc, block, bodyWidth, {
        bodyFontSize,
        bodyLineGap,
      });
      const keepWithNext =
        block.type === "chapter" ||
        block.type === "heading" ||
        block.type === "section";
      const nextHeight = nextBlock
        ? Math.min(
            this.blockHeight(doc, nextBlock, bodyWidth, {
              bodyFontSize,
              bodyLineGap,
            }),
            42,
          )
        : 0;
      if (
        y + blockHeight + (keepWithNext ? nextHeight : 0) >
        contentBottomLimit
      ) {
        y = addPage();
      }
      y = this.drawBlock(doc, block, bodyX, y, bodyWidth, {
        bodyFontSize,
        bodyLineGap,
      });
    });

    const signatures = input.signatures?.length
      ? input.signatures
      : [{ label: input.signatureTitle, name: input.signatureName }];
    if (input.signaturePlacement === "body") {
      this.drawLastPageFooter(doc, input);
      return;
    }
    y = Math.max(y + 18, compact ? y : 500);
    const signatureHeight = signatures.length > 1 ? 92 : 116;
    if (y + signatureHeight > contentBottomLimit) {
      y = addPage() + 24;
    }
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink).text(
      input.signatureLabel,
      bodyX,
      y,
      {
        align: signatures.length > 1 ? "left" : "center",
        width: bodyWidth,
      },
    );
    const signatureTop = y + 48;
    const gap = 18;
    const columns = Math.min(signatures.length, 3);
    const columnWidth = (bodyWidth - gap * (columns - 1)) / columns;
    signatures.forEach((signature, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = bodyX + column * (columnWidth + gap);
      const rowY = signatureTop + row * 62;
      doc
        .moveTo(x + 10, rowY)
        .lineTo(x + columnWidth - 10, rowY)
        .strokeColor(COLORS.line)
        .lineWidth(1)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(signatures.length > 1 ? 8.2 : 10)
        .fillColor(COLORS.ink)
        .text(signature.name, x, rowY + 8, {
          align: "center",
          width: columnWidth,
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(signature.label ?? "", x, rowY + 24, {
          align: "center",
          width: columnWidth,
        });
    });

    this.drawLastPageFooter(doc, input);
  }

  private blockHeight(
    doc: PDFKit.PDFDocument,
    block: OfficialDocumentPdfBlock,
    width: number,
    options: { bodyFontSize: number; bodyLineGap: number },
  ) {
    const compact = options.bodyFontSize < 10;
    const paragraphGap = compact ? 4 : 7;
    const headingGap = compact ? 8 : 12;
    const sectionGap = compact ? 5 : 8;
    const listGap = compact ? 1.5 : 3;
    if (block.type === "spacer") {
      return block.size ?? 8;
    }
    if (block.type === "chapter" || block.type === "heading") {
      return (
        doc.font("Helvetica-Bold").fontSize(12).heightOfString(block.text, {
          align: "center",
          lineGap: 1,
          width,
        }) + headingGap
      );
    }
    if (block.type === "section") {
      return (
        doc.font("Helvetica-Bold").fontSize(10.8).heightOfString(block.text, {
          align: "left",
          lineGap: 1,
          width,
        }) + sectionGap
      );
    }
    if (block.type === "article") {
      return (
        doc
          .font("Helvetica")
          .fontSize(options.bodyFontSize)
          .heightOfString(`${block.label} ${block.text}`, {
            align: "justify",
            lineGap: options.bodyLineGap,
            width,
          }) + paragraphGap
      );
    }
    if (block.type === "boldParagraph") {
      return (
        doc
          .font("Helvetica-Bold")
          .fontSize(options.bodyFontSize)
          .heightOfString(block.text, {
            align: "justify",
            lineGap: options.bodyLineGap,
            width,
          }) + paragraphGap
      );
    }
    if (block.type === "signatureGroup") {
      const signatures = Math.max(block.signatures.length, 1);
      const columns = signatures === 1 ? 1 : 2;
      const gap = 18;
      const columnWidth = (width - gap * (columns - 1)) / columns;
      const detailsHeight = block.signatures.reduce((height, signature) => {
        const signatureDetailsHeight = (signature.details ?? []).reduce(
          (details, detail) =>
            details +
            doc.font("Helvetica").fontSize(8).heightOfString(detail, {
              width: columnWidth,
            }),
          0,
        );
        return Math.max(height, signatureDetailsHeight);
      }, 0);
      return (
        (block.intro ? 14 : 0) +
        Math.ceil(signatures / columns) *
          (detailsHeight + (compact ? 62 : 70)) +
        paragraphGap
      );
    }
    if (block.type === "list") {
      return block.items.reduce(
        (height, item) =>
          height +
          doc
            .font("Helvetica")
            .fontSize(options.bodyFontSize)
            .heightOfString(item, {
              align: "left",
              lineGap: options.bodyLineGap,
              width: width - 28,
            }) +
          listGap,
        compact ? 2 : 4,
      );
    }
    if (block.type === "table") {
      return (
        (block.headers.length ? 18 : 0) +
        block.rows.length * (compact ? 16 : 20) +
        (compact ? 8 : 12)
      );
    }
    return (
      doc
        .font("Helvetica")
        .fontSize(options.bodyFontSize)
        .heightOfString(block.text, {
          align: "justify",
          lineGap: options.bodyLineGap,
          width,
        }) + paragraphGap
    );
  }

  private drawBlock(
    doc: PDFKit.PDFDocument,
    block: OfficialDocumentPdfBlock,
    x: number,
    y: number,
    width: number,
    options: { bodyFontSize: number; bodyLineGap: number },
  ) {
    const compact = options.bodyFontSize < 10;
    const paragraphGap = compact ? 4 : 7;
    const headingGap = compact ? 8 : 12;
    const sectionGap = compact ? 5 : 8;
    const listGap = compact ? 1.5 : 3;
    if (block.type === "spacer") {
      return y + (block.size ?? 8);
    }
    if (block.type === "chapter" || block.type === "heading") {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.ink)
        .text(block.text, x, y, { align: "center", lineGap: 1, width });
      return doc.y + headingGap;
    }
    if (block.type === "section") {
      doc
        .font("Helvetica-Bold")
        .fontSize(10.8)
        .fillColor(COLORS.ink)
        .text(block.text, x, y, { align: "left", lineGap: 1, width });
      return doc.y + sectionGap;
    }
    if (block.type === "article") {
      doc
        .font("Helvetica-Bold")
        .fontSize(options.bodyFontSize)
        .fillColor(COLORS.ink)
        .text(block.label, x, y, { continued: true });
      doc
        .font("Helvetica")
        .fontSize(options.bodyFontSize)
        .fillColor(COLORS.ink)
        .text(` ${block.text}`, {
          align: "justify",
          lineGap: options.bodyLineGap,
          width,
        });
      return doc.y + paragraphGap;
    }
    if (block.type === "boldParagraph") {
      doc
        .font("Helvetica-Bold")
        .fontSize(options.bodyFontSize)
        .fillColor(COLORS.ink)
        .text(block.text, x, y, {
          align: "justify",
          lineGap: options.bodyLineGap,
          width,
        });
      return doc.y + paragraphGap;
    }
    if (block.type === "signatureGroup") {
      return this.drawSignatureGroup(doc, block, x, y, width, options);
    }
    if (block.type === "list") {
      let nextY = y + (compact ? 1 : 2);
      block.items.forEach((item) => {
        doc
          .font("Helvetica")
          .fontSize(options.bodyFontSize)
          .fillColor(COLORS.ink)
          .text(item, x + 18, nextY, {
            align: "left",
            lineGap: options.bodyLineGap,
            width: width - 28,
          });
        nextY = doc.y + listGap;
      });
      return nextY + (compact ? 1 : 2);
    }
    if (block.type === "table") {
      return this.drawTable(doc, block, x, y, width, options);
    }
    doc
      .font("Helvetica")
      .fontSize(options.bodyFontSize)
      .fillColor(COLORS.ink)
      .text(block.text, x, y, {
        align: "justify",
        lineGap: options.bodyLineGap,
        width,
      });
    return doc.y + paragraphGap;
  }

  private drawTable(
    doc: PDFKit.PDFDocument,
    block: Extract<OfficialDocumentPdfBlock, { type: "table" }>,
    x: number,
    y: number,
    width: number,
    options: { bodyFontSize: number; bodyLineGap: number },
  ) {
    const compact = options.bodyFontSize < 10;
    const rowHeight = compact ? 16 : 20;
    const columns = Math.max(block.headers.length, block.rows[0]?.length ?? 1);
    const columnWidth = width / columns;
    let nextY = y;
    if (block.headers.length) {
      doc.rect(x, nextY, width, rowHeight).fill(COLORS.panel).stroke(COLORS.line);
      block.headers.forEach((header, index) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(options.bodyFontSize)
          .fillColor(COLORS.ink)
          .text(header, x + index * columnWidth + 6, nextY + 4, {
            width: columnWidth - 12,
          });
      });
      nextY += rowHeight;
    }
    block.rows.forEach((row) => {
      doc.rect(x, nextY, width, rowHeight).fill("#FFFFFF").stroke(COLORS.line);
      row.forEach((cell, index) => {
        doc
          .font("Helvetica")
          .fontSize(options.bodyFontSize)
          .fillColor(COLORS.ink)
          .text(cell, x + index * columnWidth + 6, nextY + 4, {
            width: columnWidth - 12,
          });
      });
      nextY += rowHeight;
    });
    return nextY + (compact ? 8 : 12);
  }

  private drawSignatureGroup(
    doc: PDFKit.PDFDocument,
    block: Extract<OfficialDocumentPdfBlock, { type: "signatureGroup" }>,
    x: number,
    y: number,
    width: number,
    options: { bodyFontSize: number; bodyLineGap: number },
  ) {
    let nextY = y;
    if (block.intro) {
      doc
        .font("Helvetica")
        .fontSize(options.bodyFontSize)
        .fillColor(COLORS.ink)
        .text(block.intro, x, nextY, {
          align: "left",
          lineGap: options.bodyLineGap,
          width,
        });
      nextY = doc.y + 8;
    }
    const gap = 18;
    const columns = block.signatures.length === 1 ? 1 : 2;
    const columnWidth = (width - gap * (columns - 1)) / columns;
    block.signatures.forEach((signature, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const rowY = nextY + row * 86;
      const columnX = columns === 1 ? x + width * 0.16 : x + column * (columnWidth + gap);
      const lineWidth = columns === 1 ? width * 0.68 : columnWidth;
      let detailBottom = rowY;
      signature.details?.forEach((detail) => {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(COLORS.ink)
          .text(detail, columnX, detailBottom, {
            align: "left",
            width: lineWidth,
          });
        detailBottom = doc.y + 2;
      });
      const lineY = Math.max(rowY + 34, detailBottom + 18);
      doc
        .moveTo(columnX + 10, rowY + 34)
        .moveTo(columnX + 10, lineY)
        .lineTo(columnX + lineWidth - 10, lineY)
        .strokeColor(COLORS.line)
        .lineWidth(1)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(8.4)
        .fillColor(COLORS.ink)
        .text(signature.name, columnX, lineY + 8, {
          align: "center",
          width: lineWidth,
        });
      doc
        .font("Helvetica")
        .fontSize(7.6)
        .fillColor(COLORS.muted)
        .text(signature.label ?? "", columnX, lineY + 22, {
          align: "center",
          width: lineWidth,
        });
    });
    return nextY + Math.ceil(block.signatures.length / columns) * 86 + 4;
  }

  private drawHeader(
    doc: PDFKit.PDFDocument,
    input: OfficialDocumentPdfInput,
    logo: Buffer | null,
  ) {
    const headerTop = 24;
    const logoWidth = 92;
    const logoHeight = 44;
    const logoX = A4.width - 56 - logoWidth;
    const textX = 56;
    const textWidth = logoX - textX - 18;
    doc.rect(0, 0, A4.width, 90).fill("#FFFFFF");
    if (logo) {
      doc.image(logo, logoX, headerTop, {
        align: "center",
        fit: [logoWidth, logoHeight],
        valign: "center",
      });
    } else {
      doc
        .rect(logoX, headerTop + 2, logoWidth, logoHeight - 4)
        .stroke(COLORS.line)
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.brand)
        .text("ATRETU", logoX, headerTop + 17, {
          align: "center",
          width: logoWidth,
        });
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(10.6)
      .fillColor(COLORS.ink)
      .text(input.associationName ?? "ATRETU", textX, headerTop + 6, {
        align: "center",
        lineGap: 1,
        width: textWidth,
      });
    if (input.associationCnpj) {
      doc
        .font("Helvetica")
        .fontSize(8.6)
        .fillColor(COLORS.muted)
        .text(`CNPJ ${input.associationCnpj}`, textX, doc.y + 3, {
          align: "center",
          width: textWidth,
        });
    }
    doc
      .moveTo(56, 82)
      .lineTo(A4.width - 56, 82)
      .strokeColor(COLORS.line)
      .lineWidth(0.8)
      .stroke();
  }

  private drawLastPageFooter(
    doc: PDFKit.PDFDocument,
    input: OfficialDocumentPdfInput,
  ) {
    const range = doc.bufferedPageRange();
    const lastPageIndex = range.start + range.count - 1;
    doc.switchToPage(lastPageIndex);
    this.drawFooter(doc, input, range.count);
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
        .text(`Emitido por ${input.emittedBy} | Documento: ${input.documentTitle} | ${input.subjectLabel ?? "Acadêmico"}: ${input.subjectName ?? input.studentName}`, 56, y + 14, {
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

}
