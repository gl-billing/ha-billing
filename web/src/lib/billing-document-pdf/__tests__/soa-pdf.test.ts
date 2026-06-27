import { describe, expect, it } from "vitest";
import { buildSoaPdf, soaPdfFilename } from "@/lib/billing-document-pdf/soa-pdf";

describe("buildSoaPdf", () => {
  it("builds a statement of account matching the firm SOA layout", async () => {
    const bytes = await buildSoaPdf({
      clientCode: "AIDEN",
      clientName: "Aiden Paul",
      invoiceNumber: "INV-402386",
      invoiceDate: "2026-03-31",
      prevBalance: 0,
      newCharges: 1_000_000,
      payments: 300_000,
      depositBalance: 0,
      totalDue: 700_000,
      remittance: {
        bankName: "PS Bank",
        accountName: "Robert Hernandez",
        accountNumber: "202330000706"
      },
      ledger: [
        {
          date: "2026-03-07",
          type: "Charge",
          description: "lost title",
          charge: 1_000_000,
          payment: 0,
          balance: 1_000_000
        },
        {
          date: "2026-03-25",
          type: "Payment",
          description: "Payment received",
          charge: 0,
          payment: 300_000,
          balance: 700_000
        }
      ]
    });

    expect(bytes.byteLength).toBeGreaterThan(5000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF");
  });

  it("names SOA files with invoice and client code", () => {
    expect(soaPdfFilename({ invoiceNumber: "INV-402386", clientCode: "AIDEN" })).toBe(
      "INV-402386_AIDEN_SOA.pdf"
    );
  });
});
