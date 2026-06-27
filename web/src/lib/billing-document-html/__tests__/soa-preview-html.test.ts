import { describe, expect, it } from "vitest";
import { buildSoaPreviewHtml } from "@/lib/billing-document-html/soa-preview-html";

describe("buildSoaPreviewHtml", () => {
  it("wraps the SOA sample in firm letterhead HTML", () => {
    const html = buildSoaPreviewHtml({
      clientName: "Aiden Paul",
      invoiceNumber: "INV-402386"
    });

    expect(html).toContain("firm-lh");
    expect(html).toContain("firm-page-foot");
    expect(html).toContain("Aiden Paul");
    expect(html).toContain("A C C O U N T");
    expect(html).toContain("D E T A I L E D");
    expect(html).toContain("sheet--a4");
  });
});
