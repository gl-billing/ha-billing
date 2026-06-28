import { describe, expect, it } from "vitest";
import { buildSoaPreviewHtml } from "@/lib/billing-document-html/soa-preview-html";

describe("buildSoaPreviewHtml", () => {
  it("renders the SOA preview with the two-column statement layout", () => {
    const html = buildSoaPreviewHtml({
      clientName: "Aiden Paul",
      invoiceNumber: "INV-402386"
    });

    expect(html).toContain("soa-sheet");
    expect(html).toContain("soa-doc__header");
    expect(html).toContain("firm-page-foot");
    expect(html).toContain("firm-page-foot__name-block");
    expect(html).toContain("Aiden Paul");
    expect(html).toContain("A C C O U N T");
    expect(html).toContain("D E T A I L E D");
    expect(html).toContain("REMITTANCE INSTRUCTIONS");
    expect(html).toContain("/brand/cover.png");
  });
});
