import { describe, expect, it } from "vitest";
import {
  billingEmailLetterheadBannerHtml,
  firmLogoCidSrc,
  inlineFirmLogoInEmailHtml,
  loadFirmLogoInlineImage
} from "@/lib/firm-print-brand";

describe("firm print brand email logo", () => {
  it("loads the firm logo with the correct MIME type", () => {
    const logo = loadFirmLogoInlineImage();
    expect(logo).not.toBeNull();
    expect(logo?.contentId).toBe("ha_firm_logo");
    expect(logo?.mimeType).toBe("image/png");
    expect(logo?.content.length).toBeGreaterThan(1000);
  });

  it("swaps hosted logo URLs for cid references in outgoing HTML", () => {
    const html = billingEmailLetterheadBannerHtml("/brand/logo.png");
    const { html: inlined, logoInline } = inlineFirmLogoInEmailHtml(html);

    expect(logoInline).not.toBeNull();
    expect(inlined).toContain(`src="${firmLogoCidSrc()}"`);
    expect(inlined).not.toContain('/brand/logo.png"');
  });
});
