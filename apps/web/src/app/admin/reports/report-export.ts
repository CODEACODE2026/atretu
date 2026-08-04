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
    buildPdf(report, user),
    `${slugify(report.title)}.pdf`,
    "application/pdf",
  );
}

export function downloadReportXlsx(report: GeneratedReport, user: ApiUser) {
  downloadBlob(
    buildXlsx(report, user),
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

function buildPdf(report: GeneratedReport, user: ApiUser) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const columnWidth = usableWidth / report.columns.length;
  const rowsPerPage = 22;
  const pages = chunk(report.rows, rowsPerPage);
  const contentObjects: string[] = [];

  (pages.length ? pages : [[]]).forEach((rows, pageIndex) => {
    const lines: string[] = [];
    drawText(lines, "ATRETU", margin, 800, 16, true, usableWidth);
    drawText(lines, report.title, margin, 778, 15, true, usableWidth);
    drawText(lines, `${report.category} · Emitido em ${formatDateTime(report.generatedAt)} · Usuário: ${user.name}`, margin, 760, 9, false, usableWidth);
    drawText(lines, `Filtros: ${report.filters.map((item) => `${item.label}: ${item.value}`).join(" · ") || "Nenhum filtro aplicado"}`, margin, 744, 8, false, usableWidth);
    drawText(lines, report.summary.map((item) => `${item.label}: ${item.value}`).join("   "), margin, 724, 9, true, usableWidth);
    lines.push("0.06 w 15 46 46 RG 36 712 m 559 712 l S");

    let y = 692;
    report.columns.forEach((column, index) => {
      drawText(lines, column.label, margin + index * columnWidth, y, 8, true, columnWidth - 4);
    });
    y -= 14;
    rows.forEach((row) => {
      report.columns.forEach((column, index) => {
        drawText(lines, formatCell(row[column.key], column.type), margin + index * columnWidth, y, 8, false, columnWidth - 4);
      });
      y -= 24;
    });

    drawText(lines, `Atretu · Relatório operacional · Página ${pageIndex + 1} de ${pages.length || 1}`, margin, 30, 8, false, usableWidth);
    contentObjects.push(lines.join("\n"));
  });

  return createPdf(contentObjects, pageWidth, pageHeight);
}

function createPdf(pageContents: string[], pageWidth: number, pageHeight: number) {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageRefs = pageContents.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pageContents.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pageContents.forEach((content, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}

function drawText(lines: string[], text: string, x: number, y: number, size: number, bold = false, maxWidth = 110) {
  const clipped = clipText(text, Math.max(8, Math.floor(maxWidth / (size * 0.45))));
  lines.push(`BT /F1 ${size} Tf ${bold ? "0 0 0 rg" : "71 85 105 rg"} ${x} ${y} Td <${toUtf16Hex(clipped)}> Tj ET`);
}

function buildXlsx(report: GeneratedReport, user: ApiUser) {
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

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function toUtf16Hex(value: string) {
  const bytes = [0xfe, 0xff];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function clipText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
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
