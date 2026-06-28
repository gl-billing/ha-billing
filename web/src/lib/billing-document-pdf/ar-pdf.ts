import { PDFDocument, StandardFonts, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import { amountToWords } from "@/lib/amount-to-words";
import { formatBillingDate, formatBillingPesoPdf } from "@/lib/billing-document-design";
import { drawWrappedText, embedFirmLogo, wrapText } from "@/lib/billing-document-pdf/common";
import {
  formatLetterheadFooterAddressLines,
  formatLetterheadFooterDigitalLine,
  formatLetterheadFooterPhoneLine,
  getFirmLetterheadContact
} from "@/lib/firm-contact";
import { drawEdgeAlignedCapsLine, drawFooterNameDivider } from "@/lib/firm-letterhead";
import {
  FIRM_LETTER_SPACED_CAPS_NAME,
  FIRM_LETTER_SPACED_CAPS_SUBTITLE
} from "@/lib/firm-letterhead-html";
import {
  FIRM_FOOTER_CAPS_LINE_1,
  FIRM_FOOTER_CAPS_LINE_2,
  footerNameBlockBounds
} from "@/lib/firm-footer-name";

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

const MARGIN = { left: 26, right: 26, top: 20, bottom: 22 };

/** Logo-aligned gold palette — matches firm letterhead (#c9a227) */
const AR = {
  ink: rgb(0.078, 0.067, 0.055),
  gold: rgb(0.788, 0.635, 0.149),
  goldLight: rgb(0.722, 0.569, 0.118),
  goldPale: rgb(0.945, 0.918, 0.827),
  cream: rgb(0.992, 0.988, 0.976),
  muted: rgb(0.42, 0.38, 0.34),
  line: rgb(0.82, 0.78, 0.72),
  white: rgb(1, 1, 1)
};

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  pageWidth: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineGap = 4
): number {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (pageWidth - width) / 2,
    y,
    size,
    font,
    color
  });
  return y - size - lineGap;
}

function drawHeritageMasthead(page: PDFPage, x1: number, x2: number, y: number) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 2, color: AR.ink });
  page.drawLine({
    start: { x: x1, y: y - 3.5 },
    end: { x: x2, y: y - 3.5 },
    thickness: 0.9,
    color: AR.goldLight
  });
}

function drawClosingRule(page: PDFPage, x1: number, x2: number, y: number): number {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.9, color: AR.goldLight });
  const mid = (x1 + x2) / 2;
  page.drawCircle({
    x: mid,
    y,
    size: 2,
    borderColor: AR.goldLight,
    borderWidth: 0.75,
    color: AR.cream
  });
  return y - 8;
}

function drawPremiumFrame(page: PDFPage) {
  const inset = 10;
  page.drawRectangle({
    x: inset,
    y: inset,
    width: PAGE_WIDTH - inset * 2,
    height: PAGE_HEIGHT - inset * 2,
    borderColor: AR.gold,
    borderWidth: 1.4,
    color: AR.cream
  });
  page.drawRectangle({
    x: inset + 4,
    y: inset + 4,
    width: PAGE_WIDTH - inset * 2 - 8,
    height: PAGE_HEIGHT - inset * 2 - 8,
    borderColor: AR.goldPale,
    borderWidth: 0.5,
    color: undefined
  });
}

function drawPremiumLetterhead(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  logo: PDFImage | null
): number {
  const x1 = MARGIN.left;
  const x2 = PAGE_WIDTH - MARGIN.right;
  let y = PAGE_HEIGHT - MARGIN.top;

  drawHeritageMasthead(page, x1, x2, y);
  y -= 22;

  if (logo) {
    const logoWidth = 78;
    const scaled = logo.scale(logoWidth / logo.width);
    page.drawImage(logo, {
      x: (PAGE_WIDTH - scaled.width) / 2,
      y: y - scaled.height,
      width: scaled.width,
      height: scaled.height
    });
    y -= scaled.height + 8;
  }

  y = drawCenteredText(page, FIRM_LETTER_SPACED_CAPS_NAME, y, PAGE_WIDTH, bold, 6.75, AR.ink, 2);
  y = drawCenteredText(page, FIRM_LETTER_SPACED_CAPS_SUBTITLE, y, PAGE_WIDTH, regular, 5.75, AR.gold, 6);
  y = drawClosingRule(page, x1, x2, y);
  return y - 6;
}

function drawDocumentTitle(page: PDFPage, y: number, bold: PDFFont): number {
  const x1 = MARGIN.left + 24;
  const x2 = PAGE_WIDTH - MARGIN.right - 24;
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color: AR.goldPale });
  y -= 10;
  y = drawCenteredText(page, "ACKNOWLEDGMENT RECEIPT", y, PAGE_WIDTH, bold, 10.5, AR.gold, 0);
  y -= 10;
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color: AR.goldPale });
  return y - 14;
}

function drawMetaPanel(
  page: PDFPage,
  y: number,
  input: ArPdfInput,
  bold: PDFFont,
  regular: PDFFont,
  contentWidth: number
): number {
  const panelHeight = 34;
  page.drawRectangle({
    x: MARGIN.left,
    y: y - panelHeight,
    width: contentWidth,
    height: panelHeight,
    color: AR.white,
    borderColor: AR.goldPale,
    borderWidth: 0.7
  });

  const col1 = MARGIN.left + 10;
  const col2 = MARGIN.left + contentWidth * 0.42;
  const col3 = MARGIN.left + contentWidth * 0.72;
  const labelY = y - 12;
  const valueY = y - 24;

  const drawMeta = (label: string, value: string, x: number) => {
    page.drawText(label, { x, y: labelY, size: 6.5, font: bold, color: AR.muted });
    page.drawText(value, { x, y: valueY, size: 8.25, font: bold, color: AR.ink });
  };

  drawMeta("RECEIPT NO.", input.receiptNumber, col1);
  drawMeta("DATE ISSUED", formatBillingDate(input.receiptDate), col2);
  drawMeta("PAYMENT DATE", formatBillingDate(input.paymentDate), col3);

  return y - panelHeight - 14;
}

function drawAmountVault(
  page: PDFPage,
  y: number,
  amount: number,
  bold: PDFFont,
  regular: PDFFont,
  italic: PDFFont,
  contentWidth: number
): number {
  const vaultHeight = 58;
  page.drawRectangle({
    x: MARGIN.left,
    y: y - vaultHeight,
    width: contentWidth,
    height: vaultHeight,
    color: AR.white,
    borderColor: AR.gold,
    borderWidth: 1
  });
  page.drawLine({
    start: { x: MARGIN.left + 8, y: y - 3 },
    end: { x: MARGIN.left + contentWidth - 8, y: y - 3 },
    thickness: 0.5,
    color: AR.goldPale
  });

  page.drawText("AMOUNT RECEIVED", {
    x: MARGIN.left + 12,
    y: y - 16,
    size: 6.5,
    font: bold,
    color: AR.gold
  });
  page.drawText(formatBillingPesoPdf(amount), {
    x: MARGIN.left + 12,
    y: y - 36,
    size: 19,
    font: bold,
    color: AR.gold
  });

  const words = `${amountToWords(amount)} Pesos Only`;
  drawWrappedText({
    page,
    text: words,
    x: MARGIN.left + 12,
    y: y - 50,
    maxWidth: contentWidth - 24,
    font: italic,
    size: 7.5,
    color: AR.ink,
    lineGap: 9
  });

  return y - vaultHeight - 12;
}

function methodChecks(method: string): { cash: boolean; bank: boolean; check: boolean } {
  const lower = String(method || "").toLowerCase();
  return {
    cash: lower.includes("cash"),
    bank: /bank|transfer|gcash|maya|online/.test(lower),
    check: /check|cheque/.test(lower)
  };
}

function drawPaymentMethod(
  page: PDFPage,
  y: number,
  method: string,
  regular: PDFFont
): number {
  const checks = methodChecks(method);
  page.drawText("PAYMENT METHOD", {
    x: MARGIN.left,
    y,
    size: 6.5,
    font: regular,
    color: AR.muted
  });
  y -= 14;

  const drawOption = (x: number, checked: boolean, label: string) => {
    page.drawCircle({
      x: x + 4,
      y: y - 3,
      size: 3.5,
      borderColor: AR.gold,
      borderWidth: 0.65,
      color: checked ? AR.gold : AR.white
    });
    page.drawText(label, { x: x + 12, y: y - 6, size: 8, font: regular, color: AR.ink });
  };

  drawOption(MARGIN.left, checks.cash, "Cash");
  drawOption(MARGIN.left + 72, checks.bank, "Bank / GCash / Maya");
  drawOption(MARGIN.left + 210, checks.check, "Check");
  return y - 18;
}

function drawArFooter(page: PDFPage, regular: PDFFont, bold: PDFFont) {
  const contact = getFirmLetterheadContact();
  const x1 = MARGIN.left;
  const x2 = PAGE_WIDTH - MARGIN.right;
  const contentWidth = PAGE_WIDTH - MARGIN.left - MARGIN.right;
  let y = MARGIN.bottom + 42;

  drawHeritageMasthead(page, x1, x2, y);
  y -= 12;

  const nameSize = 6.75;
  const nameBounds = footerNameBlockBounds(PAGE_WIDTH, (char) => bold.widthOfTextAtSize(char, nameSize));

  const drawCenteredLine = (
    text: string,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    wrap = false
  ) => {
    if (!text.trim()) return;
    if (wrap) {
      const lines = wrapText(text, contentWidth, font, size);
      for (const line of lines) {
        const width = font.widthOfTextAtSize(line, size);
        page.drawText(line, {
          x: (PAGE_WIDTH - width) / 2,
          y: y - size,
          size,
          font,
          color
        });
        y -= size + 1.5;
      }
      return;
    }
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (PAGE_WIDTH - width) / 2,
      y: y - size,
      size,
      font,
      color
    });
    y -= size + 2;
  };

  y = drawEdgeAlignedCapsLine(page, FIRM_FOOTER_CAPS_LINE_1, y, nameBounds.left, nameBounds.right, bold, nameSize, AR.ink, 1);
  y = drawEdgeAlignedCapsLine(page, FIRM_FOOTER_CAPS_LINE_2, y, nameBounds.left, nameBounds.right, bold, nameSize, AR.ink, 1.5);
  y = drawFooterNameDivider(page, PAGE_WIDTH, y);
  for (const addressLine of formatLetterheadFooterAddressLines(contact)) {
    drawCenteredLine(addressLine, 6, regular, AR.muted, true);
  }

  const phoneLine = formatLetterheadFooterPhoneLine(contact);
  if (phoneLine) drawCenteredLine(phoneLine, 6, regular, AR.muted, true);

  const digitalLine = formatLetterheadFooterDigitalLine(contact);
  if (digitalLine) drawCenteredLine(digitalLine, 6, regular, AR.gold, true);
}

export async function buildArPdf(input: ArPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const contentWidth = PAGE_WIDTH - MARGIN.left - MARGIN.right;

  drawPremiumFrame(page);

  let y = drawPremiumLetterhead(page, bold, regular, await embedFirmLogo(pdf));
  y = drawDocumentTitle(page, y, bold);
  y = drawMetaPanel(page, y, input, bold, regular, contentWidth);

  page.drawText("Received from", {
    x: MARGIN.left,
    y,
    size: 7,
    font: italic,
    color: AR.muted
  });
  y -= 13;
  page.drawText(input.clientName, {
    x: MARGIN.left,
    y,
    size: 11.5,
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
      y: y - 3,
      maxWidth: contentWidth,
      font: italic,
      size: 8,
      color: AR.ink,
      lineGap: 10
    });
  }

  y -= 10;
  y = drawAmountVault(page, y, input.amount, bold, regular, italic, contentWidth);

  page.drawText("In payment of", {
    x: MARGIN.left,
    y,
    size: 6.5,
    font: bold,
    color: AR.muted
  });
  y -= 11;
  y = drawWrappedText({
    page,
    text: input.paymentFor,
    x: MARGIN.left,
    y,
    maxWidth: contentWidth,
    font: regular,
    size: 9,
    color: AR.ink,
    lineGap: 10
  });
  y -= 4;

  y = drawPaymentMethod(page, y, input.paymentMethod || "", regular);

  if (input.paymentDetails?.trim()) {
    page.drawText("Reference / details", {
      x: MARGIN.left,
      y,
      size: 6.5,
      font: bold,
      color: AR.muted
    });
    y -= 10;
    y = drawWrappedText({
      page,
      text: input.paymentDetails.trim(),
      x: MARGIN.left,
      y,
      maxWidth: contentWidth,
      font: regular,
      size: 8,
      color: AR.ink,
      lineGap: 9
    });
    y -= 2;
  }

  if (input.balanceAfter !== undefined && input.balanceAfter > 0) {
    page.drawText(`Remaining balance: ${formatBillingPesoPdf(input.balanceAfter)}`, {
      x: MARGIN.left,
      y: y - 2,
      size: 8.25,
      font: regular,
      color: AR.ink
    });
    y -= 16;
  }

  y -= 6;
  page.drawLine({
    start: { x: MARGIN.left, y },
    end: { x: MARGIN.left + 168, y },
    thickness: 0.7,
    color: AR.gold
  });
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
    size: 9,
    font: bold,
    color: AR.ink
  });
  y -= 10;
  page.drawText("For and on behalf of the firm", {
    x: MARGIN.left,
    y,
    size: 7,
    font: italic,
    color: AR.muted
  });

  drawArFooter(page, regular, bold);

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
