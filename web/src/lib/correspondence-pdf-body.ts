import {
  bodyParagraphs,
  type CorrespondenceLetterInput
} from "@/lib/firm-correspondence-preview";
import {
  parseInlineHtmlToRuns,
  plainTextToRuns
} from "@/lib/letter-pdf-rich-text";
import {
  type LetterPdfAlign,
  type LetterPdfBodyBlock,
  type LetterPdfTextRun
} from "@/lib/letter-pdf-text";
import { isRichTextHtml, sanitizeRichTextHtml } from "@/lib/rich-text";

function parseAlign(attrs: string): LetterPdfAlign {
  const match = attrs.match(/text-align:\s*(left|center|right|justify)/i);
  if (!match) return "justify";
  return match[1].toLowerCase() as LetterPdfAlign;
}

function blockFromPlainLine(text: string): LetterPdfBodyBlock {
  const listMatch = text.match(/^((?:•|\d+\.)\s+)([\s\S]*)$/);
  if (!listMatch) {
    return { runs: plainTextToRuns(text), align: "justify" };
  }
  return {
    runs: plainTextToRuns(listMatch[2].trim()),
    align: "justify",
    indentPt: 18,
    prefix: listMatch[1].trim()
  };
}

function prependPrefixRuns(block: LetterPdfBodyBlock): LetterPdfBodyBlock {
  if (!block.prefix?.trim()) return block;
  return {
    ...block,
    runs: [{ text: `${block.prefix} `, fontSize: 12 }, ...block.runs]
  };
}

function parseRichTextBlocks(html: string, baseFontSize = 12): LetterPdfBodyBlock[] {
  const sanitized = sanitizeRichTextHtml(html);
  const blocks: LetterPdfBodyBlock[] = [];
  const tagRe = /<(ul|ol|p|div|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(sanitized))) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const inner = match[3] || "";

    if (tag === "ul" || tag === "ol") {
      const itemRe = /<li([^>]*)>([\s\S]*?)<\/li>/gi;
      let itemMatch: RegExpExecArray | null;
      let index = 0;
      while ((itemMatch = itemRe.exec(inner))) {
        index += 1;
        const itemAttrs = itemMatch[1] || attrs;
        const runs = parseInlineHtmlToRuns(itemMatch[2] || "", baseFontSize);
        if (!runs.length) continue;
        blocks.push(
          prependPrefixRuns({
            runs,
            align: parseAlign(itemAttrs),
            indentPt: 18,
            prefix: tag === "ul" ? "•" : `${index}.`
          })
        );
      }
      continue;
    }

    const runs = parseInlineHtmlToRuns(inner, baseFontSize);
    if (!runs.length) continue;
    blocks.push({
      runs,
      align: parseAlign(attrs)
    });
  }

  return blocks;
}

export function correspondenceBodyBlocksForPdf(body: string, baseFontSize = 12): LetterPdfBodyBlock[] {
  if (!isRichTextHtml(body)) {
    return bodyParagraphs(body).map((text) => blockFromPlainLine(text));
  }

  const parsed = parseRichTextBlocks(body, baseFontSize);
  if (parsed.length) return parsed;
  return bodyParagraphs(body).map((text) => blockFromPlainLine(text));
}

export function correspondenceTitleAlign(): LetterPdfAlign {
  return "center";
}

export function correspondenceLetterBodyBlocks(input: CorrespondenceLetterInput): LetterPdfBodyBlock[] {
  return correspondenceBodyBlocksForPdf(input.body);
}

export function runsWithStyle(
  runs: LetterPdfTextRun[],
  partial: Partial<LetterPdfTextRun>
): LetterPdfTextRun[] {
  if (!runs.length) return plainTextToRuns("", partial);
  return runs.map((run) => ({ ...run, ...partial }));
}
