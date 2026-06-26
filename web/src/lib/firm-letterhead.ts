import { type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  BILLING_DOC_RGB,
  FIRM_NAME,
  FIRM_SUBTITLE
} from "@/lib/billing-document-design";
import { drawWrappedText, pdfColor } from "@/lib/billing-document-pdf/common";
import {
  FIRM_PAGE_SIZE_ORDER,
  firmPageContentWidth,
  getFirmPageSpec,
  type FirmPageSize,
  type FirmPageSpec
} from "@/lib/firm-page-sizes";

export type { FirmPageSize } from "@/lib/firm-page-sizes";
export { FIRM_PAGE_SIZE_ORDER, getFirmPageSpec } from "@/lib/firm-page-sizes";

import {
  formatAddressLines,
  formatFirmContactFormalParts,
  formatFirmContactLine,
  formatFirmContactLines,
  formatFirmContactChannels,
  formatFirmPhoneLine,
  formatFirmWebsiteLabel,
  formatLetterheadFooterAddressLine,
  formatLetterheadFooterDigitalLine,
  formatLetterheadFooterPhoneLine,
  getFirmLetterheadContact,
  type FirmLetterheadContact
} from "@/lib/firm-contact";

export type { FirmLetterheadContact } from "@/lib/firm-contact";
export {
  formatAddressLines,
  formatFirmContactChannels,
  formatFirmContactFormalParts,
  formatFirmContactLine,
  formatFirmContactLines,
  formatFirmPhoneLine,
  formatFirmWebsiteLabel,
  formatLetterheadFooterAddressLine,
  formatLetterheadFooterDigitalLine,
  formatLetterheadFooterPhoneLine,
  getFirmLetterheadContact
};

export * from "./firm-letterhead-html";
import {
  FIRM_LETTER_SPACED_CAPS_NAME,
  FIRM_LETTER_SPACED_CAPS_SUBTITLE
} from "./firm-letterhead-html";

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  pageWidth: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof pdfColor>,
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
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 2,
    color: pdfColor(BILLING_DOC_RGB.ink)
  });
  page.drawLine({
    start: { x: x1, y: y - 4 },
    end: { x: x2, y: y - 4 },
    thickness: 1.1,
    color: pdfColor(BILLING_DOC_RGB.goldLight)
  });
}

function drawLetterheadClosingRule(page: PDFPage, x1: number, x2: number, y: number): number {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 1.1,
    color: pdfColor(BILLING_DOC_RGB.goldLight)
  });
  const mid = (x1 + x2) / 2;
  page.drawCircle({
    x: mid,
    y,
    size: 2,
    borderColor: pdfColor(BILLING_DOC_RGB.goldLight),
    borderWidth: 0.85,
    color: pdfColor(BILLING_DOC_RGB.cream)
  });
  return y - 10;
}

function drawCenteredLogoCrest(
  page: PDFPage,
  pageWidth: number,
  y: number,
  logo: PDFImage,
  logoWidth: number
): number {
  const scaled = logo.scale(logoWidth / logo.width);
  const imgX = (pageWidth - scaled.width) / 2;
  const imgY = y - scaled.height;
  page.drawImage(logo, {
    x: imgX,
    y: imgY,
    width: scaled.width,
    height: scaled.height
  });
  return imgY - 12;
}

function drawSpacedCapsFirmBlock(
  page: PDFPage,
  y: number,
  pageWidth: number,
  font: PDFFont,
  nameSize: number,
  subtitleSize: number
): number {
  y = drawCenteredText(page, FIRM_LETTER_SPACED_CAPS_NAME, y, pageWidth, font, nameSize, pdfColor(BILLING_DOC_RGB.ink), 3);
  return drawCenteredText(
    page,
    FIRM_LETTER_SPACED_CAPS_SUBTITLE,
    y,
    pageWidth,
    font,
    subtitleSize,
    pdfColor(BILLING_DOC_RGB.gold),
    6
  );
}

function footerTextLines(contact: FirmLetterheadContact): {
  text: string;
  size: number;
  tone?: "ink" | "gold" | "muted";
}[] {
  const addressLine = formatLetterheadFooterAddressLine(contact);
  const phoneText = formatLetterheadFooterPhoneLine(contact);
  const digitalText = formatLetterheadFooterDigitalLine(contact);
  const lines: { text: string; size: number; tone?: "ink" | "gold" | "muted" }[] = [
    { text: FIRM_LETTER_SPACED_CAPS_NAME, size: 8.25, tone: "ink" },
    { text: FIRM_LETTER_SPACED_CAPS_SUBTITLE, size: 7.25, tone: "gold" },
    { text: addressLine, size: 6.75, tone: "muted" }
  ];
  if (phoneText) lines.push({ text: phoneText, size: 6.75, tone: "muted" });
  if (digitalText) lines.push({ text: digitalText, size: 6.75, tone: "muted" });
  return lines;
}

function footerBandMetrics(contact: FirmLetterheadContact): {
  textHeight: number;
  ruleBlock: number;
  padding: number;
  lineGap: number;
} {
  const lineGap = 3;
  const ruleBlock = 9;
  const padding = 10;
  const lines = footerTextLines(contact);
  const textHeight = lines.reduce(
    (sum, line, index) => sum + line.size + (index < lines.length - 1 ? lineGap : 0),
    0
  );
  return { textHeight, ruleBlock, padding, lineGap };
}

/** Fixed footer band at the bottom of each letter page. */
export function drawFirmPageFooterPdf(options: {
  page: PDFPage;
  pageWidth: number;
  pageSpec: FirmPageSpec;
  regular: PDFFont;
  contact?: FirmLetterheadContact;
}): void {
  const contact = options.contact ?? getFirmLetterheadContact();
  const x1 = options.pageSpec.margins.left;
  const x2 = options.pageSpec.margins.left + firmPageContentWidth(options.pageSpec);
  const { textHeight, ruleBlock, padding, lineGap } = footerBandMetrics(contact);
  const lines = footerTextLines(contact);
  const bandTop = options.pageSpec.margins.bottom + textHeight + ruleBlock + padding;

  let y = bandTop;
  options.page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 2,
    color: pdfColor(BILLING_DOC_RGB.ink)
  });
  options.page.drawLine({
    start: { x: x1, y: y - 4 },
    end: { x: x2, y: y - 4 },
    thickness: 1.1,
    color: pdfColor(BILLING_DOC_RGB.goldLight)
  });

  y -= ruleBlock + 4;
  for (const line of lines) {
    const color =
      line.tone === "ink"
        ? pdfColor(BILLING_DOC_RGB.ink)
        : line.tone === "gold"
          ? pdfColor(BILLING_DOC_RGB.gold)
          : pdfColor(BILLING_DOC_RGB.muted);
    options.page.drawText(line.text, {
      x: (options.pageWidth - options.regular.widthOfTextAtSize(line.text, line.size)) / 2,
      y: y - line.size,
      size: line.size,
      font: options.regular,
      color
    });
    y -= line.size + lineGap;
  }
}

/** Minimum Y for letter body text — clears footer contact lines and double rules. */
export function firmPageFooterReservePt(
  pageSpec: FirmPageSpec,
  contact: FirmLetterheadContact = getFirmLetterheadContact()
): number {
  const { textHeight, ruleBlock, padding } = footerBandMetrics(contact);
  return pageSpec.margins.bottom + textHeight + ruleBlock + padding + 8;
}

/** @deprecated use firmPageFooterReservePt — kept for callers expecting a fixed band height */
export const FIRM_PAGE_FOOTER_HEIGHT_PT = 58;

/** Draw premium stationery letterhead on a PDF page. Returns Y below the ornament rule. */
export function drawFirmLetterheadPdf(options: {
  page: PDFPage;
  pageWidth: number;
  pageSpec: FirmPageSpec;
  bold: PDFFont;
  regular: PDFFont;
  logo?: PDFImage | null;
  contact?: FirmLetterheadContact;
  compact?: boolean;
}): number {
  const metrics = options.pageSpec.letterhead;
  const contentWidth = firmPageContentWidth(options.pageSpec);
  const x1 = options.pageSpec.margins.left;
  const x2 = options.pageSpec.margins.left + contentWidth;
  let y = options.pageSpec.heightPt - options.pageSpec.margins.top;

  drawHeritageMasthead(options.page, x1, x2, y);
  y -= metrics.paddingTop;

  if (options.compact) {
    y = drawSpacedCapsFirmBlock(
      options.page,
      y,
      options.pageWidth,
      options.bold,
      metrics.firmName - 2,
      metrics.tagline
    );
    y -= metrics.ruleGap;
    y = drawLetterheadClosingRule(options.page, x1, x2, y);
    return y - metrics.bodyGap;
  }

  if (options.logo) {
    y = drawCenteredLogoCrest(options.page, options.pageWidth, y, options.logo, metrics.logo * 2.1);
    y -= metrics.ruleGap;
    y = drawLetterheadClosingRule(options.page, x1, x2, y);
    return y - metrics.bodyGap;
  }

  y = drawSpacedCapsFirmBlock(
    options.page,
    y,
    options.pageWidth,
    options.bold,
    metrics.firmName,
    metrics.tagline
  );

  y -= metrics.ruleGap;
  y = drawLetterheadClosingRule(options.page, x1, x2, y);
  return y - metrics.bodyGap;
}

/** Horizontal letterhead for compact receipts (AR) and narrow pages. */
export function drawFirmLetterheadHorizontalPdf(options: {
  page: PDFPage;
  x: number;
  topY: number;
  contentWidth: number;
  bold: PDFFont;
  regular: PDFFont;
  logo?: PDFImage | null;
  contact?: FirmLetterheadContact;
  compact?: boolean;
}): number {
  const contact = options.contact ?? getFirmLetterheadContact();
  const logoWidth = options.compact ? 72 : 96;
  const gap = 10;
  const textX = options.logo ? options.x + logoWidth + gap : options.x;
  const textWidth = options.logo ? options.contentWidth - logoWidth - gap : options.contentWidth;
  let y = options.topY;

  if (options.logo) {
    const scaled = options.logo.scale(logoWidth / options.logo.width);
    const imgY = y - scaled.height + 4;
    options.page.drawImage(options.logo, {
      x: options.x,
      y: imgY,
      width: scaled.width,
      height: scaled.height
    });
    y -= 5;
    options.page.drawLine({
      start: { x: options.x, y },
      end: { x: options.x + options.contentWidth, y },
      thickness: 0.8,
      color: pdfColor(BILLING_DOC_RGB.ink)
    });
    return y - 10;
  }

  if (!options.compact) {
    options.page.drawText(FIRM_NAME, {
      x: textX,
      y,
      size: 11,
      font: options.bold,
      color: pdfColor(BILLING_DOC_RGB.gold)
    });
    y -= 12;
    options.page.drawText(FIRM_SUBTITLE.toUpperCase(), {
      x: textX,
      y,
      size: 6.5,
      font: options.regular,
      color: pdfColor(BILLING_DOC_RGB.muted)
    });
    y -= 9;
    y = drawWrappedText({
      page: options.page,
      text: contact.address,
      x: textX,
      y,
      maxWidth: textWidth,
      font: options.regular,
      size: 6.5,
      color: pdfColor(BILLING_DOC_RGB.muted),
      lineGap: 8
    });
  } else {
    options.page.drawText(FIRM_NAME, {
      x: textX,
      y,
      size: 9,
      font: options.bold,
      color: pdfColor(BILLING_DOC_RGB.gold)
    });
    y -= 11;
  }

  y -= 5;
  options.page.drawLine({
    start: { x: options.x, y },
    end: { x: options.x + options.contentWidth, y },
    thickness: 0.8,
    color: pdfColor(BILLING_DOC_RGB.goldLight)
  });
  return y - 10;
}
