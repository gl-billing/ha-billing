import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, type PDFImage, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { formatBillingDate, FIRM_NAME } from "@/lib/billing-document-design";
import { drawWrappedText, embedFirmCoverBanner } from "@/lib/billing-document-pdf/common";
import { getFirmLetterheadContact } from "@/lib/firm-contact";
import { drawFirmPageFooterPdf, firmPageFooterReservePt } from "@/lib/firm-letterhead";
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
const FOOTER_RESERVE = firmPageFooterReservePt(PAGE_SPEC);

const LEFT = PAGE_SPEC.margins.left;
const RIGHT = PAGE_WIDTH - PAGE_SPEC.margins.right;
const CONTENT_WIDTH = RIGHT - LEFT;
const META_X = LEFT + CONTENT_WIDTH * 0.52;
const REMIT_X = META_X + 8;

const COL = {
  date: LEFT + 7,
  type: LEFT + 78,
  desc: LEFT + 127,
  charge: LEFT + 256,
  payment: LEFT + 328,
  balance: LEFT + 413
};

const INK = rgb(0.08, 0.07, 0.06);
const MUTED = rgb(0.42, 0.4, 0.38);
const LINE = rgb(0.82, 0.8, 0.78);

const DEFAULT_NOTES =
  "Thank you for your business. Kindly note the due date indicated. If payment is made through any method other than cash, please send the proof of payment to our email address for immediate posting.";

const NOTO_SANS_PATH = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");

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

function formatSoaAmount(value: number, options?: { parens?: boolean }): string {
  const n = Number(value) || 0;
  const body = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatted = `₱${body}`;
  return options?.parens && n > 0 ? `(${formatted})` : formatted;
}

async function embedSoaAmountFont(pdf: PDFDocument): Promise<PDFFont> {
  pdf.registerFontkit(fontkit);
  const bytes = fs.readFileSync(NOTO_SANS_PATH);
  return pdf.embedFont(bytes);
}

function drawRightAmount(
  page: PDFPage,
  xRight: number,
  y: number,
  amount: number,
  font: PDFFont,
  size: number,
  options?: { parens?: boolean }
) {
  const text = formatSoaAmount(amount, { parens: options?.parens });
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

function drawSoaContactBlock(
  page: PDFPage,
  startY: number,
  maxWidth: number,
  serif: PDFFont,
  serifBold: PDFFont
): number {
  const contact = getFirmLetterheadContact();
  let y = startY;

  page.drawText(FIRM_NAME, { x: LEFT, y, size: 8.5, font: serifBold, color: INK });
  y -= 13;

  y = drawWrappedText({
    page,
    text: contact.address,
    x: LEFT,
    y,
    maxWidth,
    font: serif,
    size: 8.2,
    color: MUTED,
    lineGap: 10
  });
  y -= 2;

  const phones: string[] = [];
  if (contact.landline.trim()) phones.push(contact.landline.trim());
  if (contact.mobile.trim() && contact.mobile.trim() !== contact.landline.trim()) {
    phones.push(contact.mobile.trim());
  }
  if (phones.length) {
    page.drawText(`T: ${phones.join(" | ")}`, { x: LEFT, y, size: 8.2, font: serif, color: MUTED });
    y -= 11;
  }
  if (contact.email.trim()) {
    page.drawText(`E: ${contact.email.trim()}`, { x: LEFT, y, size: 8.2, font: serif, color: MUTED });
    y -= 11;
  }

  return y;
}

function fitStatementSize(text: string, font: PDFFont, maxWidth: number): number {
  let size = 20;
  while (size > 13 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

/** Two-column header — logo + contact (left), STATEMENT + meta (right). */
function drawSoaHeader(
  page: PDFPage,
  input: SoaPdfInput,
  logo: PDFImage | null,
  sansBold: PDFFont,
  serif: PDFFont,
  serifBold: PDFFont
): number {
  const topY = PAGE_HEIGHT - PAGE_SPEC.margins.top + 2;
  const leftWidth = META_X - LEFT - 12;
  let leftBottom = topY;

  if (logo) {
    const aspect = logo.width / logo.height;
    const bannerHeight = leftWidth / aspect;
    const imgY = topY - bannerHeight;
    page.drawImage(logo, {
      x: LEFT,
      y: imgY,
      width: leftWidth,
      height: bannerHeight
    });
    leftBottom = imgY - 10;
  }

  leftBottom = drawSoaContactBlock(page, leftBottom, leftWidth, serif, serifBold);

  const statement = "STATEMENT";
  const stmtColWidth = RIGHT - META_X;
  const stmtSize = fitStatementSize(statement, serifBold, stmtColWidth);
  const stmtWidth = serifBold.widthOfTextAtSize(statement, stmtSize);
  page.drawText(statement, {
    x: RIGHT - stmtWidth,
    y: topY - stmtSize + 4,
    size: stmtSize,
    font: serifBold,
    color: INK
  });

  let rightY = topY - stmtSize - 10;
  page.drawLine({
    start: { x: META_X, y: rightY },
    end: { x: RIGHT, y: rightY },
    thickness: 0.6,
    color: LINE
  });
  rightY -= 16;

  drawMetaLabelValue(page, "PREPARED FOR", input.clientName, rightY, sansBold, serifBold);
  rightY -= 21;
  drawMetaLabelValue(page, "INVOICE NO.", input.invoiceNumber, rightY, sansBold, serifBold);
  rightY -= 21;
  drawMetaLabelValue(page, "DATE ISSUED", formatBillingDate(input.invoiceDate), rightY, sansBold, serif);

  return Math.min(leftBottom, rightY) - 22;
}

function drawAccountSummary(
  page: PDFPage,
  y: number,
  input: SoaPdfInput,
  sansBold: PDFFont,
  serif: PDFFont,
  serifBold: PDFFont,
  amountFont: PDFFont
): number {
  page.drawLine({ start: { x: LEFT, y: y + 8 }, end: { x: RIGHT, y: y + 8 }, thickness: 0.6, color: LINE });

  const heading = letterSpaceWords("ACCOUNT SUMMARY");
  page.drawText(heading, { x: LEFT, y, size: 9.8, font: sansBold, color: INK });
  y -= 12;
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1.2, color: INK });
  y -= 16;

  const rows: Array<{ label: string; amount: number; parens?: boolean }> = [
    { label: "Previous Balance", amount: input.prevBalance },
    { label: "New Charges", amount: input.newCharges },
    { label: "Payments Received", amount: input.payments, parens: true },
    { label: "Deposit Balance", amount: input.depositBalance ?? 0 }
  ];

  for (const row of rows) {
    page.drawText(row.label, { x: LEFT + 6.7, y, size: 9.8, font: serif, color: INK });
    drawRightAmount(page, RIGHT - 6, y, row.amount, amountFont, 9.8, { parens: row.parens });
    y -= 27;
  }

  page.drawLine({ start: { x: LEFT, y: y + 10 }, end: { x: RIGHT, y: y + 10 }, thickness: 1.2, color: INK });
  y -= 8;
  page.drawText("TOTAL BALANCE DUE", { x: LEFT + 6.7, y, size: 12, font: serifBold, color: INK });
  drawRightAmount(page, RIGHT - 6, y, input.totalDue, amountFont, 12);
  y -= 14;
  page.drawLine({ start: { x: LEFT, y: y + 4 }, end: { x: RIGHT, y: y + 4 }, thickness: 1.2, color: INK });

  return y - 18;
}

function drawLedgerHeader(page: PDFPage, y: number, sansBold: PDFFont) {
  const heading = letterSpaceWords("DETAILED LEDGER");
  page.drawText(heading, { x: LEFT, y, size: 9.8, font: sansBold, color: INK });
  y -= 12;
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1.2, color: INK });
  y -= 16;

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

function drawLedgerDataRow(
  page: PDFPage,
  row: SoaLedgerRow,
  y: number,
  serif: PDFFont,
  amountFont: PDFFont
) {
  page.drawText(formatSoaDateShort(row.date), { x: COL.date, y, size: 9, font: serif, color: INK });
  page.drawText(String(row.type || "").slice(0, 12), { x: COL.type, y, size: 9, font: serif, color: INK });
  page.drawText(String(row.description || "").slice(0, 42), { x: COL.desc, y, size: 9, font: serif, color: INK });

  if (row.charge > 0) drawRightAmount(page, COL.charge + 48, y, row.charge, amountFont, 9);
  if (row.payment > 0) drawRightAmount(page, COL.payment + 48, y, row.payment, amountFont, 9);
  drawRightAmount(page, RIGHT - 6, y, row.balance, amountFont, 9);

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
  page.drawText("Notes & Remarks:", { x: LEFT, y, size: 8.2, font: serifItalic, color: INK });
  drawWrappedText({
    page,
    text: input.notes?.trim() || DEFAULT_NOTES,
    x: LEFT,
    y: y - 14,
    maxWidth: META_X - LEFT - 18,
    font: serifItalic,
    size: 8.2,
    color: INK,
    lineGap: 11
  });

  const remittance = input.remittance;
  if (!remittance?.bankName && !remittance?.accountName && !remittance?.accountNumber) return;

  const boxPad = 12;
  const labelColW = 96;
  const labelSize = 7.5;
  const valueSize = 9.2;
  const rowGap = 17;
  const innerLeft = REMIT_X;
  const valueX = innerLeft + labelColW;

  const rows: Array<{ label: string; value: string }> = [];
  if (remittance?.bankName) rows.push({ label: "BANK NAME", value: remittance.bankName });
  if (remittance?.accountName) rows.push({ label: "ACCOUNT NAME", value: remittance.accountName });
  if (remittance?.accountNumber) rows.push({ label: "ACCOUNT NUMBER", value: remittance.accountNumber });

  const titleBlock = 28;
  const rowsBlock = rows.length * rowGap + 4;
  const boxHeight = boxPad * 2 + titleBlock + rowsBlock;
  const boxTop = y + 6;
  const boxBottom = boxTop - boxHeight;
  const boxLeft = REMIT_X - boxPad;
  const boxWidth = RIGHT - boxLeft;

  page.drawRectangle({
    x: boxLeft,
    y: boxBottom,
    width: boxWidth,
    height: boxHeight,
    borderColor: INK,
    borderWidth: 0.75
  });

  let ry = boxTop - boxPad;
  page.drawText("REMITTANCE INSTRUCTIONS", {
    x: innerLeft,
    y: ry,
    size: 8,
    font: sansBold,
    color: INK
  });
  ry -= 9;
  page.drawLine({
    start: { x: innerLeft, y: ry },
    end: { x: RIGHT - 4, y: ry },
    thickness: 0.4,
    color: LINE
  });
  ry -= 15;

  for (const row of rows) {
    page.drawText(row.label, { x: innerLeft, y: ry, size: labelSize, font: sansBold, color: MUTED });
    page.drawText(row.value, { x: valueX, y: ry, size: valueSize, font: serifBold, color: INK });
    ry -= rowGap;
  }
}

export async function buildSoaPdf(input: SoaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const amountFont = await embedSoaAmountFont(pdf);
  const logo = await embedFirmCoverBanner(pdf);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawSoaHeader(page, input, logo, sansBold, serif, serifBold);
  y = drawAccountSummary(page, y, input, sansBold, serif, serifBold, amountFont);

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
    drawLedgerDataRow(page, row, y, serif, amountFont);
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
      regular: sans,
      bold: sansBold
    });
  }

  return pdf.save();
}

export function soaPdfFilename(input: Pick<SoaPdfInput, "invoiceNumber" | "clientCode">): string {
  return `${input.invoiceNumber}_${input.clientCode}_SOA.pdf`;
}
