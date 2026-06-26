import { describe, expect, it } from "vitest";
import {
  correspondenceBodyBlocksForPdf,
  correspondenceTitleAlign
} from "@/lib/correspondence-pdf-body";
import { parseInlineHtmlToRuns } from "@/lib/letter-pdf-rich-text";
import { wrapTextLine } from "@/lib/letter-pdf-text";
import { PDFDocument, StandardFonts } from "pdf-lib";

describe("correspondence pdf body", () => {
  it("defaults plain paragraphs to justified blocks", () => {
    expect(correspondenceBodyBlocksForPdf("First paragraph.\n\nSecond paragraph.")).toEqual([
      { runs: [{ text: "First paragraph.", fontSize: 12 }], align: "justify" },
      { runs: [{ text: "Second paragraph.", fontSize: 12 }], align: "justify" }
    ]);
  });

  it("reads text-align from rich text blocks", () => {
    expect(
      correspondenceBodyBlocksForPdf(
        '<p style="text-align: justify">Justified paragraph.</p><p style="text-align: center">Centered paragraph.</p>'
      )
    ).toEqual([
      { runs: [{ text: "Justified paragraph.", fontSize: 12 }], align: "justify" },
      { runs: [{ text: "Centered paragraph.", fontSize: 12 }], align: "center" }
    ]);
  });

  it("keeps list items as separate indented blocks", () => {
    expect(correspondenceBodyBlocksForPdf("<ul><li>First item</li><li>Second item</li></ul>")).toEqual([
      {
        runs: [
          { text: "• ", fontSize: 12 },
          { text: "First item", fontSize: 12 }
        ],
        align: "justify",
        indentPt: 18,
        prefix: "•"
      },
      {
        runs: [
          { text: "• ", fontSize: 12 },
          { text: "Second item", fontSize: 12 }
        ],
        align: "justify",
        indentPt: 18,
        prefix: "•"
      }
    ]);
  });

  it("centers document titles in pdf output", () => {
    expect(correspondenceTitleAlign()).toBe("center");
  });
});

describe("letter pdf rich text", () => {
  it("parses bold, italic, underline, and color runs", () => {
    const runs = parseInlineHtmlToRuns(
      '<p>Plain <strong>bold</strong> <em>italic</em> <u>underlined</u> <span style="color: #8b1e1e">red</span></p>'
    );
    expect(runs.some((run) => run.text.includes("bold") && run.bold)).toBe(true);
    expect(runs.some((run) => run.text.includes("italic") && run.italic)).toBe(true);
    expect(runs.some((run) => run.text.includes("underlined") && run.underline)).toBe(true);
    expect(runs.some((run) => run.text.includes("red") && run.color === "#8b1e1e")).toBe(true);
  });

  it("parses font size from span styles", () => {
    const runs = parseInlineHtmlToRuns('<span style="font-size: 18pt">Large text</span>');
    expect(runs[0]?.fontSize).toBe(18);
  });
});

describe("letter pdf text", () => {
  it("wraps long lines for pdf layout", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    const lines = wrapTextLine(
      "This is a longer sentence that should wrap across multiple lines in the PDF output.",
      180,
      font,
      12
    );
    expect(lines.length).toBeGreaterThan(1);
  });
});
