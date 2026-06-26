import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  buildEngagementEmailPreview,
  buildEngagementLetterHtml,
  buildEngagementLetterPdf,
  resolveContractAcceptanceFee,
  resolveLitigationFeeSchedule
} from "@/lib/engagement-letter";

describe("litigation contract fee schedule", () => {
  it("uses PHP 5,000 appearance within Davao City", () => {
    const schedule = resolveLitigationFeeSchedule("RTC Branch 16, Davao City");
    expect(schedule.tier).toBe("davao_city");
    expect(schedule.appearanceFee).toBe(5000);
  });

  it("uses PHP 12,000 appearance for Digos, Panabo, and Tagum", () => {
    expect(resolveLitigationFeeSchedule("MTCC, Digos City").appearanceFee).toBe(12000);
    expect(resolveLitigationFeeSchedule("RTC Branch 2, Panabo City").appearanceFee).toBe(12000);
    expect(resolveLitigationFeeSchedule("RTC Branch 2, Tagum City").appearanceFee).toBe(12000);
  });

  it("increases appearance fees for farther venues", () => {
    expect(resolveLitigationFeeSchedule("RTC Branch 1, Kidapawan City").appearanceFee).toBe(15000);
    expect(resolveLitigationFeeSchedule("RTC Branch 12, General Santos City").appearanceFee).toBe(18000);
    expect(resolveLitigationFeeSchedule("RTC Branch 20, Cotabato City").appearanceFee).toBe(20000);
    expect(resolveLitigationFeeSchedule("RTC Branch 19, Cagayan de Oro City").appearanceFee).toBe(22000);
    expect(resolveLitigationFeeSchedule("RTC Branch 5, Butuan City").appearanceFee).toBe(25000);
  });

  it("summarizes appearance fees by venue", () => {
    const schedule = resolveLitigationFeeSchedule("RTC Branch 16, Davao City");
    expect(schedule.appearanceFee).toBe(5000);
    expect(schedule.tier).toBe("davao_city");
  });
});

describe("contract acceptance fees", () => {
  it("uses minimum PHP 100,000 for general civil matters", () => {
    expect(resolveContractAcceptanceFee("Collection case", "RTC Branch 16, Davao City").acceptanceFee).toBe(100_000);
  });

  it("uses PHP 250,000 for nullity in Davao City and nearby venues", () => {
    expect(
      resolveContractAcceptanceFee("Petition for Declaration of Nullity of Marriage", "RTC Branch 16, Davao City")
        .acceptanceFee
    ).toBe(250_000);
    expect(
      resolveContractAcceptanceFee("Petition for Declaration of Nullity of Marriage", "RTC Branch 2, Tagum City")
        .acceptanceFee
    ).toBe(250_000);
  });

  it("uses PHP 350,000 for nullity in regional and farther venues", () => {
    expect(
      resolveContractAcceptanceFee("Petition for Declaration of Nullity of Marriage", "RTC Branch 1, Kidapawan City")
        .acceptanceFee
    ).toBe(350_000);
    expect(
      resolveContractAcceptanceFee("Petition for Declaration of Nullity of Marriage", "RTC Branch 19, Cagayan de Oro City")
        .acceptanceFee
    ).toBe(350_000);
  });
});

describe("contract PDF layout", () => {
  it("uses a full letterhead header instead of the printed letterhead image", () => {
    const html = buildEngagementLetterHtml({
      documentType: "contract",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "₱100,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(html).not.toContain("letterhead-a4.jpg");
    expect(html).toContain('class="firm-lh"');
    expect(html).toContain("H E R N A N D E Z");
    expect(html).toContain("info@hernandezassociates.com");
    expect(html).toContain("hernandezassociates.com");
    expect(html).toContain("size: legal");
  });

  it("uses the electronic letterhead for retainership agreements on A4", () => {
    const html = buildEngagementLetterHtml({
      documentType: "engagement",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Collection",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "retainer",
      feeAmount: "₱50,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(html).not.toContain("letterhead-a4.jpg");
    expect(html).toContain('class="firm-lh"');
    expect(html).toContain("firm-letter-body");
    expect(html).toContain("size: A4");
    expect(html).toContain("H E R N A N D E Z");
  });

  it("builds legal-size contract PDF", async () => {
    const pdf = await buildEngagementLetterPdf({
      documentType: "contract",
      pageSize: "legal",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "PHP 100,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("builds a contract PDF without WinAnsi errors for peso amounts", async () => {
    const pdf = await buildEngagementLetterPdf({
      documentType: "contract",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Petition for Declaration of Nullity of Marriage",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation in nullity proceedings",
      feeType: "acceptance",
      feeAmount: "₱250,000.00",
      appearanceFeeAmount: "₱5,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("states only this matter's acceptance and appearance fees, not minimums or area schedules", () => {
    const html = buildEngagementLetterHtml({
      documentType: "contract",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "₱100,000.00",
      appearanceFeeAmount: "₱5,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(html).toContain("acceptance fee of ₱100,000.00");
    expect(html).toContain("Appearance fees shall be ₱5,000.00");
    expect(html).toContain("exclusive of gas, meal, and accommodation expenses");
    expect(html).toContain("deposit for expenses of PHP 5,000 to PHP 10,000");
    expect(html).not.toMatch(/minimum acceptance fee/i);
    expect(html).not.toContain("₱12,000.00");
    expect(html).not.toContain("Butuan");
  });

  it("includes a success fee section when enabled with an amount", () => {
    const html = buildEngagementLetterHtml({
      documentType: "contract",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "₱100,000.00",
      appearanceFeeAmount: "₱5,000.00",
      successFeeEnabled: true,
      successFeeAmount: "₱50,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(html).toContain("Success fee");
    expect(html).toContain("success fee of ₱50,000.00");
  });

  it("omits the success fee section when the checkbox is off", () => {
    const html = buildEngagementLetterHtml({
      documentType: "contract",
      clientName: "Maria Client",
      clientAddress: "Davao City",
      clientCode: "MARIA",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "₱100,000.00",
      appearanceFeeAmount: "₱5,000.00",
      successFeeEnabled: false,
      successFeeAmount: "₱50,000.00",
      effectiveDate: "2026-06-14"
    });

    expect(html).not.toContain("success fee of");
  });

  it("uses the client's full name in the Dear salutation", () => {
    const html = buildEngagementLetterHtml({
      documentType: "contract",
      clientName: "Maria Santos Hoare",
      clientAddress: "Davao City",
      clientCode: "HOARE",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "₱100,000.00",
      appearanceFeeAmount: "₱5,000.00",
      effectiveDate: "2026-06-14",
      preferredGreeting: "Maria"
    });

    expect(html).toContain("Dear Sir/Ma'am Maria Santos Hoare");
    const email = buildEngagementEmailPreview({
      documentType: "contract",
      clientName: "Maria Santos Hoare",
      clientAddress: "Davao City",
      clientCode: "HOARE",
      caseTitle: "Collection",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Example",
      scopeOfWork: "Representation",
      feeType: "acceptance",
      feeAmount: "₱100,000.00",
      appearanceFeeAmount: "₱5,000.00",
      effectiveDate: "2026-06-14",
      preferredGreeting: "Maria"
    });
    expect(email.body).toContain("Dear Sir/Ma'am Maria Santos Hoare");
  });

  it("paginates long contracts above the footer band", async () => {
    const pdfBytes = await buildEngagementLetterPdf({
      documentType: "contract",
      pageSize: "legal",
      clientName: "Maria Santos Hoare",
      clientAddress: "123 Example Street, Davao City",
      clientCode: "HOARE",
      caseTitle: "Petition for Declaration of Nullity of Marriage",
      courtPending: "RTC Branch 16, Davao City",
      handlingAttorney: "Atty. Maria Hernandez",
      scopeOfWork:
        "Legal representation of the Client in nullity proceedings before the trial court, including consultation, preparation and filing of pleadings and submissions, attendance at hearings, pre-trial conferences, and mediations as scheduled, and related client communications.",
      feeType: "acceptance",
      feeAmount: "PHP 250,000.00",
      appearanceFeeAmount: "PHP 5,000.00",
      feeNotes: "Additional notes about deposits, filing fees, and replenishment expectations for this matter.",
      effectiveDate: "2026-06-14"
    });

    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
