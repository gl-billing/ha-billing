import { describe, expect, it } from "vitest";
import {
  isRichTextHtml,
  plainTextToEditorHtml,
  richTextToLetterParagraphs,
  sanitizeRichTextHtml
} from "@/lib/rich-text";

describe("rich text helpers", () => {
  it("detects html bodies", () => {
    expect(isRichTextHtml("<p>Hello</p>")).toBe(true);
    expect(isRichTextHtml("Plain text only")).toBe(false);
  });

  it("converts plain text paragraphs to editor html", () => {
    expect(plainTextToEditorHtml("First.\n\nSecond.")).toBe("<p>First.</p><p>Second.</p>");
  });

  it("sanitizes allowed formatting tags", () => {
    const html = sanitizeRichTextHtml('<p style="text-align: justify"><strong>Hello</strong><script>x</script></p>');
    expect(html).toContain("<strong>Hello</strong>");
    expect(html).not.toContain("script");
  });

  it("sanitizes extended letter formatting", () => {
    const html = sanitizeRichTextHtml(
      '<blockquote style="line-height: 1.5"><s>Old</s> <sup>1</sup></blockquote><hr>'
    );
    expect(html).toContain("blockquote");
    expect(html).toContain("<hr>");
    expect(html).toContain("line-height: 1.5");
  });

  it("converts rich text to plain paragraphs for pdf output", () => {
    expect(richTextToLetterParagraphs("<p>First line</p><ul><li>One</li><li>Two</li></ul>")).toEqual([
      "First line",
      "• One",
      "• Two"
    ]);
  });

  it("keeps separate html paragraphs instead of merging them", () => {
    expect(richTextToLetterParagraphs("<p>First paragraph.</p><p>Second paragraph.</p>")).toEqual([
      "First paragraph.",
      "Second paragraph."
    ]);
  });
});
