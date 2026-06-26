const RICH_TEXT_TAG_RE = /<\/?[a-z][\s\S]*?>/i;

export function isRichTextHtml(value: string): boolean {
  return RICH_TEXT_TAG_RE.test(value);
}

export function escapeRichTextPlain(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToEditorHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const lines = paragraph.split("\n").map((line) => escapeRichTextPlain(line));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

export function normalizeEditorHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return isRichTextHtml(trimmed) ? trimmed : plainTextToEditorHtml(trimmed);
}

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "span",
  "ul",
  "ol",
  "li",
  "div",
  "blockquote",
  "hr",
  "font"
]);

const ALLOWED_STYLE_PROPS = new Set([
  "font-size",
  "font-family",
  "color",
  "background-color",
  "text-align",
  "line-height",
  "text-indent",
  "margin-left",
  "font-weight"
]);

const SAFE_COLOR_RE = /^#[0-9a-f]{3,8}$/i;

function sanitizeStyle(style: string): string {
  const parts = style
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const safe: string[] = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/expression|url\s*\(|javascript:/i.test(value)) continue;
    if ((prop === "color" || prop === "background-color") && !SAFE_COLOR_RE.test(value) && !/^rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(value)) continue;
    if (prop === "line-height" && !/^[\d.]+(%|px|em|rem)?$/.test(value)) continue;
    if ((prop === "text-indent" || prop === "margin-left") && !/^[\d.]+(px|em|rem|%)?$/.test(value)) continue;
    if (prop === "font-weight" && !/^(normal|bold|[1-9]00)$/.test(value)) continue;
    safe.push(`${prop}: ${value}`);
  }
  return safe.join("; ");
}

/** Strip unsafe tags/attributes while keeping basic formatting for letter preview. */
export function sanitizeRichTextHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+="[^"]*"/gi, "");
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  function walk(node: Element): string {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return Array.from(node.childNodes)
        .map((child) => (child.nodeType === Node.TEXT_NODE ? child.textContent || "" : child instanceof Element ? walk(child) : ""))
        .join("");
    }

    const attrs: string[] = [];
    if (tag === "span" || tag === "p" || tag === "div" || tag === "li" || tag === "blockquote" || tag === "font") {
      const style = node.getAttribute("style");
      let safeStyle = style ? sanitizeStyle(style) : "";
      if (tag === "font") {
        const color = node.getAttribute("color");
        const size = node.getAttribute("size");
        if (color && !safeStyle.includes("color:")) safeStyle = `${safeStyle}${safeStyle ? "; " : ""}color: ${color}`;
        if (size === "2") safeStyle = `${safeStyle}${safeStyle ? "; " : ""}font-size: 10pt`;
        if (size === "3") safeStyle = `${safeStyle}${safeStyle ? "; " : ""}font-size: 12pt`;
        if (size === "5") safeStyle = `${safeStyle}${safeStyle ? "; " : ""}font-size: 18pt`;
        if (size === "6") safeStyle = `${safeStyle}${safeStyle ? "; " : ""}font-size: 24pt`;
      }
      if (safeStyle) attrs.push(`style="${escapeRichTextPlain(safeStyle)}"`);
    }

    const inner = Array.from(node.childNodes)
      .map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return escapeRichTextPlain(child.textContent || "");
        if (child instanceof Element) return walk(child);
        return "";
      })
      .join("");

    if (tag === "br") return "<br>";
    if (tag === "hr") return "<hr>";
    if (tag === "font") {
      return `<span${attrs.length ? ` ${attrs.join(" ")}` : ""}>${inner}</span>`;
    }
    return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${inner}</${tag}>`;
  }

  return Array.from(root.childNodes)
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        return text ? `<p>${escapeRichTextPlain(text)}</p>` : "";
      }
      if (child instanceof Element) return walk(child);
      return "";
    })
    .join("");
}

export function richTextToPlainText(html: string): string {
  if (!isRichTextHtml(html)) return html.trim();

  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/li>/gi, "")
      .replace(/<ol[^>]*>/gi, "\n")
      .replace(/<\/ol>/gi, "\n")
      .replace(/<ul[^>]*>/gi, "\n")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  function blockText(node: Element): string {
    const tag = node.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      return Array.from(node.children)
        .map((li, index) => {
          const bullet = tag === "ul" ? "• " : `${index + 1}. `;
          return `${bullet}${inlineText(li)}`;
        })
        .join("\n");
    }
    if (tag === "blockquote") return `“${inlineText(node).trim()}”`;
    if (tag === "hr") return "—";
    if (tag === "br") return "\n";
    return inlineText(node);
  }

  function inlineText(node: Element | ChildNode): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof Element)) return "";
    return Array.from(node.childNodes).map((child) => inlineText(child)).join("");
  }

  return Array.from(root.childNodes)
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) return (child.textContent || "").trim();
      if (child instanceof Element) return blockText(child).trim();
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function richTextToLetterParagraphs(html: string): string[] {
  if (!isRichTextHtml(html)) {
    return html
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  if (typeof DOMParser !== "undefined") {
    return extractRichTextLetterBlocks(html);
  }

  const plain = richTextToPlainText(html);
  return plain
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function inlineTextWithBreaks(node: Element | ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof Element)) return "";
  if (node.tagName.toLowerCase() === "br") return "\n";
  return Array.from(node.childNodes).map((child) => inlineTextWithBreaks(child)).join("");
}

function extractRichTextLetterBlocks(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];

  const blocks: string[] = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent || "").trim();
      if (text) blocks.push(text);
      continue;
    }
    if (!(child instanceof Element)) continue;

    const tag = child.tagName.toLowerCase();
    if (tag === "ul") {
      for (const li of Array.from(child.children)) {
        if (li.tagName.toLowerCase() !== "li") continue;
        const text = inlineTextWithBreaks(li).trim();
        if (text) blocks.push(`• ${text}`);
      }
      continue;
    }
    if (tag === "ol") {
      Array.from(child.children).forEach((li, index) => {
        if (li.tagName.toLowerCase() !== "li") return;
        const text = inlineTextWithBreaks(li).trim();
        if (text) blocks.push(`${index + 1}. ${text}`);
      });
      continue;
    }
    if (tag === "hr") {
      blocks.push("—");
      continue;
    }

    const text = inlineTextWithBreaks(child).trim();
    if (text) blocks.push(text);
  }

  return blocks;
}
