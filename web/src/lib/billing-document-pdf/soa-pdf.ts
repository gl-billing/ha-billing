import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib";
import { formatBillingDate, formatBillingPesoPdf } from "@/lib/billing-document-design";
import { C, drawWrappedText, pdfColor } from "@/lib/billing-document-pdf/common";

export type SoaLedgerRow = {
  date: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
};

export type SoaPdfInput = {
  clientCode: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  caseTitle: string;
  caseNumber?: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  period: string;
  prevBalance: number;
  newCharges: number;
  payments: number;
  totalDue: number;
  ledger: SoaLedgerRow[];
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const LETTERHEAD_PATH = path.join(process.cwd(), "public", "brand", "letterhead-a4.jpg");

const MARGIN = {
  left: 52,
  right: 52,
  top: 168,
  bottom: 72
};

const TABLE = {
  date: 52,
  desc: 112,
  charge: 392,
  payment: 462,
  balance: 532,
  right: 543
};

function moneyOrDash(value: number): string {
  const n = Number(value) || 0;
  return n > 0 ? formatBillingPesoPdf(n) : "-";
}

function addLetterheadPage(pdf: PDFDocument, letterhead: PDFImage): PDFPage {
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(letterhead, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
  return page;
}

function drawGoldRule(page: PDFPage, y: number, x1 = MARGIN.left, x2 = A4_WIDTH - MARGIN.right) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.8,
    color: pdfColor(C.goldLight)
  });
}

function drawTableHeader(page: PDFPage, y: number, bold: PDFFont) {
  page.drawRectangle({
    x: MARGIN.left,
    y: y - 16,
    width: TABLE.right - MARGIN.left,
    height: 20,
    color: pdfColor(C.headerBg)
  });
  const labels = [
    { text: "DATE", x: TABLE.date },
    { text: "DESCRIPTION", x: TABLE.desc },
    { text: "CHARGES", x: TABLE.charge },
    { text: "PAYMENTS", x: TABLE.payment },
    { text: "BALANCE", x: TABLE.balance }
  ];
  for (const label of labels) {
    page.drawText(label.text, {
      x: label.x,
      y: y - 11,
      size: 7.5,
      font: bold,
      color: pdfColor(C.goldPale)
    });
  }
}

function drawLedgerRow(
  page: PDFPage,
  row: SoaLedgerRow,
  y: number,
  regular: PDFFont,
  stripe: boolean
) {
  if (stripe) {
    page.drawRectangle({
      x: MARGIN.left,
      y: y - 14,
      width: TABLE.right - MARGIN.left,
      height: 18,
      color: pdfColor(C.cream)
    });
  }
  page.drawText(String(row.date || "").slice(0, 12), {
    x: TABLE.date,
    y: y - 10,
    size: 8.5,
    font: regular,
    color: pdfColor(C.ink)
  });
  drawWrappedText({
    page,
    text: row.description,
    x: TABLE.desc,
    y: y - 10,
    maxWidth: TABLE.charge - TABLE.desc - 8,
    font: regular,
    size: 8.5,
    lineGap: 11
  });
  page.drawText(moneyOrDash(row.charge), {
    x: TABLE.charge,
    y: y - 10,
    size: 8.5,
    font: regular,
    color: pdfColor(C.ink)
  });
  page.drawText(moneyOrDash(row.payment), {
    x: TABLE.payment,
    y: y - 10,
    size: 8.5,
    font: regular,
    color: pdfColor(C.ink)
  });
  page.drawText(formatBillingPesoPdf(row.balance), {
    x: TABLE.balance,
    y: y - 10,
    size: 8.5,
    font: regular,
    color: pdfColor(C.ink)
  });
  page.drawLine({
    start: { x: MARGIN.left, y: y - 16 },
    end: { x: TABLE.right, y: y - 16 },
    thickness: 0.35,
    color: pdfColor(C.line)
  });
}

function drawSummaryBlock(
  page: PDFPage,
  y: number,
  input: SoaPdfInput,
  regular: PDFFont,
  bold: PDFFont
): number {
  const boxWidth = 220;
  const boxX = TABLE.right - boxWidth;
  const rows = [
    { label: "Previous balance", value: formatBillingPesoPdf(input.prevBalance) },
    { label: "New charges", value: formatBillingPesoPdf(input.newCharges) },
    { label: "Payments received", value: formatBillingPesoPdf(input.payments) }
  ];

  page.drawRectangle({
    x: boxX,
    y: y - 88,
    width: boxWidth,
    height: 92,
    borderColor: pdfColor(C.goldLight),
    borderWidth: 0.8,
    color: pdfColor(C.white)
  });

  let rowY = y - 18;
  for (const row of rows) {
    page.drawText(row.label, { x: boxX + 12, y: rowY, size: 9, font: regular, color: pdfColor(C.muted) });
    page.drawText(row.value, { x: boxX + 112, y: rowY, size: 9, font: regular, color: pdfColor(C.ink) });
    rowY -= 16;
  }

  drawGoldRule(page, rowY + 6, boxX + 8, boxX + boxWidth - 8);
  rowY -= 10;
  page.drawText("TOTAL AMOUNT DUE", {
    x: boxX + 12,
    y: rowY,
    size: 10,
    font: bold,
    color: pdfColor(C.gold)
  });
  page.drawText(formatBillingPesoPdf(input.totalDue), {
    x: boxX + 112,
    y: rowY,
    size: 11,
    font: bold,
    color: pdfColor(C.ink)
  });

  return rowY - 24;
}

export async function buildSoaPdf(input: SoaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const letterheadBytes = fs.readFileSync(LETTERHEAD_PATH);
  const letterhead = await pdf.embedJpg(letterheadBytes);

  let page = addLetterheadPage(pdf, letterhead);
  let y = A4_HEIGHT - MARGIN.top;

  page.drawText("STATEMENT OF ACCOUNT", {
    x: MARGIN.left,
    y,
    size: 13,
    font: bold,
    color: pdfColor(C.gold)
  });
  y -= 10;
  drawGoldRule(page, y);
  y -= 22;

  page.drawText("BILL TO", { x: MARGIN.left, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  y -= 14;
  page.drawText(input.clientName, { x: MARGIN.left, y, size: 11, font: bold, color: pdfColor(C.ink) });
  y -= 14;
  if (input.clientAddress?.trim()) {
    y = drawWrappedText({
      page,
      text: input.clientAddress.trim(),
      x: MARGIN.left,
      y,
      maxWidth: 280,
      font: regular,
      size: 10,
      color: pdfColor(C.muted),
      lineGap: 13
    });
  }
  if (input.clientPhone?.trim()) {
    page.drawText(input.clientPhone.trim(), {
      x: MARGIN.left,
      y: y - 2,
      size: 9.5,
      font: regular,
      color: pdfColor(C.muted)
    });
    y -= 14;
  }

  const matter = [input.caseTitle, input.caseNumber ? `Case No. ${input.caseNumber}` : ""]
    .filter(Boolean)
    .join("  ·  ");
  page.drawText("MATTER", { x: MARGIN.left, y: y - 4, size: 7.5, font: bold, color: pdfColor(C.muted) });
  y = drawWrappedText({
    page,
    text: matter,
    x: MARGIN.left,
    y: y - 18,
    maxWidth: A4_WIDTH - MARGIN.left - MARGIN.right,
    font: italic,
    size: 10,
    color: pdfColor(C.ink),
    lineGap: 13
  });
  y -= 10;

  const metaY = y;
  const meta = [
    { label: "Invoice No.", value: input.invoiceNumber },
    { label: "Statement Date", value: formatBillingDate(input.invoiceDate) },
    { label: "Billing Period", value: input.period }
  ];
  meta.forEach((item, index) => {
    const x = MARGIN.left + index * 170;
    page.drawText(item.label.toUpperCase(), {
      x,
      y: metaY,
      size: 7,
      font: bold,
      color: pdfColor(C.muted)
    });
    page.drawText(item.value, {
      x,
      y: metaY - 12,
      size: 9.5,
      font: regular,
      color: pdfColor(C.ink)
    });
  });
  y = metaY - 34;

  drawTableHeader(page, y, bold);
  y -= 28;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN.bottom + 100) {
      page = addLetterheadPage(pdf, letterhead);
      y = A4_HEIGHT - MARGIN.top;
      drawTableHeader(page, y, bold);
      y -= 28;
    }
  };

  input.ledger.forEach((row, index) => {
    ensureSpace(22);
    drawLedgerRow(page, row, y, regular, index % 2 === 0);
    y -= 20;
  });

  ensureSpace(110);
  y -= 8;
  y = drawSummaryBlock(page, y, input, regular, bold);

  drawWrappedText({
    page,
    text:
      "This statement reflects professional fees, reimbursements, and payments recorded in our billing ledger. Please remit payment by the due date indicated in your engagement terms.",
    x: MARGIN.left,
    y: Math.max(MARGIN.bottom + 28, y),
    maxWidth: 360,
    font: italic,
    size: 8,
    color: pdfColor(C.muted),
    lineGap: 10
  });

  const footer = `Client ref. ${input.clientCode}  ·  ${input.invoiceNumber}`;
  page.drawText(footer, {
    x: MARGIN.left,
    y: MARGIN.bottom - 4,
    size: 7.5,
    font: regular,
    color: pdfColor(C.muted)
  });

  return pdf.save();
}

export function soaPdfFilename(input: Pick<SoaPdfInput, "invoiceNumber" | "clientCode">): string {
  return `${input.invoiceNumber}_${input.clientCode}_SOA.pdf`;
}
