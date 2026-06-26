import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { pdfSafeText, type LetterPdfTextRun } from "@/lib/letter-pdf-text";

type RunStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color?: string;
  fontSize: number;
  subscript: boolean;
  superscript: boolean;
};

const DEFAULT_STYLE = (baseFontSize: number): RunStyle => ({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  fontSize: baseFontSize,
  subscript: false,
  superscript: false
});

const FONT_SIZE_MAP: Record<string, number> = {
  "1": 8,
  "2": 10,
  "3": 12,
  "4": 14,
  "5": 18,
  "6": 24,
  "7": 36
};

function parseFontSizeValue(raw: string, baseFontSize: number): number {
  const value = raw.trim().toLowerCase();
  if (!value) return baseFontSize;
  const pt = value.match(/^([\d.]+)\s*pt$/);
  if (pt) return Number(pt[1]) || baseFontSize;
  const px = value.match(/^([\d.]+)\s*px$/);
  if (px) return Math.round((Number(px[1]) || baseFontSize) * 0.75);
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : baseFontSize;
}

function parseColorValue(raw: string): string | undefined {
  const value = raw.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  const rgbMatch = value.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = Number(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = Number(rgbMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return undefined;
}

function applyTagAttrs(attrs: string, style: RunStyle, baseFontSize: number): RunStyle {
  const next = { ...style };
  const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
  if (styleMatch) {
    for (const part of styleMatch[1].split(";")) {
      const colon = part.indexOf(":");
      if (colon < 0) continue;
      const prop = part.slice(0, colon).trim().toLowerCase();
      const value = part.slice(colon + 1).trim();
      if (prop === "color") {
        const color = parseColorValue(value);
        if (color) next.color = color;
      } else if (prop === "font-size") {
        next.fontSize = parseFontSizeValue(value, baseFontSize);
      } else if (prop === "font-weight" && /^(bold|[6-9]00)$/.test(value)) {
        next.bold = true;
      }
    }
  }

  const sizeMatch = attrs.match(/size\s*=\s*["']?(\d)["']?/i);
  if (sizeMatch && FONT_SIZE_MAP[sizeMatch[1]]) {
    next.fontSize = FONT_SIZE_MAP[sizeMatch[1]];
  }

  return next;
}

function styleToRun(text: string, style: RunStyle): LetterPdfTextRun {
  let fontSize = style.fontSize;
  if (style.subscript || style.superscript) {
    fontSize = Math.max(8, Math.round(fontSize * 0.75));
  }
  const run: LetterPdfTextRun = { text, fontSize };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.underline) run.underline = true;
  if (style.strike) run.strike = true;
  if (style.color) run.color = style.color;
  if (style.subscript) run.subscript = true;
  if (style.superscript) run.superscript = true;
  return run;
}

function mergeAdjacentRuns(runs: LetterPdfTextRun[]): LetterPdfTextRun[] {
  const merged: LetterPdfTextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.bold === run.bold &&
      prev.italic === run.italic &&
      prev.underline === run.underline &&
      prev.strike === run.strike &&
      prev.color === run.color &&
      prev.fontSize === run.fontSize &&
      prev.subscript === run.subscript &&
      prev.superscript === run.superscript
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function walkDomNode(node: ChildNode, style: RunStyle, runs: LetterPdfTextRun[], baseFontSize: number): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    if (text) runs.push(styleToRun(pdfSafeText(text), style));
    return;
  }
  if (!(node instanceof Element)) return;

  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    runs.push(styleToRun("\n", style));
    return;
  }

  let next = { ...style };
  if (tag === "b" || tag === "strong") next.bold = true;
  else if (tag === "i" || tag === "em") next.italic = true;
  else if (tag === "u") next.underline = true;
  else if (tag === "s" || tag === "strike") next.strike = true;
  else if (tag === "sub") next = { ...next, subscript: true, superscript: false };
  else if (tag === "sup") next = { ...next, superscript: true, subscript: false };
  else if (tag === "span" || tag === "font") {
    const attrString = tag === "font"
      ? `size="${node.getAttribute("size") || ""}" style="${node.getAttribute("style") || ""}"`
      : `style="${node.getAttribute("style") || ""}"`;
    next = applyTagAttrs(attrString, next, baseFontSize);
    if (node instanceof HTMLElement) {
      if (node.style.color) {
        const color = parseColorValue(node.style.color);
        if (color) next.color = color;
      }
      if (node.style.fontSize) next.fontSize = parseFontSizeValue(node.style.fontSize, baseFontSize);
      if (/bold|[6-9]00/.test(node.style.fontWeight)) next.bold = true;
    }
  }

  for (const child of Array.from(node.childNodes)) {
    walkDomNode(child, next, runs, baseFontSize);
  }
}

function parseInlineHtmlWithDom(html: string, baseFontSize: number): LetterPdfTextRun[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const runs: LetterPdfTextRun[] = [];
  for (const child of Array.from(root.childNodes)) {
    walkDomNode(child, DEFAULT_STYLE(baseFontSize), runs, baseFontSize);
  }
  return mergeAdjacentRuns(runs);
}

const OPEN_STYLE_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "strike", "span", "font", "sub", "sup"]);

function parseInlineHtmlWithStack(html: string, baseFontSize: number): LetterPdfTextRun[] {
  const runs: LetterPdfTextRun[] = [];
  const stack: RunStyle[] = [DEFAULT_STYLE(baseFontSize)];
  const parts = html.split(/(<[^>]+>)/g);

  const pushText = (text: string) => {
    if (!text) return;
    runs.push(styleToRun(pdfSafeText(text), stack[stack.length - 1]));
  };

  for (const part of parts) {
    if (!part) continue;
    if (!part.startsWith("<")) {
      pushText(part);
      continue;
    }

    const tag = part.toLowerCase();
    if (tag === "<br>" || tag === "<br/>" || tag === "<br />") {
      pushText("\n");
      continue;
    }

    if (tag.startsWith("</")) {
      const name = tag.slice(2, -1).trim().split(/\s/)[0];
      if (OPEN_STYLE_TAGS.has(name) && stack.length > 1) stack.pop();
      continue;
    }

    const match = tag.match(/^<([a-z0-9]+)([^>]*)>$/i);
    if (!match) continue;
    const name = match[1].toLowerCase();
    const attrs = match[2] || "";
    if (!OPEN_STYLE_TAGS.has(name)) continue;

    const current = { ...stack[stack.length - 1] };
    let next = current;
    if (name === "b" || name === "strong") next = { ...current, bold: true };
    else if (name === "i" || name === "em") next = { ...current, italic: true };
    else if (name === "u") next = { ...current, underline: true };
    else if (name === "s" || name === "strike") next = { ...current, strike: true };
    else if (name === "sub") next = { ...current, subscript: true, superscript: false };
    else if (name === "sup") next = { ...current, superscript: true, subscript: false };
    else if (name === "span" || name === "font") next = applyTagAttrs(attrs, current, baseFontSize);

    stack.push(next);
  }

  return mergeAdjacentRuns(runs);
}

export function parseInlineHtmlToRuns(html: string, baseFontSize = 12): LetterPdfTextRun[] {
  const sanitized = sanitizeRichTextHtml(html);
  if (!sanitized.trim()) return [];

  if (typeof DOMParser !== "undefined") {
    return parseInlineHtmlWithDom(sanitized, baseFontSize);
  }
  return parseInlineHtmlWithStack(sanitized, baseFontSize);
}

export function plainTextToRuns(text: string, partial?: Partial<LetterPdfTextRun>): LetterPdfTextRun[] {
  const safe = pdfSafeText(text);
  if (!safe) return [];
  return [{ text: safe, fontSize: partial?.fontSize ?? 12, ...partial }];
}
