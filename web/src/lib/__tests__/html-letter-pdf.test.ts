import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inlineLetterHtmlAssets } from "@/lib/html-letter-pdf";

describe("html letter pdf", () => {
  it("inlines brand assets as data uris", () => {
    const logoPath = path.join(process.cwd(), "public", "brand", "logo.png");
    if (!fs.existsSync(logoPath)) return;

    const html = '<img src="/brand/logo.png" />';
    const inlined = inlineLetterHtmlAssets(html);
    expect(inlined).toContain("data:image/png;base64,");
    expect(inlined).not.toContain('src="/brand/logo.png"');
  });
});
