import { describe, expect, it } from "vitest";
import { arPdfFilename, buildArPdf } from "@/lib/billing-document-pdf/ar-pdf";

describe("buildArPdf", () => {
  it("builds a premium acknowledgment receipt PDF", async () => {
    const bytes = await buildArPdf({
      receiptNumber: "AR-SAMPLE-2026-001",
      receiptDate: "2026-06-07",
      paymentDate: "2026-06-01",
      clientName: "Sample Client",
      clientAddress: "Davao City",
      caseTitle: "Sample v. Sample",
      paymentFor: "Professional fees",
      amount: 15000,
      balanceAfter: 5000,
      paymentMethod: "GCash",
      paymentDetails: "Ref. 12345",
      receivedBy: "Hernandez & Associates"
    });

    expect(bytes.byteLength).toBeGreaterThan(4000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF");
  });

  it("names AR files with client code", () => {
    expect(arPdfFilename("AR-ABC-2026-001", "ABC")).toBe(
      "AR-ABC-2026-001_ABC_Acknowledgment_Receipt.pdf"
    );
  });
});
