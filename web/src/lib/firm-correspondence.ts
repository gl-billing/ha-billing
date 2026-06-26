export * from "./firm-correspondence-preview";

import { buildCorrespondenceLetterPdfLib } from "@/lib/correspondence-letter-pdf-lib";
import {
  buildCorrespondenceLetterHtml,
  type CorrespondenceLetterInput
} from "@/lib/firm-correspondence-preview";
import { renderLetterHtmlToPdf } from "@/lib/html-letter-pdf";

function resolvePageSize(input: CorrespondenceLetterInput) {
  return input.pageSize ?? "legal";
}

/** Build a correspondence PDF from the same HTML/CSS as the in-app letter preview. */
export async function buildCorrespondenceLetterPdf(input: CorrespondenceLetterInput): Promise<Uint8Array> {
  if (process.env.CORRESPONDENCE_PDF_ENGINE === "lib") {
    return buildCorrespondenceLetterPdfLib(input);
  }

  const html = buildCorrespondenceLetterHtml(input);
  try {
    return await renderLetterHtmlToPdf(html, resolvePageSize(input));
  } catch (error) {
    console.warn("HTML letter PDF render failed; using pdf-lib fallback.", error);
    return buildCorrespondenceLetterPdfLib(input);
  }
}
