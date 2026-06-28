import { PDFDocument, StandardFonts, type PDFPage, rgb } from "pdf-lib";
import { formatPeso } from "@/lib/gl-config";
import { pdfColor, wrapText } from "@/lib/billing-document-pdf/common";
import { drawFirmPageFooterPdf, firmPageFooterReservePt } from "@/lib/firm-letterhead";
import { getFirmPageSpec } from "@/lib/firm-page-sizes";
import type { IncrementalBackupRow } from "@/lib/sheets/incremental-backup-data";

export type BackupPdfInput = {
  rows: IncrementalBackupRow[];
  generatedAt: Date;
  sinceLabel: string;
  untilLabel: string;
};

const C = {
  ink: rgb(0.04, 0.04, 0.04),
  muted: rgb(0.29, 0.29, 0.29),
  rule: rgb(0.75, 0.72, 0.66),
  headerFill: rgb(0.96, 0.95, 0.93)
};

function truncate(text: string, maxLen: number): string {
  const trimmed = String(text || "").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function formatBackupAmount(row: IncrementalBackupRow): string {
  if (row.amount && row.amount > 0) return formatPeso(row.amount);
  return row.details || "—";
}

export async function buildIncrementalBackupPdf(input: BackupPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const pageSpec = getFirmPageSpec("legal");
  const pageWidth = pageSpec.widthPt;
  const pageHeight = pageSpec.heightPt;
  const marginLeft = pageSpec.margins.left;
  const marginRight = pageSpec.margins.right;
  const marginTop = pageSpec.margins.top;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const footerReserve = firmPageFooterReservePt(pageSpec);
  const minY = footerReserve + 24;

  const colWidths = {
    when: 88,
    user: 62,
    client: 48,
    type: 72,
    summary: contentWidth - 88 - 62 - 48 - 72 - 78,
    amount: 78
  };

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  const drawFooter = (target: PDFPage) => {
    drawFirmPageFooterPdf({
      page: target,
      pageWidth,
      pageSpec,
      regular,
      bold
    });
  };

  const startPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
    drawFooter(page);
  };

  const ensureSpace = (needed: number, repeatHeader = false) => {
    if (y - needed >= minY) return;
    startPage();
    if (repeatHeader) drawTableHeader();
  };

  drawFooter(page);

  page.drawText("INCREMENTAL BACKUP REPORT", {
    x: marginLeft,
    y: y - 14,
    size: 14,
    font: bold,
    color: C.ink
  });
  y -= 28;

  const metaLines = [
    `Period covered: ${input.sinceLabel} through ${input.untilLabel}`,
    `Generated: ${input.untilLabel}`,
    `Entries in this backup: ${input.rows.length}`
  ];
  for (const line of metaLines) {
    page.drawText(line, {
      x: marginLeft,
      y: y - 10,
      size: 10,
      font: regular,
      color: C.muted
    });
    y -= 14;
  }

  y -= 8;
  page.drawLine({
    start: { x: marginLeft, y },
    end: { x: marginLeft + contentWidth, y },
    thickness: 0.8,
    color: C.rule
  });
  y -= 18;

  if (!input.rows.length) {
    page.drawText("No new audit or document activity since the last backup.", {
      x: marginLeft,
      y: y - 11,
      size: 11,
      font: regular,
      color: C.muted
    });
    return pdf.save();
  }

  const drawTableHeader = () => {
    ensureSpace(28);
    const headerY = y;
    page.drawRectangle({
      x: marginLeft,
      y: headerY - 16,
      width: contentWidth,
      height: 18,
      color: C.headerFill,
      borderColor: C.rule,
      borderWidth: 0.5
    });
    const headers = [
      { label: "Date / time", width: colWidths.when },
      { label: "User", width: colWidths.user },
      { label: "Client", width: colWidths.client },
      { label: "Type", width: colWidths.type },
      { label: "Summary", width: colWidths.summary },
      { label: "Amount / details", width: colWidths.amount }
    ];
    let x = marginLeft + 4;
    for (const header of headers) {
      page.drawText(header.label, {
        x,
        y: headerY - 12,
        size: 7.5,
        font: bold,
        color: C.ink
      });
      x += header.width;
    }
    y = headerY - 22;
  };

  drawTableHeader();

  for (const row of input.rows) {
    const summaryLines = wrapText(truncate(row.summary, 220), colWidths.summary - 6, regular, 7.5);
    const detailLines = wrapText(truncate(formatBackupAmount(row), 120), colWidths.amount - 4, regular, 7.5);
    const rowHeight = Math.max(summaryLines.length, detailLines.length, 1) * 10 + 6;
    ensureSpace(rowHeight + 4, true);

    let x = marginLeft + 4;
    const baseY = y - 9;
    const cells = [
      truncate(row.timestamp, 28),
      truncate(row.user, 18),
      truncate(row.clientCode, 12),
      truncate(row.category, 22)
    ];
    for (let index = 0; index < cells.length; index += 1) {
      page.drawText(cells[index], {
        x,
        y: baseY,
        size: 7.5,
        font: regular,
        color: C.ink
      });
      x += Object.values(colWidths)[index];
    }

    let summaryY = baseY;
    for (const line of summaryLines) {
      page.drawText(line, {
        x: marginLeft + colWidths.when + colWidths.user + colWidths.client + colWidths.type + 4,
        y: summaryY,
        size: 7.5,
        font: regular,
        color: C.ink
      });
      summaryY -= 10;
    }

    let detailY = baseY;
    for (const line of detailLines) {
      page.drawText(line, {
        x: marginLeft + contentWidth - colWidths.amount + 2,
        y: detailY,
        size: 7.5,
        font: regular,
        color: C.muted
      });
      detailY -= 10;
    }

    y -= rowHeight;
    page.drawLine({
      start: { x: marginLeft, y: y + 2 },
      end: { x: marginLeft + contentWidth, y: y + 2 },
      thickness: 0.35,
      color: pdfColor({ r: 0.88, g: 0.86, b: 0.82 })
    });
  }

  return pdf.save();
}
