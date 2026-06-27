import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import {
  buildFirmEmailBodyParagraph,
  buildFirmEmailClosingLine,
  buildFirmEmailGreetingLine,
  buildFirmFormalEmailShell,
  escapeFirmEmailHtml,
  wrapFirmClientEmailDocument
} from "@/lib/firm-email-shell";
import { buildFirmLetterBodyCss, buildFirmLetterheadCss, buildFirmLetterheadFontLinkHtml, buildFirmLetterheadHtml, buildFirmPageFooterHtml, buildFirmStationeryCss, drawFirmLetterheadPdf, drawFirmPageFooterPdf, firmPageFooterReservePt, FIRM_LETTER_BODY_LINE_GAP_PT, FIRM_LETTER_BODY_SIZE_PT, type FirmPageSize } from "@/lib/firm-letterhead";
import { getFirmPageSpec, type FirmPageSpec } from "@/lib/firm-page-sizes";
import { formatPeso } from "@/lib/gl-config";
import { FIRM_NAME, FIRM_SUBTITLE } from "@/lib/billing-document-design";
import { embedFirmLetterheadLogo } from "@/lib/billing-document-pdf/common";
import {
  contractAcceptanceFeeSummary,
  formatLitigationAcceptanceFee,
  isDeclarationOfNullityCase,
  litigationAppearanceFeeRowsForIntake,
  litigationFeeScheduleSummary,
  resolveContractAcceptanceFee,
  resolveLitigationFeeSchedule,
  type LitigationFeeSchedule,
  type LitigationVenueTier
} from "@/lib/litigation-venue-fees";

export type { LitigationFeeSchedule, LitigationVenueTier };
export {
  contractAcceptanceFeeSummary,
  formatLitigationAcceptanceFee,
  isDeclarationOfNullityCase,
  litigationAppearanceFeeRowsForIntake,
  litigationFeeScheduleSummary,
  resolveContractAcceptanceFee,
  resolveLitigationFeeSchedule
};

export type EngagementDocumentType = "engagement" | "contract";

export type EngagementLetterInput = {
  documentType: EngagementDocumentType;
  clientName: string;
  clientAddress: string;
  clientCode: string;
  caseTitle: string;
  caseNumber?: string;
  courtPending?: string;
  contactEmail?: string;
  handlingAttorney: string;
  scopeOfWork: string;
  feeType: "hourly" | "flat" | "retainer" | "acceptance";
  feeAmount: string;
  /** Per-appearance fee for contract of legal services — editable at intake. */
  appearanceFeeAmount?: string;
  /** When true, contract includes a success fee section. */
  successFeeEnabled?: boolean;
  successFeeAmount?: string;
  feeNotes?: string;
  effectiveDate: string;
  preferredGreeting?: string;
  /** Paper size for contract PDF/HTML — defaults to legal (8.5 × 13 in). */
  pageSize?: FirmPageSize;
};

export type { FirmPageSize };

function resolvePageSize(input: EngagementLetterInput): FirmPageSize {
  return input.pageSize ?? (input.documentType === "contract" ? "legal" : "a4");
}

/** Content area for engagement PDF — body must stay above the footer band. */
function electronicContentBottom(spec: FirmPageSpec): number {
  return firmPageFooterReservePt(spec);
}

/** Full legal name on contracts — never the preferred greeting / first name alone. */
export function engagementClientFullName(input: Pick<EngagementLetterInput, "clientName">): string {
  return input.clientName.trim() || "Client";
}

function engagementDearSalutation(input: Pick<EngagementLetterInput, "clientName">): string {
  return `Dear Sir/Ma'am ${engagementClientFullName(input)}`;
}

/** Wider paragraph breaks in generated contract PDFs (12pt body, ~1.5 line gaps between paragraphs). */
const ENGAGEMENT_PDF_PARAGRAPH_GAP_PT = 30;
const ENGAGEMENT_PDF_SECTION_HEADING_GAP_PT = 10;

function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function feeDescription(input: EngagementLetterInput): string {
  const amount = input.feeAmount.trim() || "To be agreed in writing";
  if (input.feeType === "hourly") {
    return `Professional fees shall be billed on an hourly basis at ${amount}${input.feeNotes ? `. ${input.feeNotes}` : "."}`;
  }
  if (input.feeType === "retainer") {
    return `The client shall pay an initial retainer of ${amount}. Fees and costs shall be applied against the retainer and replenished as agreed${input.feeNotes ? `. ${input.feeNotes}` : "."}`;
  }
  if (input.feeType === "acceptance") {
    const fee = resolveContractAcceptanceFee(input.caseTitle, input.courtPending || "");
    const acceptanceAmount = input.feeAmount.trim() || formatPeso(fee.acceptanceFee);
    return `The Client shall pay an acceptance fee of ${acceptanceAmount} upon signing this Contract${input.feeNotes ? `. ${input.feeNotes}` : "."}`;
  }
  return `Professional fees for the agreed scope shall be ${amount}${input.feeNotes ? `. ${input.feeNotes}` : "."}`;
}

function defaultLitigationScope(input: EngagementLetterInput): string {
  const court = input.courtPending?.trim();
  const courtPhrase = court ? `before ${court}` : "before the court indicated above";
  return `Legal representation of the Client in the civil case described above ${courtPhrase}, including consultation, preparation and filing of pleadings and submissions, attendance at hearings, pre-trial conferences, and mediations as scheduled, and related client communications.`;
}

const LITIGATION_EXPENSE_DEPOSIT_PARAGRAPH =
  "The Client shall provide and maintain a deposit for expenses of PHP 5,000 to PHP 10,000, as determined by the firm based on its evaluation of the case and the volume of records involved, to cover filing fees, docket fees, sheriff's fees, publication, photocopying, postage, transportation, and other court-related and out-of-court disbursements.";

function litigationContractSections(input: EngagementLetterInput): Array<{ heading: string; paragraphs: string[] }> {
  const schedule = resolveLitigationFeeSchedule(input.courtPending || "");
  const contractFee = resolveContractAcceptanceFee(input.caseTitle, input.courtPending || "");
  const acceptanceFee = input.feeAmount.trim() || formatPeso(contractFee.acceptanceFee);
  const appearanceFee =
    input.appearanceFeeAmount?.trim() || formatPeso(schedule.appearanceFee);
  const feeNotes = input.feeNotes?.trim();
  const successFee = input.successFeeEnabled && input.successFeeAmount?.trim() ? input.successFeeAmount.trim() : "";

  const sections: Array<{ heading: string; paragraphs: string[] }> = [
    {
      heading: "Scope of legal services",
      paragraphs: [
        input.scopeOfWork.trim() || defaultLitigationScope(input),
        "This Contract covers proceedings before the trial court stated above through judgment, unless the parties agree in writing to extend the scope."
      ]
    },
    {
      heading: "Acceptance fee",
      paragraphs: [
        `The Client shall pay an acceptance fee of ${acceptanceFee} upon signing this Contract.`,
        "The acceptance fee covers the firm's acceptance of the engagement and initial case assessment. It is separate from appearance fees, expense deposits, pleadings charges, filing fees, and other reimbursable costs."
      ]
    },
    {
      heading: "Appearance fees",
      paragraphs: [
        `Appearance fees shall be ${appearanceFee} for each scheduled hearing, conference, mediation, or other court appearance required in this matter, exclusive of gas, meal, and accommodation expenses.`,
        "Appearance fees are due before or on the date of each scheduled appearance unless the firm agrees otherwise in writing. Rescheduling or cancellation of a hearing does not automatically waive an appearance fee once counsel has prepared for or traveled to appear."
      ]
    },
    {
      heading: "Deposit for expenses",
      paragraphs: [
        LITIGATION_EXPENSE_DEPOSIT_PARAGRAPH,
        "Expenses shall be applied against the deposit. The Client shall replenish the deposit upon the firm's written request. If no deposit is available, expenses may be billed separately and are due upon presentation of proof of payment."
      ]
    },
    {
      heading: "Pleadings, filing fees, and other charges",
      paragraphs: [
        "Fees for drafting and filing pleadings, motions, and other submissions, as well as filing fees, docket fees, and other court charges, shall be billed separately or charged against the expense deposit as agreed.",
        "Out-of-pocket costs and third-party charges incurred for the Client's account shall be reimbursed unless expressly included in a written fee quote."
      ]
    },
    ...(successFee
      ? [
          {
            heading: "Success fee",
            paragraphs: [
              `Upon successful resolution of this matter favorable to the Client, the Client shall pay a success fee of ${successFee}.`,
              "The success fee is separate from and in addition to the acceptance fee, appearance fees, expense deposit, pleadings charges, filing fees, and other reimbursable costs under this Contract."
            ]
          }
        ]
      : []),
    {
      heading: "Matters not included",
      paragraphs: [
        "Unless expressly agreed in a separate written engagement, this Contract does not include representation on appeal, certiorari, prohibition, mandamus, habeas corpus, or other special civil actions; execution or collection of judgment; arbitration; or any new case, counterclaim, cross-claim, or third-party complaint filed after the date of this Contract.",
        "Should any excluded matter arise, the firm will discuss separate fees and scope with the Client before proceeding."
      ]
    },
    {
      heading: "Client responsibilities",
      paragraphs: [
        "The Client agrees to provide complete and accurate information, respond promptly to requests for documents or instructions, advance or replenish deposits when requested, and notify the firm immediately of any change in contact details or material facts affecting the matter."
      ]
    },
    {
      heading: "Confidentiality and conflicts",
      paragraphs: [
        "The firm will maintain the confidentiality of information received in the course of representation, subject to applicable ethical rules. The Client confirms that the information provided for conflict checking is true and complete."
      ]
    },
    {
      heading: "Termination",
      paragraphs: [
        "Either party may terminate this Contract upon written notice. Acceptance fees, appearance fees, deposits applied, and costs incurred through the date of termination remain payable. The firm will take reasonable steps to protect the Client's interests upon termination, subject to applicable rules."
      ]
    },
    ...(feeNotes
      ? [
          {
            heading: "Additional fee notes",
            paragraphs: [feeNotes]
          }
        ]
      : [])
  ];

  return sections;
}

function documentTitle(type: EngagementDocumentType): string {
  return type === "contract" ? "CONTRACT OF LEGAL SERVICES" : "RETAINERSHIP AGREEMENT";
}

function documentLabel(type: EngagementDocumentType): string {
  return type === "contract" ? "Contract of Legal Services" : "Retainership Agreement";
}

function introParagraph(input: EngagementLetterInput): string {
  const matter = [input.caseTitle, input.caseNumber ? `Case No. ${input.caseNumber}` : "", input.courtPending ? `Court: ${input.courtPending}` : ""]
    .filter(Boolean)
    .join(" · ");

  if (input.documentType === "contract") {
    return `This Contract of Legal Services ("Contract") is entered into between ${FIRM_NAME} (${FIRM_SUBTITLE}), through ${input.handlingAttorney || "its handling counsel"}, and ${engagementClientFullName(input)} ("Client") for legal representation concerning ${matter || input.caseTitle || "the agreed matter"}.`;
  }

  return `This Retainership Agreement confirms that ${FIRM_NAME} will represent ${engagementClientFullName(input)} ("Client") in connection with ${matter || input.caseTitle || "the agreed matter"}. ${input.handlingAttorney ? `${input.handlingAttorney} will serve as the primary handling counsel.` : "Counsel will be assigned as agreed."}`;
}

function bodySections(input: EngagementLetterInput): Array<{ heading: string; paragraphs: string[] }> {
  if (input.documentType === "contract") {
    return litigationContractSections(input);
  }

  return [
    {
      heading: "Scope of legal services",
      paragraphs: [input.scopeOfWork.trim() || "Legal services related to the matter described above, including consultation, preparation of pleadings and submissions, attendance at hearings as scheduled, and related client communications."]
    },
    {
      heading: "Professional fees and billing",
      paragraphs: [feeDescription(input), "Out-of-pocket costs, filing fees, transportation, and third-party charges shall be billed separately unless otherwise agreed in writing."]
    },
    {
      heading: "Client responsibilities",
      paragraphs: [
        "The Client agrees to provide complete and accurate information, respond promptly to requests for documents or instructions, and notify the firm immediately of any change in contact details or material facts affecting the matter."
      ]
    },
    {
      heading: "Confidentiality and conflicts",
      paragraphs: [
        "The firm will maintain the confidentiality of information received in the course of representation, subject to applicable ethical rules. The Client confirms that the information provided for conflict checking is true and complete."
      ]
    },
    {
      heading: "Termination",
      paragraphs: [
        "Either party may terminate the engagement upon written notice. Fees and costs incurred through the date of termination remain payable. The firm will take reasonable steps to protect the Client's interests upon termination, subject to applicable rules."
      ]
    }
  ];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildElectronicLetterheadHtml(pageSize: FirmPageSize): string {
  return buildFirmLetterheadHtml({ pageSize });
}

function buildElectronicEngagementDocumentHtml(input: EngagementLetterInput): string {
  const body = buildLetterBodyHtml(input);
  const title = escapeHtml(documentTitle(input.documentType));
  const client = escapeHtml(input.clientName);
  const pageSize = resolvePageSize(input);
  const spec = getFirmPageSpec(pageSize);

  const footerReserve = pageSize === "a4" ? "32mm" : "1.15in";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} — ${client}</title>
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
    .sheet--a4.firm-letter-sheet { padding: 14mm 15mm 16mm; }
    .firm-letter-sheet .firm-letter-body { padding-bottom: ${footerReserve}; }
  </style>
</head>
<body style="margin:0;background:#fff;">
  <div class="firm-letter-sheet sheet sheet--${pageSize}" style="width:${spec.widthCss};min-height:${spec.heightCss};margin:0 auto;">
    ${buildElectronicLetterheadHtml(pageSize)}
    <div class="firm-letter-body" style="margin-top:0.35in;">
      ${body}
    </div>
    ${buildFirmPageFooterHtml()}
  </div>
</body>
</html>`;
}

function buildLetterBodyHtml(input: EngagementLetterInput): string {
  const title = documentTitle(input.documentType);
  const sections = bodySections(input);

  const sectionHtml = sections
    .map(
      (section) =>
        `<h2 class="firm-letter-body__section-heading">${section.heading}</h2>` +
        section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")
    )
    .join("");

  return (
    `<p class="firm-letter-body__date">${formatLongDate(input.effectiveDate)}</p>` +
    `<p class="firm-letter-body__client-name">${escapeHtml(engagementClientFullName(input))}</p>` +
    (input.clientAddress
      ? `<p class="firm-letter-body__client-address">${escapeHtml(input.clientAddress)}</p>`
      : `<p class="firm-letter-body__client-address"></p>`) +
    `<p>${escapeHtml(engagementDearSalutation(input))},</p>` +
    `<h1 class="firm-letter-body__title">${escapeHtml(title)}</h1>` +
    `<p>${escapeHtml(introParagraph(input))}</p>` +
    sectionHtml +
    `<p class="firm-letter-body__closing">If the foregoing accurately reflects our agreement, please sign below and return one copy for our records.</p>` +
    `<table class="firm-letter-body__signature-table"><tr>` +
    `<td style="width:50%;padding-right:18px;vertical-align:top;">` +
    `<p class="firm-letter-body__signature-line">Client signature</p>` +
    `<p style="margin:0;">${escapeHtml(engagementClientFullName(input))}</p>` +
    `</td>` +
    `<td style="width:50%;padding-left:18px;vertical-align:top;">` +
    `<p class="firm-letter-body__signature-line">For ${escapeHtml(FIRM_NAME)}</p>` +
    `<p style="margin:0;">${escapeHtml(input.handlingAttorney || "Authorized representative")}</p>` +
    `</td></tr></table>` +
    `<p class="firm-letter-body__matter-ref">Matter reference: ${escapeHtml(input.clientCode || "Pending")}</p>`
  );
}

export function buildEngagementLetterHtml(input: EngagementLetterInput): string {
  return buildElectronicEngagementDocumentHtml(input);
}

export function buildEngagementEmailPreview(input: EngagementLetterInput): { subject: string; body: string; html: string } {
  const docLabel = documentLabel(input.documentType);
  const subject = `${docLabel} — ${input.clientName}${input.clientCode ? ` (${input.clientCode})` : ""}`;

  const body = `${engagementDearSalutation(input)},

Good day.

Please find attached our ${docLabel.toLowerCase()} for your review and signature concerning ${input.caseTitle}.

Kindly sign and return a copy at your earliest convenience. Should you have any questions or require further clarification, please do not hesitate to contact our office.

Thank you.`;

  const bodyHtml = buildFirmFormalEmailShell({
    sectionLabel: "Engagement",
    documentTitle: docLabel,
    innerHtml:
      `<p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#0a0a0a;">${escapeFirmEmailHtml(engagementDearSalutation(input))},</p>` +
      buildFirmEmailGreetingLine() +
      buildFirmEmailBodyParagraph(
        `Please find attached our <strong>${escapeFirmEmailHtml(docLabel.toLowerCase())}</strong> for your review and signature concerning <strong>${escapeFirmEmailHtml(input.caseTitle)}</strong>.`
      ) +
      buildFirmEmailBodyParagraph(
        "Kindly sign and return a copy at your earliest convenience. Should you have any questions or require further clarification, please do not hesitate to contact our office.",
        { marginBottom: 0 }
      ) +
      buildFirmEmailClosingLine()
  });

  return {
    subject,
    body: buildClientEmailPlain(body),
    html: buildClientEmailHtml(wrapFirmClientEmailDocument(bodyHtml))
  };
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

/** pdf-lib StandardFonts use WinAnsi — replace peso and other non-Latin-1 glyphs. */
function pdfSafeText(text: string): string {
  return String(text || "")
    .replace(/\u20b1/g, "PHP ")
    .replace(/₱/g, "PHP ")
    .replace(/[\u2013\u2014]/g, "-");
}

function addElectronicLetterheadPage(
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

export async function buildEngagementLetterPdf(input: EngagementLetterInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const pageSize = resolvePageSize(input);
  const spec = getFirmPageSpec(pageSize);
  const contentLeft = spec.margins.left;
  const contentRight = spec.margins.right;
  const contentBottom = electronicContentBottom(spec);
  const logo = await embedFirmLetterheadLogo(pdf);

  const maxWidth = spec.widthPt - contentLeft - contentRight;
  let { page, y } = addElectronicLetterheadPage(pdf, spec, logo, regular, bold);

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded <= contentBottom) {
      ({ page, y } = addElectronicLetterheadPage(pdf, spec, logo, regular, bold, true));
    }
  };

  const lineGap = FIRM_LETTER_BODY_LINE_GAP_PT;
  const paragraphExtra = ENGAGEMENT_PDF_PARAGRAPH_GAP_PT - lineGap;

  const drawParagraph = (
    text: string,
    size = FIRM_LETTER_BODY_SIZE_PT,
    font = regular,
    paragraphBreak = true
  ) => {
    const lines = wrapText(text, maxWidth, font, size);
    const blockHeight = lines.length * lineGap + (paragraphBreak ? paragraphExtra : 0);
    ensureSpace(blockHeight);
    for (const line of lines) {
      page.drawText(line, { x: contentLeft, y, size, font, color: rgb(0.1, 0.09, 0.07) });
      y -= lineGap;
    }
    if (paragraphBreak) y -= paragraphExtra;
  };

  const fullName = engagementClientFullName(input);

  drawParagraph(formatLongDate(input.effectiveDate));
  drawParagraph(fullName, FIRM_LETTER_BODY_SIZE_PT, bold);
  if (input.clientAddress.trim()) drawParagraph(input.clientAddress);
  drawParagraph(`${engagementDearSalutation(input)},`);
  drawParagraph(documentTitle(input.documentType), 14, bold);
  drawParagraph(introParagraph(input));

  for (const section of bodySections(input)) {
    ensureSpace(10 + lineGap);
    drawParagraph(section.heading.toUpperCase(), 10, bold, false);
    y -= ENGAGEMENT_PDF_SECTION_HEADING_GAP_PT;
    for (const paragraph of section.paragraphs) {
      drawParagraph(paragraph);
    }
  }

  drawParagraph("If the foregoing accurately reflects our agreement, please sign below and return one copy for our records.");

  ensureSpace(72);
  y -= 20;
  const sigWidth = Math.min(210, maxWidth * 0.42);
  const sigGap = Math.max(28, maxWidth - sigWidth * 2);
  page.drawLine({ start: { x: contentLeft, y }, end: { x: contentLeft + sigWidth, y }, thickness: 0.6, color: rgb(0.55, 0.51, 0.46) });
  page.drawLine({
    start: { x: contentLeft + sigWidth + sigGap, y },
    end: { x: contentLeft + sigWidth + sigGap + sigWidth, y },
    thickness: 0.6,
    color: rgb(0.55, 0.51, 0.46)
  });
  y -= 14;
  page.drawText("Client signature", { x: contentLeft, y, size: 10, font: regular, color: rgb(0.35, 0.32, 0.28) });
  page.drawText(pdfSafeText(`For ${FIRM_NAME}`), {
    x: contentLeft + sigWidth + sigGap,
    y,
    size: 10,
    font: regular,
    color: rgb(0.35, 0.32, 0.28)
  });
  y -= 14;
  page.drawText(pdfSafeText(fullName), { x: contentLeft, y, size: 10, font: regular, color: rgb(0.1, 0.09, 0.07) });
  page.drawText(pdfSafeText(input.handlingAttorney || "Authorized representative"), {
    x: contentLeft + sigWidth + sigGap,
    y,
    size: 10,
    font: regular,
    color: rgb(0.1, 0.09, 0.07)
  });
  y -= paragraphExtra;
  drawParagraph(`Matter reference: ${input.clientCode || "Pending"}`, 9, regular, false);

  return pdf.save();
}

export function engagementLetterFilename(input: EngagementLetterInput): string {
  const base = input.documentType === "contract" ? "Contract-of-Legal-Services" : "Retainership-Agreement";
  const code = input.clientCode.trim() || "Draft";
  return `${base}-${code}.pdf`;
}

export function defaultEngagementLetterInput(partial: {
  clientName: string;
  clientCode: string;
  caseTitle: string;
  clientAddress?: string;
  caseNumber?: string;
  courtPending?: string;
  contactEmail?: string;
  handlingAttorney?: string;
  preferredGreeting?: string;
}): EngagementLetterInput {
  return {
    documentType: "engagement",
    clientName: partial.clientName,
    clientAddress: partial.clientAddress || "",
    clientCode: partial.clientCode,
    caseTitle: partial.caseTitle,
    caseNumber: partial.caseNumber,
    courtPending: partial.courtPending,
    contactEmail: partial.contactEmail,
    handlingAttorney: partial.handlingAttorney || "",
    preferredGreeting: partial.preferredGreeting || "",
    scopeOfWork: `Legal representation and related services for ${partial.caseTitle}.`,
    feeType: "retainer",
    feeAmount: "To be confirmed upon signing",
    appearanceFeeAmount: "",
    successFeeEnabled: false,
    successFeeAmount: "",
    feeNotes: "",
    effectiveDate: new Date().toISOString().slice(0, 10)
  };
}
