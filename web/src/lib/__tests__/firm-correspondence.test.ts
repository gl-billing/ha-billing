import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  buildCorrespondenceEmailPreview,
  buildCorrespondenceLetterHtml,
  buildCorrespondenceLetterPdf,
  bodyParagraphs,
  correspondenceLetterFilename,
  correspondenceSalutation,
  defaultCorrespondenceLetterInput,
  type CorrespondenceLetterInput
} from "@/lib/firm-correspondence";

const sampleLetter = (): CorrespondenceLetterInput => ({
  kind: "demand",
  pageSize: "legal",
  letterDate: "2026-03-14",
  recipientName: "John Smith",
  recipientAddress: "123 Sample Street\nDavao City",
  recipientEmail: "john@example.com",
  subjectLine: "Outstanding professional fees",
  body: "We represent our client in the above matter.\n\nPayment is overdue.",
  closing: "Very truly yours,",
  signatoryName: "Atty. Maria Hernandez",
  signatoryTitle: "Attorney-at-Law",
  matterReference: "Smith v. Doe",
  clientCode: "SMITH"
});

describe("firm correspondence", () => {
  it("splits body text into paragraphs", () => {
    expect(bodyParagraphs("First.\n\nSecond.")).toEqual(["First.", "Second."]);
  });

  it("builds default salutation from recipient name", () => {
    expect(correspondenceSalutation({ recipientName: "Jane Doe" })).toBe("Dear Sir/Ma'am Jane Doe");
  });

  it("builds HTML with letterhead, Re line, and footer contact casing", () => {
    const html = buildCorrespondenceLetterHtml(sampleLetter());
    expect(html).toContain('class="firm-lh firm-letter-print-band"');
    expect(html).toContain("Outstanding professional fees");
    expect(html).toContain("Dear Sir/Ma'am John Smith");
    expect(html).toContain("Demand letter");
    expect(html).toContain("Matter reference: Smith v. Doe");
    expect(html).toContain("info@hernandezassociates.com");
    expect(html).not.toContain("INFO@");
  });

  it("builds email preview subject and plain body", () => {
    const email = buildCorrespondenceEmailPreview(sampleLetter());
    expect(email.subject).toContain("Demand letter");
    expect(email.subject).toContain("Outstanding professional fees");
    expect(email.body).toContain("Dear Sir/Ma'am John Smith");
    expect(email.body).toContain("Please find attached");
  });

  it("names PDF files with kind, client code, and date", () => {
    expect(correspondenceLetterFilename(sampleLetter())).toBe("Letter-Demand-SMITH-2026-03-14.pdf");
  });

  it("seeds defaults for each letter kind", () => {
    const seeded = defaultCorrespondenceLetterInput({
      kind: "proposal",
      clientCode: "ACME",
      recipientName: "Acme Corp"
    });
    expect(seeded.kind).toBe("proposal");
    expect(seeded.body).toContain("<p>");
    expect(seeded.body.length).toBeGreaterThan(20);
    expect(seeded.subjectLine).toContain("Proposal");
  });

  it("supports blank other letter kind", () => {
    const seeded = defaultCorrespondenceLetterInput({ kind: "other", recipientName: "Walk-in Client" });
    expect(seeded.subjectLine).toBe("");
    expect(seeded.body).toBe("");
    const html = buildCorrespondenceLetterHtml({
      ...seeded,
      body: "<p>Custom walk-in letter.</p>",
      recipientAddress: "Davao City"
    });
    expect(html).toContain("Custom walk-in letter.");
    expect(html).not.toContain("<h1");
  });

  it("uses multi-page layout so letterhead and footer repeat on overflow", () => {
    const longBody = Array.from({ length: 36 }, (_, index) => `Paragraph ${index + 1}: ${"Outstanding balance remains unpaid. ".repeat(8)}`).join(
      "\n\n"
    );
    const html = buildCorrespondenceLetterHtml({ ...sampleLetter(), body: longBody });
    expect(html).toContain("firm-letter-document");
    expect(html).toContain("firm-letter-print-band");
    expect(html).toContain("firm-letter-screen-pages");
    expect(html).toContain("position: fixed");
  });

  it("builds a correspondence pdf for rich text body content", async () => {
    const pdfBytes = await buildCorrespondenceLetterPdf({
      ...sampleLetter(),
      body: '<p style="text-align: justify">We represent our client in the above matter.</p><p style="text-align: justify">Payment is overdue.</p>'
    });
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });
});
