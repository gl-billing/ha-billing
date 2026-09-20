import { describe, expect, it } from "vitest";
import { StandardFonts, PDFDocument } from "pdf-lib";
import { wrapText } from "@/lib/billing-document-pdf/common";
import { displayLedgerDescription, receiptPaymentForLabel, soaLedgerDescription } from "@/lib/ledger-display";
import { formatSoaDateShort, buildSoaPdf, soaPdfFilename, soaDetailedLedgerBand } from "@/lib/billing-document-pdf/soa-pdf";

describe("displayLedgerDescription", () => {
  it("strips filing prep checklists and event ids from client-facing text", () => {
    const raw =
      "Drafting pleading fee — File a Comment Filing prep: Review received pleading and service date; Confirm deadline · Responsive pleading · due 2026-07-25 (JIM-EVT-0001)";
    expect(displayLedgerDescription(raw)).toBe(
      "Drafting pleading fee — File a Comment · Responsive pleading"
    );
  });
});

describe("receiptPaymentForLabel", () => {
  it("keeps only the fee type for acknowledgment receipts", () => {
    expect(
      receiptPaymentForLabel(
        "Drafting pleading fee — File a Comment Filing prep: Review received pleading; Confirm deadline · Responsive pleading · due 2026-07-25 (JIM-EVT-0001)"
      )
    ).toBe("Drafting pleading fee");
    expect(receiptPaymentForLabel("Appearance fee — RTC Branch 45 hearing")).toBe("Appearance fee");
    expect(receiptPaymentForLabel("Professional Fee")).toBe("Professional Fee");
    expect(
      receiptPaymentForLabel("Partial payment — professional fees and case expenses")
    ).toBe("professional fees and case expenses");
  });
});

describe("soaLedgerDescription", () => {
  it("collapses long event charge text to the fee label", () => {
    expect(
      soaLedgerDescription(
        "Drafting pleading fee — File a Comment Filing prep: Review received pleading · Responsive pleading · due 2026-07-25 (JIM-EVT-0001)",
        "Pleading Fee"
      )
    ).toBe("Drafting pleading fee");
  });
});

describe("soaDetailedLedgerBand", () => {
  it("places the first data row clearly below the column labels", () => {
    const band = soaDetailedLedgerBand(500);
    expect(band.colLabelY).toBeLessThan(band.titleY);
    expect(band.colRuleY).toBeLessThan(band.colLabelY);
    expect(band.firstRowY).toBeLessThanOrEqual(band.colLabelY - 16);
    expect(band.firstRowY).toBeLessThan(band.colRuleY);
  });
});

describe("formatSoaDateShort", () => {
  it("formats ISO and long display dates as mm/dd/yyyy", () => {
    expect(formatSoaDateShort("2026-07-25")).toBe("07/25/2026");
    expect(formatSoaDateShort("July 25, 2026")).toBe("07/25/2026");
  });
});

describe("wrapText", () => {
  it("hard-breaks oversized words so ledger columns do not overflow", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("Supercalifragilisticexpialidocious", 40, font, 9);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(40.5);
    }
  });
});

describe("buildSoaPdf", () => {
  it("builds a statement with matching summary and compact ledger text", async () => {
    const bytes = await buildSoaPdf({
      clientCode: "SANTOS",
      clientName: "Jimmy Santos",
      invoiceNumber: "INV-SANTOS-2026-002",
      invoiceDate: "2026-09-20",
      prevBalance: 0,
      newCharges: 15_000,
      payments: 10_000,
      depositBalance: 0,
      totalDue: 5_000,
      remittance: {
        bankName: "PS Bank",
        accountName: "Robert Hernandez",
        accountNumber: "202330000706"
      },
      ledger: [
        {
          date: "July 25, 2026",
          type: "Pleading Fee",
          description:
            "Drafting pleading fee — File a Comment Filing prep: Review received pleading; Confirm deadline · Responsive pleading · due 2026-07-25 (JIM-EVT-0001)",
          charge: 15_000,
          payment: 0,
          balance: 15_000
        },
        {
          date: "2026-09-20",
          type: "Pleading Fee",
          description: "Drafting pleading fee — File a Comment",
          charge: 0,
          payment: 10_000,
          balance: 5_000
        }
      ]
    });

    expect(bytes.byteLength).toBeGreaterThan(5000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF");
  });

  it("keeps column headers above the first ledger data baseline", () => {
    const band = soaDetailedLedgerBand(640);
    // Label glyph height (~7.5) + padding must clear before data baseline.
    expect(band.firstRowY).toBeLessThanOrEqual(band.colLabelY - 20);
  });

  it("names SOA files with invoice and client code", () => {
    expect(soaPdfFilename({ invoiceNumber: "INV-402386", clientCode: "AIDEN" })).toBe(
      "INV-402386_AIDEN_SOA.pdf"
    );
  });
});
