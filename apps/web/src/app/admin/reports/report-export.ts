"use client";

import type { ApiUser } from "../../../lib/api";

export type ReportColumn = {
  key: string;
  label: string;
  type?: "currency" | "date" | "number" | "text";
};

export type ReportRow = Record<string, string | number | boolean | null | undefined>;

export type GeneratedReport = {
  category: string;
  columns: ReportColumn[];
  filters: Array<{ label: string; value: string }>;
  generatedAt: string;
  rows: ReportRow[];
  summary: Array<{ label: string; value: string }>;
  title: string;
};

export function downloadReportPdf(report: GeneratedReport, user: ApiUser) {
  downloadBlob(
    buildReportPdf(report, user),
    `${slugify(report.title)}.pdf`,
    "application/pdf",
  );
}

export function downloadReportXlsx(report: GeneratedReport, user: ApiUser) {
  downloadBlob(
    buildReportXlsx(report, user),
    `${slugify(report.title)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export function printReport(report: GeneratedReport, user: ApiUser) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    return;
  }

  printWindow.document.write(buildPrintHtml(report, user));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function buildPrintHtml(report: GeneratedReport, user: ApiUser) {
  const filters = report.filters.length
    ? report.filters.map((filter) => `<span>${escapeHtml(filter.label)}: <strong>${escapeHtml(filter.value)}</strong></span>`).join("")
    : "<span>Nenhum filtro aplicado</span>";
  const summary = report.summary.map((item) => `
    <article>
      <small>${escapeHtml(item.label)}</small>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join("");
  const rows = report.rows.map((row) => `
    <tr>
      ${report.columns.map((column) => `<td>${escapeHtml(formatCell(row[column.key], column.type))}</td>`).join("")}
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Inter, Arial, sans-serif; background: #fff; }
    header { border-bottom: 2px solid #0F2E2E; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 24px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .mark { background: #0F2E2E; color: #fff; border-radius: 10px; font-weight: 800; padding: 10px 12px; }
    h1 { margin: 0; font-size: 22px; }
    p { margin: 4px 0 0; color: #475569; font-size: 12px; }
    .meta { text-align: right; font-size: 11px; color: #475569; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .filters span { border: 1px solid #cbd5e1; border-radius: 999px; padding: 5px 9px; font-size: 11px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
    article { border: 1px solid #dbe5e3; border-radius: 10px; padding: 9px; }
    small { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; }
    strong { display: block; margin-top: 3px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #0F2E2E; color: #fff; text-align: left; padding: 7px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 7px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafafa; }
    footer { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; }
    @media print { button, nav, aside { display: none !important; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="mark">AT</div>
      <div>
        <h1>${escapeHtml(report.title)}</h1>
        <p>Atretu Admin · ${escapeHtml(report.category)}</p>
      </div>
    </div>
    <div class="meta">
      <div>Emitido em ${escapeHtml(formatDateTime(report.generatedAt))}</div>
      <div>Usuário: ${escapeHtml(user.name)}</div>
      <div>Sistema: Atretu</div>
    </div>
  </header>
  <section class="filters">${filters}</section>
  <section class="summary">${summary}</section>
  <table>
    <thead><tr>${report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${report.columns.length}">Nenhum registro encontrado.</td></tr>`}</tbody>
  </table>
  <footer>
    <span>Atretu · Relatório operacional</span>
    <span>${report.rows.length} registro(s)</span>
  </footer>
</body>
</html>`;
}

export function buildReportPdf(report: GeneratedReport, user: ApiUser) {
  const landscape = report.columns.length >= 6;
  const pageWidth = landscape ? 842 : 595;
  const pageHeight = landscape ? 595 : 842;
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const footerY = 26;
  const bottomLimit = 54;
  const columns = buildPdfColumns(report.columns, usableWidth);
  const pages: string[][] = [];
  let lines = createPdfPage(report, user, pageWidth, pageHeight, margin, columns);
  const firstDataY = pageHeight - (report.summary.length > 0 ? 210 : 184);
  let y = firstDataY;

  const appendPage = () => {
    pages.push(lines);
    lines = createPdfPage(report, user, pageWidth, pageHeight, margin, columns);
    y = firstDataY;
  };

  if (report.rows.length === 0) {
    drawPdfRect(lines, margin, y - 18, usableWidth, 28, "248 250 252");
    drawPdfText(lines, "Nenhum registro encontrado.", margin + 8, y - 2, 9, { maxWidth: usableWidth - 16 });
  } else {
    report.rows.forEach((row, rowIndex) => {
      const cellLines = columns.map((column) => wrapPdfText(formatCell(row[column.key], column.type), column.width - 12, 8));
      const rowHeight = Math.max(24, Math.max(...cellLines.map((items) => items.length)) * 10 + 12);
      if (y - rowHeight < bottomLimit) {
        appendPage();
      }
      drawPdfRect(lines, margin, y - rowHeight + 8, usableWidth, rowHeight, rowIndex % 2 === 0 ? "255 255 255" : "248 250 252");
      let x = margin;
      columns.forEach((column, columnIndex) => {
        const align = column.type === "currency" || column.type === "number" ? "right" : column.type === "date" ? "center" : "left";
        cellLines[columnIndex]!.forEach((text, lineIndex) => {
          drawPdfText(lines, text, x + 6, y - 6 - lineIndex * 10, 8, {
            align,
            color: "15 23 42",
            maxWidth: column.width - 12,
          });
        });
        drawPdfLine(lines, x, y + 8, x, y - rowHeight + 8, "226 232 240", 0.3);
        x += column.width;
      });
      drawPdfLine(lines, margin + usableWidth, y + 8, margin + usableWidth, y - rowHeight + 8, "226 232 240", 0.3);
      drawPdfLine(lines, margin, y - rowHeight + 8, margin + usableWidth, y - rowHeight + 8, "226 232 240", 0.4);
      y -= rowHeight;
    });
  }

  pages.push(lines);
  const pageContents = pages.map((pageLines, index) => {
    drawPdfFooter(pageLines, report, pageWidth, margin, footerY, index + 1, pages.length);
    return pageLines.join("\n");
  });

  return createPdf(pageContents, pageWidth, pageHeight);
}

function createPdfPage(
  report: GeneratedReport,
  user: ApiUser,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  columns: PdfColumn[],
) {
  const lines: string[] = [];
  const usableWidth = pageWidth - margin * 2;
  drawPdfRect(lines, margin, pageHeight - 66, 42, 30, "15 46 46");
  drawPdfText(lines, "AT", margin + 11, pageHeight - 55, 13, { bold: true, color: "255 255 255", maxWidth: 22 });
  drawPdfText(lines, "ATRETU", margin + 54, pageHeight - 45, 10, { bold: true, color: "15 46 46", maxWidth: 120 });
  drawPdfText(lines, report.title, margin + 54, pageHeight - 62, 15, { bold: true, color: "15 23 42", maxWidth: usableWidth * 0.58 });
  drawPdfText(lines, report.category, margin + 54, pageHeight - 77, 9, { color: "71 85 105", maxWidth: usableWidth * 0.58 });
  drawPdfText(lines, `Emitido em ${formatDateTime(report.generatedAt)}`, margin, pageHeight - 48, 8, { align: "right", color: "71 85 105", maxWidth: usableWidth });
  drawPdfText(lines, `Usuário: ${user.name}`, margin, pageHeight - 61, 8, { align: "right", color: "71 85 105", maxWidth: usableWidth });
  drawPdfLine(lines, margin, pageHeight - 92, pageWidth - margin, pageHeight - 92, "15 46 46", 1.2);

  const filterText = report.filters.map((item) => `${item.label}: ${item.value}`).join(" - ") || "Nenhum filtro aplicado";
  drawPdfText(lines, `Filtros: ${filterText} - Registros: ${report.rows.length}`, margin, pageHeight - 112, 8, { color: "71 85 105", maxWidth: usableWidth });

  let y = pageHeight - 136;
  if (report.summary.length > 0) {
    const summaryWidth = Math.min(170, usableWidth / Math.min(report.summary.length, 4) - 8);
    report.summary.slice(0, 4).forEach((item, index) => {
      const x = margin + index * (summaryWidth + 8);
      drawPdfRect(lines, x, y - 22, summaryWidth, 34, "241 245 249");
      drawPdfText(lines, item.label.toUpperCase(), x + 8, y + 1, 6.5, { color: "100 116 139", maxWidth: summaryWidth - 16 });
      drawPdfText(lines, item.value, x + 8, y - 13, 10, { bold: true, color: "15 23 42", maxWidth: summaryWidth - 16 });
    });
    y -= 44;
  }

  drawPdfTableHeader(lines, columns, margin, y, pageWidth - margin * 2);
  return lines;
}

function drawPdfTableHeader(lines: string[], columns: PdfColumn[], margin: number, y: number, usableWidth: number) {
  drawPdfRect(lines, margin, y - 18, usableWidth, 24, "15 46 46");
  let x = margin;
  columns.forEach((column) => {
    const align = column.type === "currency" || column.type === "number" ? "right" : column.type === "date" ? "center" : "left";
    drawPdfText(lines, column.label, x + 6, y - 8, 7.2, {
      align,
      bold: true,
      color: "255 255 255",
      maxWidth: column.width - 12,
    });
    x += column.width;
  });
}

function drawPdfFooter(
  lines: string[],
  report: GeneratedReport,
  pageWidth: number,
  margin: number,
  y: number,
  page: number,
  totalPages: number,
) {
  drawPdfLine(lines, margin, y + 13, pageWidth - margin, y + 13, "226 232 240", 0.6);
  drawPdfText(lines, `Atretu - Relatório operacional - ${formatDateTime(report.generatedAt)}`, margin, y, 7.5, {
    color: "100 116 139",
    maxWidth: pageWidth - margin * 2,
  });
  drawPdfText(lines, `Página ${page} de ${totalPages}`, margin, y, 7.5, {
    align: "right",
    color: "100 116 139",
    maxWidth: pageWidth - margin * 2,
  });
}

function createPdf(pageContents: string[], pageWidth: number, pageHeight: number) {
  const objects: Array<string | Uint8Array> = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageRefs = pageContents.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pageContents.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pageContents.forEach((content, index) => {
    const pageObject = 5 + index * 2;
    const contentObject = pageObject + 1;
    const contentBytes = pdfBytes(content);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(concatBytes([
      pdfBytes(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      pdfBytes("\nendstream"),
    ]));
  });

  const parts: Uint8Array[] = [pdfBytes("%PDF-1.4\n")];
  const offsets: number[] = [];
  let offset = parts[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const objectBytes = typeof object === "string" ? pdfBytes(object) : object;
    const part = concatBytes([
      pdfBytes(`${index + 1} 0 obj\n`),
      objectBytes,
      pdfBytes("\nendobj\n"),
    ]);
    parts.push(part);
    offset += part.length;
  });
  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    ...offsets.map((item) => `${String(item).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  parts.push(pdfBytes(xref));
  return new Blob([concatBytes(parts)], { type: "application/pdf" });
}

type PdfColumn = ReportColumn & { width: number };
type PdfTextOptions = {
  align?: "center" | "left" | "right";
  bold?: boolean;
  color?: string;
  maxWidth?: number;
};

function buildPdfColumns(columns: ReportColumn[], usableWidth: number): PdfColumn[] {
  const weights = columns.map((column) => {
    if (column.type === "currency") return 0.88;
    if (column.type === "date") return 0.82;
    if (/cpf|status|ano/i.test(column.label)) return 0.74;
    if (/institui|acad|ônibus|onibus|cobran/i.test(column.label)) return 1.3;
    return 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return columns.map((column, index) => ({
    ...column,
    width: Math.max(54, (usableWidth * weights[index]!) / totalWeight),
  }));
}

function drawPdfText(lines: string[], text: string, x: number, y: number, size: number, options: PdfTextOptions = {}) {
  const maxWidth = options.maxWidth ?? 120;
  const normalized = sanitizePdfText(clipText(text, Math.max(6, Math.floor(maxWidth / (size * 0.48)))));
  const estimatedWidth = measurePdfText(normalized, size);
  const alignedX = options.align === "right"
    ? x + Math.max(0, maxWidth - estimatedWidth)
    : options.align === "center"
      ? x + Math.max(0, (maxWidth - estimatedWidth) / 2)
      : x;
  lines.push(`BT /${options.bold ? "F2" : "F1"} ${size} Tf ${pdfColor(options.color ?? "71 85 105")} rg ${number(alignedX)} ${number(y)} Td (${escapePdfLiteral(normalized)}) Tj ET`);
}

function drawPdfRect(lines: string[], x: number, y: number, width: number, height: number, color: string) {
  lines.push(`q ${pdfColor(color)} rg ${number(x)} ${number(y)} ${number(width)} ${number(height)} re f Q`);
}

function drawPdfLine(lines: string[], x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  lines.push(`q ${width} w ${pdfColor(color)} RG ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S Q`);
}

function wrapPdfText(value: string, width: number, size: number) {
  const maxChars = Math.max(8, Math.floor(width / (size * 0.46)));
  const words = sanitizePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }
    if (current) {
      lines.push(current);
    }
    current = word.length > maxChars ? clipText(word, maxChars) : word;
  });
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines.slice(0, 3) : ["-"];
}

function measurePdfText(value: string, size: number) {
  return value.length * size * 0.48;
}

function escapePdfLiteral(value: string) {
  return sanitizePdfText(value).replace(/[\\()]/g, "\\$&").replace(/[\r\n\t]/g, " ");
}

function sanitizePdfText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[•·]/g, "-")
    .replace(/[…]/g, "...")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes[index] = code <= 255 ? code : 63;
  }
  return bytes;
}

function number(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function pdfColor(value: string) {
  const parts = value.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return "0 0 0";
  }
  return parts.map((part) => number(part > 1 ? part / 255 : part)).join(" ");
}

export function buildReportXlsx(report: GeneratedReport, user: ApiUser) {
  const rows = [
    ["ATRETU", report.title],
    ["Categoria", report.category],
    ["Emitido em", formatDateTime(report.generatedAt)],
    ["Usuário", user.name],
    [],
    ["Filtros", ...report.filters.map((filter) => `${filter.label}: ${filter.value}`)],
    ["Totais", ...report.summary.map((item) => `${item.label}: ${item.value}`)],
    [],
    report.columns.map((column) => column.label),
    ...report.rows.map((row) => report.columns.map((column) => formatCell(row[column.key], column.type))),
  ];
  const sheetXml = worksheetXml(rows);
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Relatório" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F2E2E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": sheetXml,
  };
  return new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function worksheetXml(rows: string[][]) {
  const widths = rows[8]?.map((_, index) => {
    const width = Math.min(
      42,
      Math.max(12, ...rows.map((row) => String(row[index] ?? "").length + 2)),
    );
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("") ?? "";
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
      const style = rowIndex === 8 ? ' s="1"' : "";
      return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(String(cell ?? ""))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetViews><sheetView workbookViewId="0"><pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData></worksheet>`;
}

function zipFiles(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centralParts.length, true);
  endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function downloadBlob(blob: Blob, filename: string, type: string) {
  const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatCell(value: ReportRow[string], type?: ReportColumn["type"]) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (type === "date") {
    return formatDate(String(value));
  }
  if (type === "currency" && typeof value === "number") {
    return formatCurrency(value);
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  return String(value);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
}

function escapeXml(value: string) {
  return escapeHtml(value);
}

function clipText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function columnName(index: number) {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}
