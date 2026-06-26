import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { rgb } from "pdf-lib";
import { pdfColor } from "@/lib/billing-document-pdf/common";
import { BILLING_DOC_RGB } from "@/lib/billing-document-design";

export type LetterPdfAlign = "left" | "center" | "right" | "justify";

export type LetterPdfTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  fontSize?: number;
  subscript?: boolean;
  superscript?: boolean;
};

export type LetterPdfBodyBlock = {
  runs: LetterPdfTextRun[];
  align: LetterPdfAlign;
  indentPt?: number;
  prefix?: string;
};

export type LetterPdfFontSet = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

const DEFAULT_INK = rgb(0.1, 0.09, 0.07);

export function pdfSafeText(text: string): string {
  return String(text || "")
    .replace(/\u20b1/g, "PHP ")
    .replace(/₱/g, "PHP ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
}

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export function pickLetterPdfFont(run: LetterPdfTextRun, fonts: LetterPdfFontSet): PDFFont {
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

function runColor(run: LetterPdfTextRun): RGB {
  if (run.color) return hexToRgb(run.color);
  return DEFAULT_INK;
}

function runSize(run: LetterPdfTextRun, baseSize: number): number {
  return run.fontSize ?? baseSize;
}

type LayoutToken = LetterPdfTextRun & { isSpace: boolean; isLineBreak?: boolean };

function tokenizeRuns(runs: LetterPdfTextRun[]): LayoutToken[] {
  const tokens: LayoutToken[] = [];
  for (const run of runs) {
    const segments = String(run.text || "").split("\n");
    segments.forEach((segment, segmentIndex) => {
      const parts = segment.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        tokens.push({
          ...run,
          text: part,
          isSpace: /^\s+$/.test(part)
        });
      }
      if (segmentIndex < segments.length - 1) {
        tokens.push({ ...run, text: "", isSpace: false, isLineBreak: true });
      }
    });
  }
  return tokens;
}

function measureToken(token: LayoutToken, fonts: LetterPdfFontSet, baseSize: number): number {
  if (token.isLineBreak || !token.text) return 0;
  const font = pickLetterPdfFont(token, fonts);
  return font.widthOfTextAtSize(pdfSafeText(token.text), runSize(token, baseSize));
}

function layoutTokensToLines(
  tokens: LayoutToken[],
  maxWidth: number,
  fonts: LetterPdfFontSet,
  baseSize: number
): LayoutToken[][] {
  const lines: LayoutToken[][] = [];
  let line: LayoutToken[] = [];
  let lineWidth = 0;

  for (const token of tokens) {
    if (token.isLineBreak) {
      while (line.length && line[line.length - 1].isSpace) line.pop();
      if (line.length) lines.push(line);
      line = [];
      lineWidth = 0;
      continue;
    }

    const width = measureToken(token, fonts, baseSize);
    if (line.length && lineWidth + width > maxWidth && !token.isSpace) {
      while (line.length && line[line.length - 1].isSpace) line.pop();
      if (line.length) lines.push(line);
      line = [];
      lineWidth = 0;
    }
    if (token.isSpace && !line.length) continue;
    line.push(token);
    lineWidth += width;
  }

  while (line.length && line[line.length - 1].isSpace) line.pop();
  if (line.length) lines.push(line);
  return lines.length ? lines : [[]];
}

function lineWidth(tokens: LayoutToken[], fonts: LetterPdfFontSet, baseSize: number): number {
  return tokens.reduce((sum, token) => sum + measureToken(token, fonts, baseSize), 0);
}

function drawRunDecorations(
  page: PDFPage,
  token: LayoutToken,
  x: number,
  y: number,
  width: number,
  size: number,
  color: RGB
): void {
  if (token.underline) {
    page.drawLine({
      start: { x, y: y - 1.5 },
      end: { x: x + width, y: y - 1.5 },
      thickness: 0.6,
      color
    });
  }
  if (token.strike) {
    page.drawLine({
      start: { x, y: y + size * 0.3 },
      end: { x: x + width, y: y + size * 0.3 },
      thickness: 0.6,
      color
    });
  }
}

function drawFormattedLine(
  page: PDFPage,
  tokens: LayoutToken[],
  x: number,
  y: number,
  maxWidth: number,
  fonts: LetterPdfFontSet,
  baseSize: number,
  align: LetterPdfAlign,
  justify: boolean
): void {
  const contentWidth = lineWidth(tokens, fonts, baseSize);
  let cursorX = x;
  if (align === "center") cursorX = x + (maxWidth - contentWidth) / 2;
  if (align === "right") cursorX = x + maxWidth - contentWidth;

  const wordGapIndexes: number[] = [];
  tokens.forEach((token, index) => {
    if (token.isLineBreak || !token.text) return;
    if (!token.isSpace && index < tokens.length - 1 && tokens[index + 1] && !tokens[index + 1].isSpace && !tokens[index + 1].isLineBreak) {
      wordGapIndexes.push(index);
    }
  });

  let extraGap = 0;
  if (justify && wordGapIndexes.length > 0) {
    extraGap = Math.max(0, maxWidth - contentWidth) / wordGapIndexes.length;
  }

  tokens.forEach((token, index) => {
    if (token.isLineBreak || !token.text) return;
    const font = pickLetterPdfFont(token, fonts);
    const size = runSize(token, baseSize);
    const color = runColor(token);
    const text = pdfSafeText(token.text);
    let drawY = y;
    if (token.subscript) drawY -= size * 0.35;
    if (token.superscript) drawY += size * 0.45;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cursorX, y: drawY, size, font, color });
    drawRunDecorations(page, token, cursorX, drawY, width, size, color);
    cursorX += width;
    if (wordGapIndexes.includes(index)) cursorX += extraGap;
  });
}

export function measureFormattedTextBlock(
  runs: LetterPdfTextRun[],
  maxWidth: number,
  fonts: LetterPdfFontSet,
  baseSize: number,
  lineGap: number,
  paragraphGap: number
): number {
  const tokens = tokenizeRuns(runs);
  if (!tokens.length) return 0;
  const lines = layoutTokensToLines(tokens, maxWidth, fonts, baseSize);
  return lines.length * lineGap + paragraphGap;
}

export function drawFormattedTextBlock(options: {
  page: PDFPage;
  runs: LetterPdfTextRun[];
  x: number;
  y: number;
  maxWidth: number;
  fonts: LetterPdfFontSet;
  baseSize: number;
  align?: LetterPdfAlign;
  lineGap: number;
  paragraphGap?: number;
}): number {
  const align = options.align || "left";
  const paragraphGap = options.paragraphGap ?? 0;
  const tokens = tokenizeRuns(options.runs);
  if (!tokens.length) return options.y - paragraphGap;

  const lines = layoutTokensToLines(tokens, options.maxWidth, options.fonts, options.baseSize);
  let y = options.y;

  lines.forEach((line, index) => {
    const isLastLine = index === lines.length - 1;
    const shouldJustify = align === "justify" && !isLastLine && line.some((token) => !token.isSpace);
    drawFormattedLine(
      options.page,
      line,
      options.x,
      y,
      options.maxWidth,
      options.fonts,
      options.baseSize,
      shouldJustify ? "justify" : align === "justify" ? "left" : align,
      shouldJustify
    );
    y -= options.lineGap;
  });

  return y - paragraphGap;
}

export function wrapTextLine(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = pdfSafeText(text).split(/\s+/).filter(Boolean);
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

export function measureAlignedTextBlock(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
  lineGap: number,
  paragraphGap: number
): number {
  const lines = wrapTextLine(text, maxWidth, font, size);
  if (!lines.length || (lines.length === 1 && !lines[0])) return 0;
  return lines.length * lineGap + paragraphGap;
}

function drawWordsOnLine(
  page: PDFPage,
  words: string[],
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  align: LetterPdfAlign,
  justify: boolean
): void {
  if (!words.length) return;

  const safeWords = words.map((word) => pdfSafeText(word));
  const widths = safeWords.map((word) => font.widthOfTextAtSize(word, size));
  const textWidth = widths.reduce((sum, width) => sum + width, 0);

  if (justify && safeWords.length > 1) {
    const gapCount = safeWords.length - 1;
    const extra = Math.max(0, maxWidth - textWidth);
    const gap = extra / gapCount;
    let cursorX = x;
    safeWords.forEach((word, index) => {
      page.drawText(word, { x: cursorX, y, size, font, color: DEFAULT_INK });
      cursorX += widths[index] + (index < gapCount ? gap : 0);
    });
    return;
  }

  const line = safeWords.join(" ");
  const lineWidth = font.widthOfTextAtSize(line, size);
  let drawX = x;
  if (align === "center") drawX = x + (maxWidth - lineWidth) / 2;
  if (align === "right") drawX = x + maxWidth - lineWidth;
  page.drawText(line, { x: drawX, y, size, font, color: DEFAULT_INK });
}

export function drawAlignedTextBlock(options: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  align?: LetterPdfAlign;
  lineGap: number;
  paragraphGap?: number;
  justifyBody?: boolean;
}): number {
  const align = options.align || "left";
  const paragraphGap = options.paragraphGap ?? 0;
  const lines = wrapTextLine(options.text, options.maxWidth, options.font, options.size);
  let y = options.y;

  lines.forEach((line, index) => {
    const words = line.split(/\s+/).filter(Boolean);
    const isLastLine = index === lines.length - 1;
    const shouldJustify =
      align === "justify" || (options.justifyBody === true && align !== "center" && align !== "right");
    drawWordsOnLine(
      options.page,
      words,
      options.x,
      y,
      options.maxWidth,
      options.font,
      options.size,
      align,
      shouldJustify && !isLastLine && words.length > 1
    );
    y -= options.lineGap;
  });

  return y - paragraphGap;
}

export function drawGoldRule(
  page: PDFPage,
  y: number,
  x1: number,
  x2: number,
  thickness = 0.6
): void {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color: pdfColor(BILLING_DOC_RGB.muted)
  });
}
