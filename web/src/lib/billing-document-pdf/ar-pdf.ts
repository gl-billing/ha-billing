import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import { amountToWords } from "@/lib/amount-to-words";
import { BILLING_DOC_RGB, formatBillingDate, formatBillingPeso } from "@/lib/billing-document-design";
import { drawWrappedText, embedFirmLogo } from "@/lib/billing-document-pdf/common";
import { drawFirmPageFooterPdf, firmPageFooterReservePt } from "@/lib/firm-letterhead";
import {
  FIRM_LETTER_SPACED_CAPS_NAME,
  FIRM_LETTER_SPACED_CAPS_SUBTITLE
} from "@/lib/firm-letterhead-html";
import { getFirmPageSpec, type FirmPageSpec } from "@/lib/firm-page-sizes";
import { displayLedgerDetails, receiptPaymentForLabel } from "@/lib/ledger-display";

export type ArPdfInput = {
  receiptNumber: string;
  receiptDate: string | Date;
  paymentDate: string | Date;
  clientName: string;
  clientAddress?: string;
  caseTitle?: string;
  paymentFor: string;
  amount: number;
  balanceAfter?: number;
  paymentMethod?: string;
  paymentDetails?: string;
  receivedBy?: string;
};

/** 127 × 203 mm — acknowledgment receipt print size */
const PAGE_WIDTH = (127 / 25.4) * 72;
const PAGE_HEIGHT = (203 / 25.4) * 72;

/** Same firm footer band as SOA, sized for the AR receipt page. */
const PAGE_SPEC: FirmPageSpec = {
  ...getFirmPageSpec("a4"),
  label: "Acknowledgment Receipt (127 × 203 mm)",
  widthPt: PAGE_WIDTH,
  heightPt: PAGE_HEIGHT,
  widthCss: "127mm",
  heightCss: "203mm",
  margins: { top: 22, right: 28, bottom: 24, left: 28 }
};

const MARGIN = PAGE_SPEC.margins;
const FOOTER_RESERVE = firmPageFooterReservePt(PAGE_SPEC);

const AR = {
  ink: rgb(BILLING_DOC_RGB.ink.r, BILLING_DOC_RGB.ink.g, BILLING_DOC_RGB.ink.b),
  muted: rgb(BILLING_DOC_RGB.muted.r, BILLING_DOC_RGB.muted.g, BILLING_DOC_RGB.muted.b),
  line: rgb(BILLING_DOC_RGB.line.r, BILLING_DOC_RGB.line.g, BILLING_DOC_RGB.line.b),
  pale: rgb(BILLING_DOC_RGB.goldPale.r, BILLING_DOC_RGB.goldPale.g, BILLING_DOC_RGB.goldPale.b),
  white: rgb(BILLING_DOC_RGB.white.r, BILLING_DOC_RGB.white.g, BILLING_DOC_RGB.white.b)
};

const NOTO_SANS_PATH = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");

async function embedAmountFont(pdf: PDFDocument): Promise<PDFFont> {
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(fs.readFileSync(NOTO_SANS_PATH));
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineGap = 4
): number {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y,
    size,
    font,
    color
  });
  return y - size - lineGap;
}

function drawHairline(page: PDFPage, x1: number, x2: number, y: number, thickness = 0.6) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color: AR.line
  });
}

function drawFrame(page: PDFPage) {
  const inset = 11;
  page.drawRectangle({
    x: inset,
    y: inset,
    width: PAGE_WIDTH - inset * 2,
    height: PAGE_HEIGHT - inset * 2,
    borderColor: AR.ink,
    borderWidth: 1.1,
    color: AR.white
  });
  page.drawRectangle({
    x: inset + 3.5,
    y: inset + 3.5,
    width: PAGE_WIDTH - inset * 2 - 7,
    height: PAGE_HEIGHT - inset * 2 - 7,
    borderColor: AR.pale,
    borderWidth: 0.45
  });
}

function drawLetterhead(page: PDFPage, bold: PDFFont, regular: PDFFont, logo: PDFImage | null): number {
  const x1 = MARGIN.left;
  const x2 = PAGE_WIDTH - MARGIN.right;
  let y = PAGE_HEIGHT - MARGIN.top;

  drawHairline(page, x1, x2, y, 1.4);
  drawHairline(page, x1, x2, y - 3, 0.45);
  y -= 18;

  if (logo) {
    const logoWidth = 64;
    const scaled = logo.scale(logoWidth / logo.width);
    page.drawImage(logo, {
      x: (PAGE_WIDTH - scaled.width) / 2,
      y: y - scaled.height,
      width: scaled.width,
      height: scaled.height
    });
    y -= scaled.height + 8;
  }

  y = drawCenteredText(page, FIRM_LETTER_SPACED_CAPS_NAME, y, bold, 6.5, AR.ink, 2);
  y = drawCenteredText(page, FIRM_LETTER_SPACED_CAPS_SUBTITLE, y, regular, 5.5, AR.muted, 8);
  drawHairline(page, x1 + 36, x2 - 36, y, 0.55);
  return y - 14;
}

function drawTitle(page: PDFPage, y: number, bold: PDFFont): number {
  y = drawCenteredText(page, "ACKNOWLEDGMENT RECEIPT", y, bold, 11, AR.ink, 0);
  return y - 16;
}

function drawMetaRow(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  labelFont: PDFFont,
  valueFont: PDFFont,
  contentWidth: number
): number {
  page.drawText(label, {
    x: MARGIN.left,
    y,
    size: 7,
    font: labelFont,
    color: AR.muted
  });
  const valueWidth = valueFont.widthOfTextAtSize(value, 8.5);
  page.drawText(value, {
    x: MARGIN.left + contentWidth - valueWidth,
    y,
    size: 8.5,
    font: valueFont,
    color: AR.ink
  });
  drawHairline(page, MARGIN.left, MARGIN.left + contentWidth, y - 5, 0.35);
  return y - 16;
}

function drawAmountBlock(
  page: PDFPage,
  y: number,
  amount: number,
  bold: PDFFont,
  italic: PDFFont,
  amountFont: PDFFont,
  contentWidth: number
): number {
  const height = 54;
  page.drawRectangle({
    x: MARGIN.left,
    y: y - height,
    width: contentWidth,
    height,
    borderColor: AR.ink,
    borderWidth: 0.9,
    color: AR.white
  });

  page.drawText("AMOUNT RECEIVED", {
    x: MARGIN.left + 12,
    y: y - 14,
    size: 6.5,
    font: bold,
    color: AR.muted
  });

  const amountText = formatBillingPeso(amount);
  page.drawText(amountText, {
    x: MARGIN.left + 12,
    y: y - 34,
    size: 18,
    font: amountFont,
    color: AR.ink
  });

  drawWrappedText({
    page,
    text: `${amountToWords(amount)} Pesos Only`,
    x: MARGIN.left + 12,
    y: y - 46,
    maxWidth: contentWidth - 24,
    font: italic,
    size: 7,
    color: AR.muted,
    lineGap: 8
  });

  return y - height - 14;
}

function drawLabeledValue(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  bold: PDFFont,
  regular: PDFFont,
  contentWidth: number,
  valueSize = 10
): number {
  page.drawText(label, {
    x: MARGIN.left,
    y,
    size: 6.5,
    font: bold,
    color: AR.muted
  });
  y -= 12;
  y = drawWrappedText({
    page,
    text: value,
    x: MARGIN.left,
    y,
    maxWidth: contentWidth,
    font: regular,
    size: valueSize,
    color: AR.ink,
    lineGap: 11
  });
  return y - 8;
}

function formatMethodLabel(method: string): string {
  const trimmed = String(method || "").trim();
  if (!trimmed) return "—";
  const lower = trimmed.toLowerCase();
  if (lower.includes("gcash")) return "GCash";
  if (lower.includes("maya")) return "Maya";
  if (/bank|transfer|online/.test(lower)) return "Bank transfer";
  if (/check|cheque/.test(lower)) return "Check";
  if (lower.includes("cash")) return "Cash";
  return trimmed;
}

export async function buildArPdf(input: ArPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const amountFont = await embedAmountFont(pdf);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const contentWidth = PAGE_WIDTH - MARGIN.left - MARGIN.right;

  drawFrame(page);

  let y = drawLetterhead(page, bold, regular, await embedFirmLogo(pdf));
  y = drawTitle(page, y, bold);

  y = drawMetaRow(page, "RECEIPT NO.", input.receiptNumber, y, bold, bold, contentWidth);
  y = drawMetaRow(page, "DATE ISSUED", formatBillingDate(input.receiptDate), y, bold, regular, contentWidth);
  y = drawMetaRow(page, "PAYMENT DATE", formatBillingDate(input.paymentDate), y, bold, regular, contentWidth);
  y -= 4;

  page.drawText("Received from", {
    x: MARGIN.left,
    y,
    size: 6.5,
    font: italic,
    color: AR.muted
  });
  y -= 13;
  page.drawText(input.clientName, {
    x: MARGIN.left,
    y,
    size: 12,
    font: bold,
    color: AR.ink
  });
  y -= 12;

  if (input.clientAddress?.trim()) {
    y = drawWrappedText({
      page,
      text: input.clientAddress.trim(),
      x: MARGIN.left,
      y,
      maxWidth: contentWidth,
      font: regular,
      size: 8,
      color: AR.muted,
      lineGap: 10
    });
  }

  if (input.caseTitle?.trim()) {
    y = drawWrappedText({
      page,
      text: input.caseTitle.trim(),
      x: MARGIN.left,
      y: y - 2,
      maxWidth: contentWidth,
      font: italic,
      size: 8,
      color: AR.ink,
      lineGap: 10
    });
  }

  y -= 12;
  y = drawAmountBlock(page, y, input.amount, bold, italic, amountFont, contentWidth);

  const paymentFor = receiptPaymentForLabel(input.paymentFor);
  y = drawLabeledValue(page, "In payment of", paymentFor, y, bold, bold, contentWidth, 10.5);

  y = drawLabeledValue(
    page,
    "Payment method",
    formatMethodLabel(input.paymentMethod || ""),
    y,
    bold,
    regular,
    contentWidth,
    9.5
  );

  const reference = displayLedgerDetails(input.paymentDetails || "").trim();
  if (reference) {
    y = drawLabeledValue(page, "Reference", reference, y, bold, regular, contentWidth, 9);
  }

  if (input.balanceAfter !== undefined && input.balanceAfter > 0) {
    page.drawText(`Remaining balance  ${formatBillingPeso(input.balanceAfter)}`, {
      x: MARGIN.left,
      y,
      size: 8.5,
      font: amountFont,
      color: AR.ink
    });
    y -= 16;
  }

  // Keep signature block clear of the shared firm footer band (same as SOA).
  if (y < FOOTER_RESERVE + 48) {
    y = FOOTER_RESERVE + 48;
  }

  y -= 4;
  drawHairline(page, MARGIN.left, MARGIN.left + 150, y, 0.8);
  y -= 12;
  page.drawText("Received by", {
    x: MARGIN.left,
    y,
    size: 6.5,
    font: bold,
    color: AR.muted
  });
  y -= 11;
  page.drawText(input.receivedBy?.trim() || "Authorized Firm Representative", {
    x: MARGIN.left,
    y,
    size: 9.5,
    font: bold,
    color: AR.ink
  });
  y -= 11;
  page.drawText("For and on behalf of the firm", {
    x: MARGIN.left,
    y,
    size: 7,
    font: italic,
    color: AR.muted
  });

  drawFirmPageFooterPdf({
    page,
    pageWidth: PAGE_WIDTH,
    pageSpec: PAGE_SPEC,
    regular: sans,
    bold: sansBold
  });
  return pdf.save();
}

export function arPdfFilename(receiptNumber: string, clientCode?: string): string {
  const safe = receiptNumber.replace(/[^\w.-]+/g, "_");
  if (clientCode) {
    const code = clientCode.replace(/[^\w.-]+/g, "_");
    return `${safe}_${code}_Acknowledgment_Receipt.pdf`;
  }
  return `${safe}_Acknowledgment_Receipt.pdf`;
}
