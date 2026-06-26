import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  correspondenceBodyBlocksForPdf,
  correspondenceTitleAlign
} from "@/lib/correspondence-pdf-body";
import { plainTextToRuns } from "@/lib/letter-pdf-rich-text";
import {
  correspondenceClosing,
  correspondenceDocumentTitle,
  correspondenceSalutation,
  type CorrespondenceLetterInput
} from "@/lib/firm-correspondence-preview";
import {
  drawFirmLetterheadPdf,
  drawFirmPageFooterPdf,
  firmPageFooterReservePt,
  FIRM_LETTER_BODY_LINE_GAP_PT,
  FIRM_LETTER_BODY_PARAGRAPH_GAP_PT,
  FIRM_LETTER_BODY_SIZE_PT
} from "@/lib/firm-letterhead";
import {
  drawAlignedTextBlock,
  drawFormattedTextBlock,
  measureAlignedTextBlock,
  measureFormattedTextBlock,
  pdfSafeText,
  type LetterPdfAlign,
  type LetterPdfBodyBlock,
  type LetterPdfFontSet,
  type LetterPdfTextRun
} from "@/lib/letter-pdf-text";
import { getFirmPageSpec, type FirmPageSpec } from "@/lib/firm-page-sizes";
import { embedFirmLetterheadLogo } from "@/lib/billing-document-pdf/common";

function resolvePageSize(input: CorrespondenceLetterInput) {
  return input.pageSize ?? "legal";
}

function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function electronicContentBottom(spec: FirmPageSpec): number {
  return firmPageFooterReservePt(spec);
}

function addCorrespondenceLetterheadPage(
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

/** Fallback PDF renderer when HTML print is unavailable (no Chromium). */
export async function buildCorrespondenceLetterPdfLib(input: CorrespondenceLetterInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const boldItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fonts: LetterPdfFontSet = { regular, bold, italic, boldItalic };

  const pageSize = resolvePageSize(input);
  const spec = getFirmPageSpec(pageSize);
  const contentLeft = spec.margins.left;
  const contentRight = spec.margins.right;
  const contentBottom = electronicContentBottom(spec);
  const logo = await embedFirmLetterheadLogo(pdf);
  const maxWidth = spec.widthPt - contentLeft - contentRight;

  let { page, y } = addCorrespondenceLetterheadPage(pdf, spec, logo, regular, bold);

  const lineGap = FIRM_LETTER_BODY_LINE_GAP_PT;
  const paragraphGap = FIRM_LETTER_BODY_PARAGRAPH_GAP_PT;

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded <= contentBottom) {
      ({ page, y } = addCorrespondenceLetterheadPage(pdf, spec, logo, regular, bold, true));
    }
  };

  const drawRuns = (
    runs: LetterPdfTextRun[],
    options?: {
      baseSize?: number;
      align?: LetterPdfAlign;
      indentPt?: number;
      paragraphGapAfter?: number;
      forceBold?: boolean;
    }
  ) => {
    const baseSize = options?.baseSize ?? FIRM_LETTER_BODY_SIZE_PT;
    const align = options?.align ?? "left";
    const indentPt = options?.indentPt ?? 0;
    const gapAfter = options?.paragraphGapAfter ?? paragraphGap;
    const drawWidth = Math.max(24, maxWidth - indentPt);
    const styledRuns = options?.forceBold
      ? runs.map((run) => ({ ...run, bold: true, fontSize: run.fontSize ?? baseSize }))
      : runs.map((run) => ({ ...run, fontSize: run.fontSize ?? baseSize }));

    const blockHeight = measureFormattedTextBlock(styledRuns, drawWidth, fonts, baseSize, lineGap, gapAfter);
    ensureSpace(blockHeight);
    y = drawFormattedTextBlock({
      page,
      runs: styledRuns,
      x: contentLeft + indentPt,
      y,
      maxWidth: drawWidth,
      fonts,
      baseSize,
      align,
      lineGap,
      paragraphGap: gapAfter
    });
  };

  const drawPlain = (
    text: string,
    options?: {
      size?: number;
      font?: PDFFont;
      align?: LetterPdfAlign;
      indentPt?: number;
      paragraphGapAfter?: number;
    }
  ) => {
    const size = options?.size ?? FIRM_LETTER_BODY_SIZE_PT;
    const font = options?.font ?? regular;
    const align = options?.align ?? "left";
    const indentPt = options?.indentPt ?? 0;
    const gapAfter = options?.paragraphGapAfter ?? paragraphGap;
    const drawText = pdfSafeText(text);
    const drawWidth = Math.max(24, maxWidth - indentPt);
    const blockHeight = measureAlignedTextBlock(drawText, drawWidth, font, size, lineGap, gapAfter);
    ensureSpace(blockHeight);
    y = drawAlignedTextBlock({
      page,
      text: drawText,
      x: contentLeft + indentPt,
      y,
      maxWidth: drawWidth,
      font,
      size,
      align,
      lineGap,
      paragraphGap: gapAfter,
      justifyBody: align === "justify"
    });
  };

  const drawBodyBlock = (block: LetterPdfBodyBlock) => {
    drawRuns(block.runs, {
      align: block.align,
      indentPt: block.indentPt
    });
  };

  const subject = input.subjectLine?.trim();
  const matterRef = input.matterReference?.trim() || input.clientCode?.trim();

  drawPlain(formatLongDate(input.letterDate), { align: "left" });
  drawRuns(plainTextToRuns(input.recipientName.trim() || "Recipient"), { forceBold: true });
  if (input.recipientAddress.trim()) {
    drawRuns(plainTextToRuns(input.recipientAddress.trim()));
  }
  if (subject) {
    drawRuns(plainTextToRuns(`Re: ${subject}`), { forceBold: true });
  }
  drawRuns(plainTextToRuns(`${correspondenceSalutation(input)},`));

  const title = correspondenceDocumentTitle(input);
  if (title) {
    drawRuns(plainTextToRuns(title, { fontSize: 14 }), {
      baseSize: 14,
      align: correspondenceTitleAlign(),
      forceBold: true
    });
  }

  for (const block of correspondenceBodyBlocksForPdf(input.body)) {
    drawBodyBlock(block);
  }

  drawRuns(plainTextToRuns(correspondenceClosing(input)));
  drawRuns(plainTextToRuns(input.signatoryName.trim() || "Authorized representative"), { paragraphGapAfter: 0 });
  if (input.signatoryTitle?.trim()) {
    y -= lineGap;
    drawRuns(plainTextToRuns(input.signatoryTitle.trim()), { paragraphGapAfter: 0 });
  }
  if (matterRef) {
    y -= paragraphGap;
    drawRuns(plainTextToRuns(`Matter reference: ${matterRef}`, { fontSize: 9 }), {
      baseSize: 9,
      paragraphGapAfter: 0
    });
  }

  return pdf.save();
}
