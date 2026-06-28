import { describe, expect, it } from "vitest";
import {
  buildFirmLetterheadHtml,
  buildFirmPageFooterHtml,
  formatAddressLines,
  formatFirmContactLine,
  formatFirmContactLines,
  formatFirmPhoneLine,
  formatLetterheadFooterAddressLines,
  getFirmLetterheadContact
} from "@/lib/firm-letterhead";
import { FIRM_PAGE_SIZE_ORDER, getFirmPageSpec } from "@/lib/firm-page-sizes";

describe("firm page sizes", () => {
  it("defines letter, legal, and A4 dimensions", () => {
    expect(getFirmPageSpec("letter").widthPt).toBeCloseTo(612, 0);
    expect(getFirmPageSpec("letter").heightPt).toBeCloseTo(792, 0);
    expect(getFirmPageSpec("legal").heightPt).toBeCloseTo(936, 0);
    expect(getFirmPageSpec("a4").widthPt).toBeCloseTo(595.28, 1);
    expect(FIRM_PAGE_SIZE_ORDER).toEqual(["letter", "legal", "a4"]);
  });
});

describe("firm letterhead contact", () => {
  it("includes address, landline, email, and website defaults for Hernandez Law", () => {
    const contact = getFirmLetterheadContact();
    expect(contact.address).toContain("Acacia Bldg.");
    expect(contact.address).toContain("Davao City");
    expect(contact.email).toBe("legal@hernandezlaw.info");
    expect(contact.landline).toBe("(082) 324 5269");
    expect(contact.website).toContain("hernandezlaw.info");
  });

  it("formats a single contact line for compact layouts", () => {
    const line = formatFirmContactLine({
      address: "Sample address",
      mobile: "+63 917 111 2222",
      landline: "+63 898 103 2990",
      email: "info@example.com",
      website: "www.example.com"
    });
    expect(line).toContain("Mobile +63 917 111 2222");
    expect(line).toContain("Tel. +63 898 103 2990");
    expect(line).toContain("info@example.com");
    expect(line).toContain("www.example.com");
  });

  it("merges duplicate mobile and landline into one line", () => {
    const line = formatFirmPhoneLine({
      address: "Office address",
      mobile: "+63 898 103 2990",
      landline: "+638981032990",
      email: "info@example.com",
      website: "www.example.com"
    });
    expect(line).toBe("Mobile / Tel. +63 898 103 2990");
  });

  it("builds premium HTML letterhead with logo and firm name", () => {
    const html = buildFirmLetterheadHtml({ logoSrc: "/brand/logo.png", pageSize: "legal" });
    expect(html).toContain('class="firm-lh"');
    expect(html).toContain("firm-lh__mark");
    expect(html).toContain("/brand/logo.png");
    expect(html).toContain("Hernandez &amp; Associates");
    expect(html).toContain("firm-lh__masthead-line--heavy");
    expect(html).not.toContain("firm-lh__contact-panel");
    const footer = buildFirmPageFooterHtml();
    expect(footer).toContain("firm-page-foot__name-block");
    expect(footer).toContain("HERNANDEZ &amp; ASSOCIATES");
    expect(footer).not.toContain("L A W O F F I C E");
    expect(footer).toContain("legal@hernandezlaw.info");
    expect(footer).toContain("(082) 324 5269");
    expect(footer).not.toContain("INFO@");
  });

  it("splits contact details onto separate lines", () => {
    const lines = formatFirmContactLines({
      address: "Office address",
      mobile: "+63 917 111 2222",
      landline: "+63 898 103 2990",
      email: "info@example.com",
      website: "www.example.com"
    });
    expect(lines[0]).toBe("Office address");
    expect(lines.some((line) => line.includes("Mobile"))).toBe(true);
    expect(lines.some((line) => line.includes("info@example.com"))).toBe(true);
    expect(lines.some((line) => line.includes("www.example.com"))).toBe(true);
  });

  it("splits long addresses onto two balanced lines", () => {
    const lines = formatAddressLines("G/F Plaza de Bole Compound, F. Torres St., Davao City");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Davao City");
  });

  it("wraps the full Hernandez office address for letterhead footers", () => {
    const lines = formatLetterheadFooterAddressLines({
      address:
        "Door 11/K, 18 Acacia Bldg., Acacia cor. Calachuchi Sts., Juna Subd., Matina, Davao City",
      mobile: "",
      landline: "(082) 324 5269",
      email: "legal@hernandezlaw.info",
      website: "www.hernandezlaw.info"
    });
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.join(" ")).toContain("Acacia Bldg.");
    expect(lines.join(" ")).toContain("Davao City");
    const footer = buildFirmPageFooterHtml();
    expect(footer).toContain("firm-page-foot__detail--address");
    expect(footer).toContain("Matina");
  });
});
