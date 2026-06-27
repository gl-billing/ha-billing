import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { formatBillingDate } from "@/lib/billing-document-design";
import { drawWrappedText, embedFirmLogo } from "@/lib/billing-document-pdf/common";
import { drawFirmLetterheadPdf, drawFirmPageFooterPdf } from "@/lib/firm-letterhead";
import { getFirmPageSpec } from "@/lib/firm-page-sizes";

export type SoaLedgerRow = {
  date: string;
  type?: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
};

export type SoaRemittance = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

export type SoaPdfInput = {
  clientCode: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  caseTitle?: string;
  caseNumber?: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  period?: string;
  prevBalance: number;
  newCharges: number;
  payments: number;
  depositBalance?: number;
  totalDue: number;
  ledger: SoaLedgerRow[];
  remittance?: SoaRemittance;
  notes?: string;
};

const PAGE_SPEC = getFirmPageSpec("a4");
const PAGE_WIDTH = PAGE_SPEC.widthPt;
const PAGE_HEIGHT = PAGE_SPEC.heightPt;
const FOOTER_RESERVE = 78;

const LEFT = 66.8;
const RIGHT = 528;
const META_X = 321.7;
const REMIT_X = 312.8;

const COL = {
  date: 73.5,
  type: 145,
  desc: 193.6,
  charge: 322.6,
  payment: 394.8,
  balance: 480.1
};

const INK = rgb(0.08, 0.07, 0.06);
const MUTED = rgb(0.42, 0.4, 0.38);
const LINE = rgb(0.82, 0.8, 0.78);
const WHITE = rgb(1, 1, 1);

const DEFAULT_NOTES =
  "Thank you for your business. Kindly note the due date indicated. If payment is made through any method other than cash, please send the proof of payment to our email address for immediate posting.";

function letterSpace(text: string): string {
  return text.toUpperCase().split("").join(" ");
}

function letterSpaceWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split("").join(" "))
    .join("  ");
}

function formatSoaDateShort(value: string | Date): string {
  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatAmount(value: number, options?: { parens?: boolean }): string {
  const n = Number(value) || 0;
  const body = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatted = `PHP ${body}`;
  return options?.parens && n > 0 ? `(${formatted})` : formatted;
}

function drawRightAmount(
  page: PDFPage,
  xRight: number,
  y: number,
  amount: number,
  font: PDFFont,
  size: number,
  options?: { parens?: boolean; bold?: boolean }
) {
  const text = formatAmount(amount, { parens: options?.parens });
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: xRight - width,
    y,
    size,
    font,
    color: INK
  });
}

function drawMetaLabelValue(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  labelFont: PDFFont,
  valueFont: PDFFont
) {
  page.drawText(label, { x: META_X, y, size: 7.5, font: labelFont, color: MUTED });
  page.drawText(value, {
    x: RIGHT - valueFont.widthOfTextAtSize(value, 9),
    y: y - 0.2,
    size: 9,
    font: valueFont,
    color: INK
  });
}

function drawSoaTitleBlock(
  page: PDFPage,
  input: SoaPdfInput,
  y: number,
  sansBold: PDFFont,
  serif: PDFFont,
  serifBold: PDFFont
): number {
  const statement = letterSpace("STATEMENT");
  page.drawText(statement, {
    x: RIGHT - serifBold.widthOfTextAtSize(statement, 21),
    y: y + 6,
    size: 21,
    font: serifBold,
    color: INK
  });

  drawMetaLabelValue(page, "PREPARED FOR", input.clientName, y - 16, sansBold, serifBold);
  drawMetaLabelValue(page, "INVOICE NO.", input.invoiceNumber, y - 37, sansBold, serifBold);
  drawMetaLabelValue(
    page,
    "DATE ISSUED",
    formatBillingDate(input.invoiceDate),
    y - 58,
    sansBold,
    serif
  );

  return y - 72;
}

function drawAccountSummary(
  page: PDFPage,
  y: number,
  input: SoaPdfInput,
  sansBold: PDFFont,
  serif: PDFFont,
  serifBold: PDFFont
): number {
  page.drawLine({ start: { x: LEFT, y: y + 8 }, end: { x: RIGHT, y: y + 8 }, thickness: 0.6, color: LINE });

  const heading = letterSpaceWords("ACCOUNT SUMMARY");
  page.drawText(heading, { x: LEFT, y, size: 9.8, font: sansBold, color: INK });
  y -= 28;

  const rows: Array<{ label: string; amount: number; parens?: boolean; bold?: boolean }> = [
    { label: "Previous Balance", amount: input.prevBalance },
    { label: "New Charges", amount: input.newCharges },
    { label: "Payments Received", amount: input.payments, parens: true },
    { label: "Deposit Balance", amount: input.depositBalance ?? 0 }
  ];

  for (const row of rows) {
    page.drawText(row.label, { x: LEFT + 6.7, y, size: 9.8, font: serif, color: INK });
    drawRightAmount(page, RIGHT - 6, y, row.amount, row.bold ? serifBold : serif, 9.8, {
      parens: row.parens
    });
    y -= 27;
  }

  page.drawLine({ start: { x: LEFT, y: y + 10 }, end: { x: RIGHT, y: y + 10 }, thickness: 1.2, color: INK });
  y -= 8;
  page.drawText("TOTAL BALANCE DUE", { x: LEFT + 6.7, y, size: 12, font: serifBold, color: INK });
  drawRightAmount(page, RIGHT - 6, y, input.totalDue, serifBold, 12, { bold: true });
  y -= 24;

  page.drawLine({ start: { x: LEFT, y: y + 6 }, end: { x: RIGHT, y: y + 6 }, thickness: 0.6, color: LINE });
  return y - 18;
}

function drawLedgerHeader(page: PDFPage, y: number, sansBold: PDFFont) {
  const heading = letterSpaceWords("DETAILED LEDGER");
  page.drawText(heading, { x: LEFT, y, size: 9.8, font: sansBold, color: INK });
  y -= 28;

  const labels = [
    { text: "DATE", x: COL.date },
    { text: "TYPE", x: COL.type },
    { text: "DESCRIPTION", x: COL.desc },
    { text: "CHARGE", x: COL.charge },
    { text: "PAYMENT", x: COL.payment },
    { text: "BALANCE", x: COL.balance }
  ];
  for (const label of labels) {
    page.drawText(label.text, { x: label.x, y, size: 7.5, font: sansBold, color: MUTED });
  }
  page.drawLine({ start: { x: LEFT, y: y - 6 }, end: { x: RIGHT, y: y - 6 }, thickness: 0.35, color: LINE });
}

function drawLedgerDataRow(page: PDFPage, row: SoaLedgerRow, y: number, serif: PDFFont) {
  page.drawText(formatSoaDateShort(row.date), { x: COL.date, y, size: 9, font: serif, color: INK });
  page.drawText(String(row.type || "").slice(0, 12), { x: COL.type, y, size: 9, font: serif, color: INK });
  page.drawText(String(row.description || "").slice(0, 42), { x: COL.desc, y, size: 9, font: serif, color: INK });

  if (row.charge > 0) drawRightAmount(page, COL.charge + 48, y, row.charge, serif, 9);
  if (row.payment > 0) drawRightAmount(page, COL.payment + 48, y, row.payment, serif, 9);
  drawRightAmount(page, RIGHT - 6, y, row.balance, serif, 9);

  page.drawLine({ start: { x: LEFT, y: y - 6 }, end: { x: RIGHT, y: y - 6 }, thickness: 0.25, color: LINE });
}

function drawNotesAndRemittance(
  page: PDFPage,
  y: number,
  input: SoaPdfInput,
  sansBold: PDFFont,
  serif: PDFFont,
  serifBold: PDFFont,
  serifItalic: PDFFont
) {
  page.drawText("Notes & Remarks:", { x: LEFT, y, size: 8.2, font: serifBold, color: INK });
  drawWrappedText({
    page,
    text: input.notes?.trim() || DEFAULT_NOTES,
    x: LEFT,
    y: y - 14,
    maxWidth: 230,
    font: serifItalic,
    size: 8.2,
    color: INK,
    lineGap: 11
  });

  const remittance = input.remittance;
  if (!remittance?.bankName && !remittance?.accountName && !remittance?.accountNumber) return;

  let ry = y;
  page.drawText("REMITTANCE INSTRUCTIONS", { x: REMIT_X, y: ry, size: 8.2, font: sansBold, color: INK });
  ry -= 18;

  const drawField = (label: string, value: string) => {
    page.drawText(label, { x: REMIT_X, y: ry, size: 8.2, font: sansBold, color: MUTED });
    ry -= 13;
    page.drawText(value, { x: REMIT_X, y: ry, size: 9, font: serifBold, color: INK });
    ry -= 20;
  };

  if (remittance?.bankName) drawField("BANK NAME", remittance.bankName);
  if (remittance?.accountName) drawField("ACCOUNT NAME", remittance.accountName);
  if (remittance?.accountNumber) drawField("ACCOUNT NUMBER", remittance.accountNumber);
}


export async function buildSoaPdf(input: SoaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await embedFirmLogo(pdf);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawFirmLetterheadPdf({
    page,
    pageWidth: PAGE_WIDTH,
    pageSpec: PAGE_SPEC,
    bold: serifBold,
    regular: serif,
    logo
  });
  y = drawSoaTitleBlock(page, input, y, sansBold, serif, serifBold);
  y = drawAccountSummary(page, y, input, sansBold, serif, serifBold);

  const ensureSpace = (needed: number) => {
    if (y - needed < FOOTER_RESERVE) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 72;
      drawLedgerHeader(page, y, sansBold);
      y -= 24;
    }
  };

  drawLedgerHeader(page, y, sansBold);
  y -= 24;

  for (const row of input.ledger) {
    ensureSpace(24);
    drawLedgerDataRow(page, row, y, serif);
    y -= 22;
  }

  ensureSpace(130);
  y -= 8;
  drawNotesAndRemittance(page, y, input, sansBold, serif, serifBold, serifItalic);

  for (const sheetPage of pdf.getPages()) {
    drawFirmPageFooterPdf({
      page: sheetPage,
      pageWidth: PAGE_WIDTH,
      pageSpec: PAGE_SPEC,
      regular: serif,
      bold: serifBold
    });
  }

  return pdf.save();
}

export function soaPdfFilename(input: Pick<SoaPdfInput, "invoiceNumber" | "clientCode">): string {
  return `${input.invoiceNumber}_${input.clientCode}_SOA.pdf`;
}
