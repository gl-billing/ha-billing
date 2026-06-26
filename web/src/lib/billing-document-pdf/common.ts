import fs from "fs";
import { rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  BILLING_DOC_RGB
} from "@/lib/billing-document-design";
import { drawFirmLetterheadHorizontalPdf } from "@/lib/firm-letterhead";
import { FIRM_LOGO_PATH } from "@/lib/firm-print-brand";

export const C = BILLING_DOC_RGB;

export function pdfColor(c: { r: number; g: number; b: number }) {
  return rgb(c.r, c.g, c.b);
}

export function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function drawWrappedText(options: {
  page: import("pdf-lib").PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  lineGap?: number;
}): number {
  const lines = wrapText(options.text, options.maxWidth, options.font, options.size);
  const gap = options.lineGap ?? options.size + 3;
  let y = options.y;
  for (const line of lines) {
    options.page.drawText(line, {
      x: options.x,
      y,
      size: options.size,
      font: options.font,
      color: options.color ?? pdfColor(C.ink)
    });
    y -= gap;
  }
  return y;
}

export function drawGoldRule(
  page: PDFPage,
  y: number,
  x1: number,
  x2: number,
  thickness = 0.8
) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color: pdfColor(C.goldLight)
  });
}

async function embedLogoBytes(pdf: PDFDocument, filePath: string): Promise<PDFImage | null> {
  try {
    const bytes = fs.readFileSync(filePath);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      return await pdf.embedJpg(bytes);
    }
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function embedFirmLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  return embedLogoBytes(pdf, FIRM_LOGO_PATH);
}

/** Official firm seal for contracts and formal letter PDFs. */
export async function embedFirmLetterheadLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  return embedFirmLogo(pdf);
}

/** Shared letterhead block for AR and compact PDFs — logo, firm identity, gold rule. */
export function drawFirmLetterheadBlock(options: {
  page: PDFPage;
  x: number;
  y: number;
  contentWidth: number;
  bold: PDFFont;
  regular: PDFFont;
  logo?: PDFImage | null;
}): number {
  return drawFirmLetterheadHorizontalPdf({
    page: options.page,
    x: options.x,
    topY: options.y,
    contentWidth: options.contentWidth,
    bold: options.bold,
    regular: options.regular,
    logo: options.logo
  });
}
