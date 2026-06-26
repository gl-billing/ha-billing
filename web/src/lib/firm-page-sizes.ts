/** Paper sizes for firm letterhead, contracts, and correspondence PDFs. */

export type FirmPageSize = "letter" | "legal" | "a4";

export type FirmPageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type FirmLetterheadMetrics = {
  logo: number;
  logoCompact: number;
  firmName: number;
  tagline: number;
  contactAddress: number;
  contactDetail: number;
  paddingTop: number;
  blockGap: number;
  ruleGap: number;
  bodyGap: number;
};

export type FirmPageSpec = {
  id: FirmPageSize;
  label: string;
  widthPt: number;
  heightPt: number;
  widthCss: string;
  heightCss: string;
  pageCss: string;
  margins: FirmPageMargins;
  letterhead: FirmLetterheadMetrics;
};

const INCH = 72;

export const FIRM_PAGE_SPECS: Record<FirmPageSize, FirmPageSpec> = {
  letter: {
    id: "letter",
    label: "Letter (8.5 × 11 in)",
    widthPt: 8.5 * INCH,
    heightPt: 11 * INCH,
    widthCss: "8.5in",
    heightCss: "11in",
    pageCss: "letter",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    letterhead: {
      logo: 78,
      logoCompact: 50,
      firmName: 11.5,
      tagline: 7.25,
      contactAddress: 9,
      contactDetail: 8.25,
      paddingTop: 36,
      blockGap: 10,
      ruleGap: 9,
      bodyGap: 18
    }
  },
  legal: {
    id: "legal",
    label: "Legal (8.5 × 13 in)",
    widthPt: 8.5 * INCH,
    heightPt: 13 * INCH,
    widthCss: "8.5in",
    heightCss: "13in",
    pageCss: "legal",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    letterhead: {
      logo: 84,
      logoCompact: 52,
      firmName: 12,
      tagline: 7.5,
      contactAddress: 9.5,
      contactDetail: 8.5,
      paddingTop: 40,
      blockGap: 11,
      ruleGap: 10,
      bodyGap: 20
    }
  },
  a4: {
    id: "a4",
    label: "A4 (210 × 297 mm)",
    widthPt: 595.28,
    heightPt: 841.89,
    widthCss: "210mm",
    heightCss: "297mm",
    pageCss: "A4",
    margins: { top: 50, right: 48, bottom: 50, left: 48 },
    letterhead: {
      logo: 76,
      logoCompact: 50,
      firmName: 11.5,
      tagline: 7.25,
      contactAddress: 9,
      contactDetail: 8.25,
      paddingTop: 36,
      blockGap: 11,
      ruleGap: 9,
      bodyGap: 18
    }
  }
};

export const FIRM_PAGE_SIZE_ORDER: FirmPageSize[] = ["letter", "legal", "a4"];

export function getFirmPageSpec(size: FirmPageSize = "legal"): FirmPageSpec {
  return FIRM_PAGE_SPECS[size];
}

export function firmPageContentWidth(spec: FirmPageSpec): number {
  return spec.widthPt - spec.margins.left - spec.margins.right;
}
