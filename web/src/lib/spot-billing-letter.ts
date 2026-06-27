import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { amountToWords } from "@/lib/amount-to-words";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import {
  buildFirmEmailBodyParagraph,
  buildFirmFormalEmailShell,
  escapeFirmEmailHtml,
  wrapFirmClientEmailDocument
} from "@/lib/firm-email-shell";
import { FIRM_NAME, formatBillingDate } from "@/lib/billing-document-design";
import {
  buildFirmLetterBodyCss,
  buildFirmLetterheadCss,
  buildFirmLetterheadFontLinkHtml,
  buildFirmLetterheadHtml,
  buildFirmPageFooterHtml,
  buildFirmStationeryCss,
  drawFirmLetterheadPdf,
  drawFirmPageFooterPdf,
  firmPageFooterReservePt,
  FIRM_LETTER_BODY_LINE_GAP_PT,
  FIRM_LETTER_BODY_SIZE_PT
} from "@/lib/firm-letterhead";
import { getFirmPageSpec, type FirmPageSpec } from "@/lib/firm-page-sizes";
import { embedFirmLetterheadLogo } from "@/lib/billing-document-pdf/common";
import { formatPeso, type SpotBillingEntry, type SpotBillingTransactionPayload } from "@/lib/gl-config";

export type SpotBillingLetterKind = "charge" | "payment";

export type SpotBillingLetterInput = {
  kind: SpotBillingLetterKind;
  entry: Pick<
    SpotBillingEntry,
    | "spotId"
    | "payerName"
    | "email"
    | "serviceDescription"
    | "linkedClientCode"
    | "assignedAttorney"
    | "chargeAmount"
    | "paymentAmount"
  >;
  transaction: Pick<
    SpotBillingTransactionPayload,
    "serviceType" | "date" | "description" | "method" | "charge" | "payment"
  >;
  letterDate?: string;
};

function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pdfSafeText(text: string): string {
  return String(text || "")
    .replace(/\u20b1/g, "PHP ")
    .replace(/₱/g, "PHP ")
    .replace(/[\u2013\u2014]/g, "-");
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = pdfSafeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function transactionAmount(input: SpotBillingLetterInput): number {
  if (input.kind === "payment") {
    return Number(input.transaction.payment) || 0;
  }
  return Number(input.transaction.charge) || 0;
}

function balanceDue(entry: SpotBillingLetterInput["entry"]): number {
  return Math.max(0, entry.chargeAmount - entry.paymentAmount);
}

function documentTitle(kind: SpotBillingLetterKind): string {
  return kind === "charge" ? "Billing Notice — Fees and Expenses" : "Acknowledgment Receipt";
}

function assignedCounsel(entry: SpotBillingLetterInput["entry"]): string {
  return entry.assignedAttorney.trim() || "our handling counsel";
}

function buildChargeBodyParagraphs(input: SpotBillingLetterInput): string[] {
  const amount = transactionAmount(input);
  const attorney = assignedCounsel(input.entry);
  const detail = input.transaction.description?.trim();
  const lines = [
    `Please be advised of the following professional fees and/or expenses incurred by ${attorney} in connection with ${input.entry.serviceDescription.trim() || "your matter"}:`,
    "",
    `${input.transaction.serviceType?.trim() || "Professional Fee"} — ${formatPeso(amount)}${detail ? ` (${detail})` : ""}`,
    "",
    `Total charges to date: ${formatPeso(input.entry.chargeAmount)}`,
    `Total payments received: ${formatPeso(input.entry.paymentAmount)}`,
    `Balance due: ${formatPeso(balanceDue(input.entry))}`,
    "",
    "Kindly remit payment at your earliest convenience. Should you have any questions regarding this billing, please contact our office."
  ];
  return lines.filter((line, index, arr) => !(line === "" && arr[index + 1] === ""));
}

function buildPaymentBodyParagraphs(input: SpotBillingLetterInput): string[] {
  const amount = transactionAmount(input);
  const method = input.transaction.method?.trim() || "—";
  const detail = input.transaction.description?.trim();
  const paymentFor = detail || input.transaction.serviceType?.trim() || input.entry.serviceDescription.trim() || "Payment received";

  return [
    `We acknowledge receipt of your payment in the amount of ${formatPeso(amount)} (${amountToWords(amount)} Pesos) for ${paymentFor}.`,
    "",
    `Payment method: ${method}`,
    `Spot billing reference: ${input.entry.spotId}`,
    input.entry.linkedClientCode.trim() ? `Related client matter: ${input.entry.linkedClientCode.trim()}` : "",
    "",
    `Total charges to date: ${formatPeso(input.entry.chargeAmount)}`,
    `Total payments received: ${formatPeso(input.entry.paymentAmount)}`,
    `Remaining balance: ${formatPeso(balanceDue(input.entry))}`,
    "",
    "Thank you for your prompt payment."
  ].filter(Boolean);
}

function buildLetterBodyParagraphs(input: SpotBillingLetterInput): string[] {
  return input.kind === "charge" ? buildChargeBodyParagraphs(input) : buildPaymentBodyParagraphs(input);
}

function buildLetterBodyHtml(input: SpotBillingLetterInput): string {
  const letterDate = input.letterDate || input.transaction.date || new Date().toISOString().slice(0, 10);
  const subject = input.entry.serviceDescription.trim() || "Spot billing";
  const title = documentTitle(input.kind);
  const signatory = input.entry.assignedAttorney.trim() || "Authorized representative";
  const signatoryTitle =
    input.kind === "charge" ? "Handling Counsel" : input.entry.assignedAttorney.trim() ? "Received by" : "For and on behalf of the firm";
  const paragraphs = buildLetterBodyParagraphs(input);

  return (
    `<p class="firm-letter-body__date">${escapeHtml(formatLongDate(letterDate))}</p>` +
    `<p class="firm-letter-body__client-name">${escapeHtml(input.entry.payerName.trim() || "Payor")}</p>` +
    `<p class="firm-letter-body__client-address"></p>` +
    `<p><strong>Re: ${escapeHtml(subject)}</strong></p>` +
    `<p><strong>Ref: ${escapeHtml(input.entry.spotId)}</strong></p>` +
    `<p>Dear Sir/Ma'am,</p>` +
    `<h1 class="firm-letter-body__title">${escapeHtml(title)}</h1>` +
    paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("") +
    `<p class="firm-letter-body__closing">Very truly yours,</p>` +
    `<p style="margin:0.15in 0 0;">${escapeHtml(signatory)}</p>` +
    `<p style="margin:0.08in 0 0;">${escapeHtml(signatoryTitle)}</p>` +
    (input.entry.linkedClientCode.trim()
      ? `<p class="firm-letter-body__matter-ref">Client reference: ${escapeHtml(input.entry.linkedClientCode.trim())}</p>`
      : "")
  );
}

function buildLetterDocumentHtml(input: SpotBillingLetterInput): string {
  const body = buildLetterBodyHtml(input);
  const spec = getFirmPageSpec("legal");
  const title = documentTitle(input.kind);
  const recipient = escapeHtml(input.entry.payerName.trim() || "Payor");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${recipient}</title>
  ${buildFirmLetterheadFontLinkHtml()}
  <style>
    @page { size: ${spec.pageCss}; margin: 0; }
    html, body { margin: 0; padding: 0; }
    ${buildFirmLetterheadCss()}
    ${buildFirmStationeryCss()}
    ${buildFirmLetterBodyCss()}
    .firm-letter-sheet {
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0.55in 0.6in 0.45in;
    }
    .firm-letter-sheet .firm-letter-body { padding-bottom: 1.15in; }
  </style>
</head>
<body style="margin:0;background:#fff;">
  <div class="firm-letter-sheet sheet sheet--legal" style="width:${spec.widthCss};min-height:${spec.heightCss};margin:0 auto;">
    ${buildFirmLetterheadHtml({ pageSize: "legal" })}
    <div class="firm-letter-body" style="margin-top:0.35in;">
      ${body}
    </div>
    ${buildFirmPageFooterHtml()}
  </div>
</body>
</html>`;
}

export function buildSpotBillingLetterHtml(input: SpotBillingLetterInput): string {
  return buildLetterDocumentHtml(input);
}

export function buildSpotBillingEmailPreview(input: SpotBillingLetterInput): {
  subject: string;
  body: string;
  html: string;
} {
  const title = documentTitle(input.kind);
  const subject = `${title} — ${input.entry.payerName.trim()} (${input.entry.spotId})`;
  const paragraphs = buildLetterBodyParagraphs(input);
  const body = `Dear Sir/Ma'am,

${paragraphs.join("\n\n")}

Very truly yours,
${input.entry.assignedAttorney.trim() || FIRM_NAME}

---
${FIRM_NAME}`;

  const inner =
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#0a0a0a;">Dear Sir/Ma'am,</p>` +
    paragraphs.map((paragraph) => buildFirmEmailBodyParagraph(escapeFirmEmailHtml(paragraph), { marginBottom: 14 })).join("") +
    buildFirmEmailBodyParagraph(
      `Very truly yours,<br/><strong>${escapeFirmEmailHtml(input.entry.assignedAttorney.trim() || FIRM_NAME)}</strong>`,
      { marginBottom: 0, color: "#0a0a0a" }
    );

  const html = buildClientEmailHtml(
    wrapFirmClientEmailDocument(
      buildFirmFormalEmailShell({
        sectionLabel: "Billing",
        documentTitle: title,
        innerHtml: inner
      })
    )
  );

  return { subject, body: buildClientEmailPlain(body), html };
}

function electronicContentBottom(spec: FirmPageSpec): number {
  return firmPageFooterReservePt(spec);
}

function addLetterheadPage(
  pdf: PDFDocument,
  spec: FirmPageSpec,
  logo: Awaited<ReturnType<typeof embedFirmLetterheadLogo>>,
  regular: PDFFont,
  bold: PDFFont,
  compact = false
): { page: PDFPage; y: number } {
  const page = pdf.addPage([spec.widthPt, spec.heightPt]);
  const y = drawFirmLetterheadPdf({
    page,
    pageWidth: spec.widthPt,
    pageSpec: spec,
    bold,
    regular,
    logo,
    compact
  });
  drawFirmPageFooterPdf({ page, pageWidth: spec.widthPt, pageSpec: spec, regular });
  return { page, y };
}

export async function buildSpotBillingLetterPdf(input: SpotBillingLetterInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const spec = getFirmPageSpec("legal");
  const contentLeft = spec.margins.left;
  const contentRight = spec.margins.right;
  const contentBottom = electronicContentBottom(spec);
  const logo = await embedFirmLetterheadLogo(pdf);
  const maxWidth = spec.widthPt - contentLeft - contentRight;
  const letterDate = input.letterDate || input.transaction.date || new Date().toISOString().slice(0, 10);

  let { page, y } = addLetterheadPage(pdf, spec, logo, regular, bold);

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded <= contentBottom) {
      ({ page, y } = addLetterheadPage(pdf, spec, logo, regular, bold, true));
    }
  };

  const lineGap = FIRM_LETTER_BODY_LINE_GAP_PT;
  const paragraphExtra = 12;

  const drawParagraph = (text: string, size = FIRM_LETTER_BODY_SIZE_PT, font = regular, paragraphBreak = true) => {
    const lines = wrapText(text, maxWidth, font, size);
    const blockHeight = lines.length * lineGap + (paragraphBreak ? paragraphExtra : 0);
    ensureSpace(blockHeight);
    for (const line of lines) {
      page.drawText(line, { x: contentLeft, y, size, font, color: rgb(0.1, 0.09, 0.07) });
      y -= lineGap;
    }
    if (paragraphBreak) y -= paragraphExtra;
  };

  const subject = input.entry.serviceDescription.trim() || "Spot billing";
  const signatory = input.entry.assignedAttorney.trim() || "Authorized representative";

  drawParagraph(formatLongDate(letterDate));
  drawParagraph(input.entry.payerName.trim() || "Payor", FIRM_LETTER_BODY_SIZE_PT, bold);
  drawParagraph(`Re: ${subject}`, FIRM_LETTER_BODY_SIZE_PT, bold);
  drawParagraph(`Ref: ${input.entry.spotId}`, FIRM_LETTER_BODY_SIZE_PT, bold);
  drawParagraph("Dear Sir/Ma'am,");
  drawParagraph(documentTitle(input.kind), 14, bold);

  for (const paragraph of buildLetterBodyParagraphs(input)) {
    drawParagraph(paragraph);
  }

  drawParagraph("Very truly yours,");
  drawParagraph(signatory, FIRM_LETTER_BODY_SIZE_PT, regular, false);
  if (input.kind === "payment" && input.transaction.method?.trim()) {
    y -= lineGap;
    drawParagraph(`Payment date: ${formatBillingDate(letterDate)}`, 9, regular, false);
  }

  return pdf.save();
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function spotBillingLetterFilename(input: SpotBillingLetterInput): string {
  const kind = input.kind === "charge" ? "Charge" : "Receipt";
  const ref = sanitizeFilenamePart(input.entry.spotId);
  const date = sanitizeFilenamePart(input.transaction.date || input.letterDate || "Draft");
  return `Spot-${kind}-${ref}-${date}.pdf`;
}

export function spotBillingLetterKindForTransaction(
  transaction: SpotBillingTransactionPayload
): SpotBillingLetterKind | null {
  if (transaction.transactionKind === "payment") return "payment";
  if (transaction.transactionKind === "charge") return "charge";
  if (Number(transaction.payment) > 0 && !Number(transaction.charge)) return "payment";
  if (Number(transaction.charge) > 0) return "charge";
  return null;
}
