import { PDFDocument, StandardFonts } from "pdf-lib";
import { amountToWords } from "@/lib/amount-to-words";
import { FIRM_NAME, formatBillingDate, formatBillingPesoPdf } from "@/lib/billing-document-design";
import {
  C,
  drawFirmLetterheadBlock,
  drawWrappedText,
  embedFirmLogo,
  pdfColor
} from "@/lib/billing-document-pdf/common";

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

/** 127 × 203 mm — matches acknowledgment receipt print size */
const PAGE_WIDTH = (127 / 25.4) * 72;
const PAGE_HEIGHT = (203 / 25.4) * 72;

const MARGIN = { left: 28, right: 28, top: 34, bottom: 28 };

function methodChecks(method: string): { cash: boolean; bank: boolean; check: boolean } {
  const lower = String(method || "").toLowerCase();
  return {
    cash: lower.includes("cash"),
    bank: /bank|transfer|gcash|maya|online/.test(lower),
    check: /check|cheque/.test(lower)
  };
}

function drawCheckbox(
  page: import("pdf-lib").PDFPage,
  x: number,
  y: number,
  checked: boolean,
  label: string,
  font: import("pdf-lib").PDFFont
) {
  page.drawRectangle({
    x,
    y: y - 9,
    width: 10,
    height: 10,
    borderColor: pdfColor(C.gold),
    borderWidth: 0.7,
    color: pdfColor(C.white)
  });
  if (checked) {
    page.drawText("X", { x: x + 2, y: y - 8, size: 8, font, color: pdfColor(C.gold) });
  }
  page.drawText(label, { x: x + 14, y: y - 8, size: 8.5, font, color: pdfColor(C.ink) });
}

export async function buildArPdf(input: ArPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const contentWidth = PAGE_WIDTH - MARGIN.left - MARGIN.right;

  page.drawRectangle({
    x: MARGIN.left - 6,
    y: MARGIN.bottom - 10,
    width: contentWidth + 12,
    height: PAGE_HEIGHT - MARGIN.top - MARGIN.bottom + 20,
    borderColor: pdfColor(C.goldLight),
    borderWidth: 1.2,
    color: pdfColor(C.cream)
  });

  const logo = await embedFirmLogo(pdf);
  let y = drawFirmLetterheadBlock({
    page,
    x: MARGIN.left,
    y: PAGE_HEIGHT - MARGIN.top,
    contentWidth,
    bold,
    regular,
    logo
  });
  y -= 4;

  page.drawText("ACKNOWLEDGMENT RECEIPT", {
    x: MARGIN.left,
    y,
    size: 10.5,
    font: bold,
    color: pdfColor(C.ink)
  });
  y -= 18;

  page.drawText("Receipt No.", { x: MARGIN.left, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  page.drawText(input.receiptNumber, {
    x: MARGIN.left + 72,
    y,
    size: 9,
    font: bold,
    color: pdfColor(C.ink)
  });
  page.drawText("Date", { x: MARGIN.left + 190, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  page.drawText(formatBillingDate(input.receiptDate), {
    x: MARGIN.left + 218,
    y,
    size: 9,
    font: regular,
    color: pdfColor(C.ink)
  });
  y -= 20;

  page.drawText("RECEIVED FROM", { x: MARGIN.left, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  y -= 14;
  page.drawText(input.clientName, { x: MARGIN.left, y, size: 11, font: bold, color: pdfColor(C.ink) });
  y -= 13;
  if (input.clientAddress?.trim()) {
    y = drawWrappedText({
      page,
      text: input.clientAddress.trim(),
      x: MARGIN.left,
      y,
      maxWidth: contentWidth,
      font: regular,
      size: 8.5,
      color: pdfColor(C.muted),
      lineGap: 10
    });
  }
  if (input.caseTitle?.trim()) {
    y = drawWrappedText({
      page,
      text: input.caseTitle.trim(),
      x: MARGIN.left,
      y: y - 4,
      maxWidth: contentWidth,
      font: italic,
      size: 8.5,
      color: pdfColor(C.ink),
      lineGap: 10
    });
  }
  y -= 12;

  page.drawRectangle({
    x: MARGIN.left,
    y: y - 52,
    width: contentWidth,
    height: 56,
    color: pdfColor(C.white),
    borderColor: pdfColor(C.goldPale),
    borderWidth: 0.8
  });
  page.drawText("AMOUNT RECEIVED", {
    x: MARGIN.left + 10,
    y: y - 14,
    size: 7.5,
    font: bold,
    color: pdfColor(C.muted)
  });
  page.drawText(formatBillingPesoPdf(input.amount), {
    x: MARGIN.left + 10,
    y: y - 34,
    size: 18,
    font: bold,
    color: pdfColor(C.gold)
  });
  const words = `${amountToWords(input.amount)} Pesos Only`;
  drawWrappedText({
    page,
    text: words,
    x: MARGIN.left + 10,
    y: y - 48,
    maxWidth: contentWidth - 20,
    font: italic,
    size: 8,
    color: pdfColor(C.ink),
    lineGap: 9
  });
  y -= 68;

  page.drawText("IN PAYMENT OF", { x: MARGIN.left, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  y -= 12;
  y = drawWrappedText({
    page,
    text: input.paymentFor,
    x: MARGIN.left,
    y,
    maxWidth: contentWidth,
    font: regular,
    size: 9.5,
    color: pdfColor(C.ink),
    lineGap: 11
  });
  y -= 6;
  page.drawText(`Payment date: ${formatBillingDate(input.paymentDate)}`, {
    x: MARGIN.left,
    y: y - 2,
    size: 8,
    font: regular,
    color: pdfColor(C.muted)
  });
  y -= 18;

  const checks = methodChecks(input.paymentMethod || "");
  page.drawText("PAYMENT METHOD", { x: MARGIN.left, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  y -= 16;
  drawCheckbox(page, MARGIN.left, y, checks.cash, "Cash", regular);
  drawCheckbox(page, MARGIN.left + 88, y, checks.bank, "Bank / GCash / Maya", regular);
  drawCheckbox(page, MARGIN.left + 220, y, checks.check, "Check", regular);
  y -= 18;

  if (input.paymentDetails?.trim()) {
    page.drawText("Reference / details", {
      x: MARGIN.left,
      y,
      size: 7.5,
      font: bold,
      color: pdfColor(C.muted)
    });
    y -= 11;
    y = drawWrappedText({
      page,
      text: input.paymentDetails.trim(),
      x: MARGIN.left,
      y,
      maxWidth: contentWidth,
      font: regular,
      size: 8.5,
      color: pdfColor(C.ink),
      lineGap: 10
    });
    y -= 4;
  }

  if (input.balanceAfter !== undefined && input.balanceAfter > 0) {
    page.drawText(`Remaining balance: ${formatBillingPesoPdf(input.balanceAfter)}`, {
      x: MARGIN.left,
      y: y - 2,
      size: 8.5,
      font: regular,
      color: pdfColor(C.ink)
    });
    y -= 16;
  }

  y -= 8;
  page.drawLine({
    start: { x: MARGIN.left, y },
    end: { x: MARGIN.left + 180, y },
    thickness: 0.6,
    color: pdfColor(C.line)
  });
  y -= 12;
  page.drawText("Received by", { x: MARGIN.left, y, size: 7.5, font: bold, color: pdfColor(C.muted) });
  y -= 12;
  page.drawText(input.receivedBy?.trim() || FIRM_NAME, {
    x: MARGIN.left,
    y,
    size: 9,
    font: bold,
    color: pdfColor(C.ink)
  });
  y -= 14;
  page.drawText("Authorized firm representative", {
    x: MARGIN.left,
    y,
    size: 7.5,
    font: italic,
    color: pdfColor(C.muted)
  });

  return pdf.save();
}

export function arPdfFilename(receiptNumber: string, suffix = "Acknowledgment_Receipt"): string {
  const safe = receiptNumber.replace(/[^\w.-]+/g, "_");
  return `${safe}_${suffix}.pdf`;
}
