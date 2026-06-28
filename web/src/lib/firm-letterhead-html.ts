import {
  BILLING_DOC_RGB,
  FIRM_NAME,
  FIRM_SUBTITLE
} from "@/lib/billing-document-design";
import {
  FIRM_PAGE_SIZE_ORDER,
  getFirmPageSpec,
  type FirmPageSize
} from "@/lib/firm-page-sizes";
import { firmLetterheadLogoPublicUrl } from "@/lib/firm-logo-url";
import {
  formatLetterheadFooterAddressLine,
  formatLetterheadFooterAddressLines,
  formatLetterheadFooterDigitalLine,
  formatLetterheadFooterPhoneLine,
  getFirmLetterheadContact,
  type FirmLetterheadContact
} from "@/lib/firm-contact";
import { FIRM_FOOTER_NAME } from "@/lib/firm-footer-name";

export type { FirmLetterheadContact } from "@/lib/firm-contact";

const SERIF = "Georgia, 'Times New Roman', 'Palatino Linotype', serif";
const DISPLAY = "Arial, Helvetica, 'Arial Black', sans-serif";
const FORMAL_BODY = "'Times New Roman', Times, serif";
const SANS = "Arial, Helvetica, sans-serif";
const PAPER = "#ffffff";
const INK = "#0a0a0a";
const INK_SOFT = "#1a1a1a";
const MUTED = "#4a4a4a";
const RULE_HEAVY = "2.5px";
const RULE_FINE = "1px";
const ACCENT = "#111111";
const ACCENT_DEEP = "#0a0a0a";
const ACCENT_LIGHT = "#333333";
const ACCENT_PALE = "#e5e5e5";

const RULE_GRADIENT = `linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 7%, ${ACCENT} 50%, rgba(0, 0, 0, 0.08) 93%, transparent 100%)`;

function buildSpacedCapsNameHtml(): string {
  const splitAt = FIRM_LETTER_SPACED_CAPS_NAME.indexOf("&");
  if (splitAt < 0) return escapeHtml(FIRM_LETTER_SPACED_CAPS_NAME);
  const before = FIRM_LETTER_SPACED_CAPS_NAME.slice(0, splitAt).trimEnd();
  const after = FIRM_LETTER_SPACED_CAPS_NAME.slice(splitAt + 1).trimStart();
  return `${escapeHtml(before)} <span class="firm-lh__amp">&amp;</span> ${escapeHtml(after)}`;
}

export function buildFirmLetterheadFontLinkHtml(): string {
  return "";
}

export const FIRM_LETTER_BODY_SIZE_PT = 12;
export const FIRM_LETTER_BODY_LINE_GAP_PT = 12;
export const FIRM_LETTER_BODY_PARAGRAPH_GAP_PT = 18;

function buildLetterheadClosingRuleHtml(): string {
  return `<div class="firm-lh__closing-rule" aria-hidden="true"><span></span></div>`;
}

function buildLetterheadMarkHtml(logoSrc: string, logoPx: number): string {
  return (
    `<div class="firm-lh__mark">` +
    `<img src="${logoSrc}" alt="${escapeHtml(FIRM_NAME)}" class="firm-lh__logo" style="max-width:${logoPx}px;width:100%;height:auto;" />` +
    `</div>`
  );
}

function buildLetterheadMastheadHtml(): string {
  return (
    `<div class="firm-lh__masthead" aria-hidden="true">` +
    `<div class="firm-lh__masthead-line firm-lh__masthead-line--heavy"></div>` +
    `<div class="firm-lh__masthead-line firm-lh__masthead-line--fine"></div>` +
    `</div>`
  );
}

export const FIRM_LETTER_SPACED_CAPS_NAME = "H E R N A N D E Z & A S S O C I A T E S";
/** @deprecated Law Office removed from footers — kept for legacy letterhead references only. */
export const FIRM_LETTER_SPACED_CAPS_SUBTITLE = "L A W O F F I C E";

export function buildFirmFooterNameHtml(): string {
  return (
    `<div class="firm-page-foot__name-block">` +
    `<p class="firm-page-foot__name-line">${escapeHtml(FIRM_FOOTER_NAME)}</p>` +
    `</div>`
  );
}

/** Footer firm name on one line. */
export function firmFooterCapsLine(): string {
  return FIRM_FOOTER_NAME;
}

export function buildFirmPageFooterHtml(
  contact: FirmLetterheadContact = getFirmLetterheadContact()
): string {
  const addressLines = formatLetterheadFooterAddressLines(contact);
  const phoneText = formatLetterheadFooterPhoneLine(contact);
  const digitalText = formatLetterheadFooterDigitalLine(contact);

  return (
    `<footer class="firm-page-foot">` +
    `<div class="firm-page-foot__rules" aria-hidden="true">` +
    `<div class="firm-page-foot__line firm-page-foot__line--heavy"></div>` +
    `<div class="firm-page-foot__line firm-page-foot__line--fine"></div>` +
    `</div>` +
    buildFirmFooterNameHtml() +
    `<div class="firm-page-foot__divider" aria-hidden="true"></div>` +
    addressLines
      .map(
        (line) =>
          `<p class="firm-page-foot__detail firm-page-foot__detail--address">${escapeHtml(line)}</p>`
      )
      .join("") +
    (phoneText ? `<p class="firm-page-foot__detail">${escapeHtml(phoneText)}</p>` : "") +
    (digitalText ? `<p class="firm-page-foot__detail firm-page-foot__detail--digital">${escapeHtml(digitalText)}</p>` : "") +
    `</footer>`
  );
}


export function firmLetterheadLogoSrc(): string {
  return firmLetterheadLogoPublicUrl();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letterheadScale(size: FirmPageSize): number {
  if (size === "legal") return 1.04;
  if (size === "a4") return 0.98;
  return 1;
}

/** Premium stationery letterhead — HTML (contracts, previews, print). */
export function buildFirmLetterheadHtml(options?: {
  logoSrc?: string;
  contact?: FirmLetterheadContact;
  compact?: boolean;
  pageSize?: FirmPageSize;
}): string {
  const logoSrc = options?.logoSrc ?? firmLetterheadLogoPublicUrl();
  const spec = getFirmPageSpec(options?.pageSize ?? "legal");
  const scale = letterheadScale(spec.id);
  const logoPx = Math.round((options?.compact ? spec.letterhead.logoCompact : spec.letterhead.logo) * scale);
  const firmPt = (options?.compact ? spec.letterhead.firmName - 2 : spec.letterhead.firmName) * scale;
  const tagPt = spec.letterhead.tagline * scale;

  if (options?.compact) {
    return (
      `<header class="firm-lh firm-lh--compact">` +
      buildLetterheadMastheadHtml() +
      `<p class="firm-lh__firm firm-lh__firm--caps firm-lh__firm--solo" style="font-size:${firmPt - 1}pt;">${buildSpacedCapsNameHtml()}</p>` +
      buildLetterheadClosingRuleHtml() +
      `</header>`
    );
  }

  return (
    `<header class="firm-lh">` +
    buildLetterheadMastheadHtml() +
    buildLetterheadMarkHtml(logoSrc, Math.round(logoPx * 2.35)) +
    buildLetterheadClosingRuleHtml() +
    `</header>`
  );
}

/** SOA preview/print — full-width left-aligned Hernandez banner bar. */
export function buildFirmSoaBannerLetterheadHtml(options?: { bannerSrc?: string }): string {
  const bannerSrc = options?.bannerSrc ?? "/brand/cover.png";
  return (
    `<header class="firm-lh firm-lh--soa-banner">` +
    `<img src="${bannerSrc}" alt="${FIRM_NAME}" class="firm-lh__banner" />` +
    buildLetterheadClosingRuleHtml() +
    `</header>`
  );
}

export function buildFirmLetterheadCss(): string {
  return `
.firm-lh {
  padding: 0 0 8px;
  text-align: center;
}
.firm-lh--soa-banner {
  text-align: left;
  padding: 0 0 10px;
}
.firm-lh--soa-banner .firm-lh__banner {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  margin: 0;
  border: 0;
}
.firm-lh--soa-banner .firm-lh__closing-rule {
  margin-top: 10px;
}
.firm-lh__masthead {
  width: 100%;
  margin: 0 0 16px;
}
.firm-lh__masthead-line--heavy {
  display: block;
  width: 100%;
  height: 0;
  border: none;
  border-top: ${RULE_HEAVY} solid ${INK};
  opacity: 0.94;
}
.firm-lh__masthead-line--fine {
  display: block;
  width: 100%;
  height: ${RULE_FINE};
  margin-top: 5px;
  border: none;
  background: ${RULE_GRADIENT};
}
.firm-lh__mark {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 5.75in;
  margin: 0 auto;
  padding: 4px 0 2px;
  line-height: 0;
}
.firm-lh__crest {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin: 0 auto;
  padding-top: 2px;
}
.firm-lh__logo-crest {
  margin-bottom: 10px;
  line-height: 0;
}
.firm-lh__logo {
  display: block;
  width: auto;
  height: auto;
  object-fit: contain;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.firm-lh__identity {
  width: 100%;
  max-width: 6.35in;
  margin: 0 auto;
}
.firm-lh__firm {
  margin: 0;
  font-family: ${DISPLAY};
  font-weight: 700;
  line-height: 1.08;
  color: ${INK};
}
.firm-lh__firm--solo {
  margin-top: 6px;
  color: ${INK};
}
.firm-lh__amp {
  font-family: ${DISPLAY};
  font-style: italic;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: ${ACCENT};
}
.firm-lh__firm--caps,
.firm-page-foot__firm--caps {
  font-variant: normal;
  letter-spacing: 0.11em;
  font-weight: 700;
  white-space: nowrap;
}
.firm-lh__discipline--caps,
.firm-page-foot__subtitle--caps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  margin: 5px 0 0;
  font-family: ${DISPLAY};
  font-variant: normal;
  letter-spacing: 0.22em;
  font-weight: 500;
  color: ${ACCENT_DEEP};
}
.firm-lh__discipline--caps::before,
.firm-lh__discipline--caps::after {
  content: "";
  flex: 1 1 56px;
  max-width: 72px;
  height: ${RULE_FINE};
  border: none;
  background: ${RULE_GRADIENT};
}
.firm-lh__closing-rule {
  position: relative;
  width: 100%;
  margin: 15px 0 0;
  height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.firm-lh__closing-rule::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: ${RULE_FINE};
  border: none;
  background: ${RULE_GRADIENT};
}
.firm-lh__closing-rule span {
  position: relative;
  z-index: 1;
  width: 5px;
  height: 5px;
  transform: rotate(45deg);
  border: 1px solid ${ACCENT};
  background: ${ACCENT};
  box-shadow: 0 0 0 2px ${PAPER};
  flex-shrink: 0;
}
.firm-page-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 var(--firm-sheet-x, 0.6in) 0.14in;
  text-align: center;
  box-sizing: border-box;
}
.sheet--a4 .firm-page-foot {
  padding: 0 15mm 2.5mm;
}
.firm-page-foot__rules {
  width: 100%;
  margin: 0 auto 5px;
}
.firm-page-foot__line--heavy {
  display: block;
  width: 100%;
  height: 0;
  border: none;
  border-top: ${RULE_HEAVY} solid ${INK};
  opacity: 0.94;
}
.firm-page-foot__line--fine {
  display: block;
  width: 100%;
  height: ${RULE_FINE};
  margin-top: 5px;
  border: none;
  background: ${RULE_GRADIENT};
}
.firm-page-foot__name-block {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0 auto 1px;
}
.firm-page-foot__name-line {
  margin: 0;
  font-family: ${DISPLAY};
  font-size: 8.75pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: ${INK};
  line-height: 1.1;
}
.firm-page-foot__firm {
  margin: 0;
  font-family: ${DISPLAY};
  font-size: 10pt;
  font-weight: 700;
  color: ${INK};
}
.firm-page-foot__firm--caps {
  font-size: 8.75pt;
  letter-spacing: 0.11em;
  font-weight: 700;
}
.firm-page-foot__subtitle--caps {
  font-size: 7.35pt;
  letter-spacing: 0.22em;
  margin-top: 2px;
  font-weight: 600;
  color: ${ACCENT};
}
.firm-page-foot__divider {
  width: 32px;
  height: 0;
  margin: 1px auto 2px;
  border: none;
  border-top: 1px solid ${ACCENT_PALE};
  opacity: 0.95;
}
.firm-page-foot__detail {
  margin: 0 auto;
  max-width: 6.15in;
  font-family: ${SANS};
  font-size: 6.65pt;
  line-height: 1.22;
  letter-spacing: 0.015em;
  text-transform: none;
  color: ${MUTED};
}
.firm-page-foot__detail--address {
  max-width: 6.35in;
  line-height: 1.18;
}
.firm-page-foot__detail--digital {
  text-transform: lowercase;
}
.firm-lh--compact .firm-lh__masthead { margin-bottom: 12px; }
.firm-lh--compact .firm-lh__closing-rule { margin-top: 12px; }
`.trim();
}

export function buildFirmStationeryCss(): string {
  const logoUrl = firmLetterheadLogoPublicUrl();
  return `
.sheet {
  position: relative;
  background-color: ${PAPER};
  background-image:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(1.5em - 1px),
      rgba(0, 0, 0, 0.04) calc(1.5em - 1px),
      rgba(0, 0, 0, 0.04) 1.5em
    );
}
.sheet::before {
  content: "";
  position: absolute;
  left: 0.2in;
  top: 1.65in;
  bottom: 0.85in;
  width: min(42%, 2.8in);
  background: url("${logoUrl}") left top / contain no-repeat;
  opacity: 0.04;
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 0;
}
.sheet--a4::before {
  left: 10mm;
  top: 48mm;
  bottom: 20mm;
  width: min(46%, 72mm);
}
.body-sample,
.firm-letter-body {
  position: relative;
  z-index: 1;
}
`.trim();
}

/** Formal letter body — Times New Roman, single-spaced lines, 1.5-line paragraph gaps. */
export function buildFirmLetterBodyCss(): string {
  return `
.firm-letter-body,
.body-sample {
  font-family: ${FORMAL_BODY};
  font-size: 12pt;
  line-height: 1;
  letter-spacing: 0;
  color: ${INK};
}
.firm-letter-body p,
.body-sample p {
  margin: 0 0 1.5em;
  text-align: justify;
}
.firm-letter-body__content p,
.firm-letter-body__content div,
.firm-letter-body__content blockquote,
.firm-letter-body__content ul,
.firm-letter-body__content ol {
  margin: 0 0 1.5em;
  line-height: 1;
  text-align: justify;
}
.firm-letter-body__content p:last-child,
.firm-letter-body__content div:last-child,
.firm-letter-body__content blockquote:last-child,
.firm-letter-body__content ul:last-child,
.firm-letter-body__content ol:last-child {
  margin-bottom: 0;
}
.firm-letter-body__content ul,
.firm-letter-body__content ol {
  padding-left: 1.25em;
}
.firm-letter-body__content blockquote {
  margin: 0 0 1.5em;
  padding-left: 0.75em;
  border-left: 3px solid rgba(138, 129, 117, 0.4);
  font-style: italic;
  color: ${INK_SOFT};
}
.firm-letter-body__content hr {
  margin: 0 0 1.5em;
  border: 0;
  border-top: 1px solid rgba(138, 129, 117, 0.45);
}
.firm-letter-body p:last-child,
.body-sample p:last-child {
  margin-bottom: 0;
}
.firm-letter-body__date,
.firm-letter-body__client-address {
  color: ${INK_SOFT};
}
.firm-letter-body__client-name {
  font-weight: 700;
  margin-bottom: 0.25em;
}
.firm-letter-body__client-address {
  white-space: pre-wrap;
}
.firm-letter-body__title {
  font-size: 14pt;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.04em;
  line-height: 1;
  margin: 0 0 1.5em;
}
.firm-letter-body__section-heading {
  font-family: ${SANS};
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${ACCENT_DEEP};
  line-height: 1;
  margin: 1.5em 0 0.5em;
}
.firm-letter-body__closing {
  margin-top: 1.5em;
}
.firm-letter-body__signature-table {
  width: 100%;
  margin-top: 1.5em;
  border-collapse: collapse;
  font-family: ${FORMAL_BODY};
  font-size: 12pt;
  line-height: 1;
}
.firm-letter-body__signature-line {
  margin: 2.5em 0 0.5em;
  border-top: 1px solid #8a8175;
  padding-top: 0.5em;
}
.firm-letter-body__matter-ref {
  margin-top: 1.5em;
  font-family: ${SANS};
  font-size: 9pt;
  line-height: 1;
  color: ${MUTED};
}
`.trim();
}

export type FirmLetterSheetLayout = {
  pageSize: FirmPageSize;
  paddingTop: string;
  paddingX: string;
  paddingBottom: string;
  bodyMarginTop: string;
  footerReserve: string;
  printBodyPadTop: string;
  printBodyPadBottom: string;
};

export function getFirmLetterSheetLayout(pageSize: FirmPageSize = "legal"): FirmLetterSheetLayout {
  const isA4 = pageSize === "a4";
  return {
    pageSize,
    paddingTop: isA4 ? "14mm" : "0.55in",
    paddingX: isA4 ? "15mm" : "0.6in",
    paddingBottom: isA4 ? "16mm" : "0.45in",
    bodyMarginTop: isA4 ? "8mm" : "0.35in",
    footerReserve: isA4 ? "32mm" : "1.15in",
    printBodyPadTop: isA4 ? "74mm" : "2.45in",
    printBodyPadBottom: isA4 ? "32mm" : "1.15in"
  };
}

/** Multi-page letter CSS — fixed letterhead/footer on print; paginated sheets on screen. */
export function buildFirmPagedLetterLayoutCss(pageSize: FirmPageSize = "legal"): string {
  const layout = getFirmLetterSheetLayout(pageSize);
  const watermarkTop = pageSize === "a4" ? "48mm" : "1.55in";
  const watermarkBottom = pageSize === "a4" ? "20mm" : "0.78in";
  const watermarkLeft = pageSize === "a4" ? "10mm" : "0.15in";
  const watermarkWidth = pageSize === "a4" ? "min(46%, 72mm)" : "min(46%, 3.15in)";

  return `
html, body { margin: 0; padding: 0; }
body.firm-letter-doc-root { background: #ece8df; }
@media print {
  html, body, body.firm-letter-doc-root { background: #fff; }
}
.firm-letter-document {
  position: relative;
  box-sizing: border-box;
  margin: 0 auto;
  overflow: visible;
}
.firm-letter-flow {
  position: relative;
  z-index: 1;
}
.firm-letter-screen-pages {
  display: none;
}
.firm-letter-screen-page {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  margin: 0 auto 20px;
  padding: ${layout.paddingTop} ${layout.paddingX} ${layout.paddingBottom};
  box-shadow: 0 18px 48px rgba(20, 17, 14, 0.1), 0 2px 8px rgba(107, 84, 32, 0.05);
}
.firm-letter-screen-page .firm-letter-body {
  padding-bottom: ${layout.footerReserve};
}
.firm-letter-template-header,
.firm-letter-template-footer {
  display: none;
}
@media screen {
  .firm-letter-print-band,
  .firm-letter-print-watermark,
  .firm-letter-flow {
    display: none !important;
  }
  .firm-letter-screen-pages {
    display: block;
    padding: 12px 0 24px;
  }
}
@media print {
  .firm-letter-screen-pages {
    display: none !important;
  }
  .firm-letter-flow {
    display: block !important;
  }
  .firm-letter-document {
    width: 100%;
    min-height: 0;
    background: transparent;
    box-shadow: none;
    padding: 0;
  }
  .firm-letter-flow {
    padding: 0 ${layout.paddingX};
    padding-top: ${layout.printBodyPadTop};
    padding-bottom: ${layout.printBodyPadBottom};
    background-color: ${PAPER};
    background-image:
      radial-gradient(ellipse 130% 55% at 50% -8%, rgba(201, 162, 39, 0.045), transparent 58%),
      radial-gradient(ellipse 90% 35% at 50% 102%, rgba(107, 84, 32, 0.035), transparent 62%),
      repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent calc(1.5em - 1px),
        rgba(138, 129, 117, 0.065) calc(1.5em - 1px),
        rgba(138, 129, 117, 0.065) 1.5em
      );
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .firm-letter-flow .firm-letter-body {
    margin-top: 0 !important;
    padding-bottom: 0 !important;
  }
  .firm-letter-print-band.firm-lh {
    position: fixed;
    top: ${layout.paddingTop};
    left: ${layout.paddingX};
    right: ${layout.paddingX};
    z-index: 3;
    background: transparent;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .firm-letter-print-band.firm-page-foot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: ${pageSize === "a4" ? "2.5mm" : "0.14in"};
    z-index: 3;
    padding-left: ${layout.paddingX};
    padding-right: ${layout.paddingX};
    background: transparent;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .firm-letter-print-watermark {
    position: fixed;
    left: ${watermarkLeft};
    top: ${watermarkTop};
    bottom: ${watermarkBottom};
    width: ${watermarkWidth};
    background: url("/brand/letterhead-watermark.png") left top / contain no-repeat;
    opacity: 0.17;
    mix-blend-mode: multiply;
    pointer-events: none;
    z-index: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`.trim();
}

export function buildFirmLetterScreenPaginationScript(): string {
  return `(function () {
  function cssLengthToPx(value, parent) {
    var el = document.createElement("div");
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.height = value;
    parent.appendChild(el);
    var px = el.offsetHeight;
    parent.removeChild(el);
    return px;
  }

  function collectBlocks(body) {
    var blocks = [];
    Array.prototype.forEach.call(body.childNodes, function (node) {
      if (node.nodeType !== 1) return;
      if (node.classList.contains("firm-letter-body__content")) {
        Array.prototype.forEach.call(node.childNodes, function (child) {
          if (child.nodeType === 1) blocks.push(child);
        });
      } else {
        blocks.push(node);
      }
    });
    return blocks;
  }

  function measureBlockHeight(block, host) {
    host.appendChild(block);
    var height = block.getBoundingClientRect().height;
    host.removeChild(block);
    return height;
  }

  function paginate() {
    if (window.matchMedia("print").matches) return;
    var doc = document.querySelector(".firm-letter-document");
    if (!doc) return;
    var flow = doc.querySelector(".firm-letter-flow");
    var body = flow && flow.querySelector(".firm-letter-body");
    var pagesHost = doc.querySelector(".firm-letter-screen-pages");
    var headerTpl = doc.querySelector(".firm-letter-template-header .firm-lh");
    var footerTpl = doc.querySelector(".firm-letter-template-footer .firm-page-foot");
    if (!body || !pagesHost || !headerTpl || !footerTpl) return;

    var pageHeight = doc.getAttribute("data-page-height") || "13in";
    var pageWidth = doc.getAttribute("data-page-width") || "8.5in";
    var paddingTop = doc.getAttribute("data-padding-top") || "0.55in";
    var paddingBottom = doc.getAttribute("data-padding-bottom") || "0.45in";
    var paddingX = doc.getAttribute("data-padding-x") || "0.6in";
    var bodyMarginTop = doc.getAttribute("data-body-margin-top") || "0.35in";
    var pageSize = doc.getAttribute("data-page-size") || "legal";

    var sandbox = document.createElement("div");
    sandbox.style.position = "absolute";
    sandbox.style.visibility = "hidden";
    sandbox.style.left = "-9999px";
    sandbox.style.width = pageWidth;
    document.body.appendChild(sandbox);

    var pageHeightPx = cssLengthToPx(pageHeight, sandbox);
    var padTopPx = cssLengthToPx(paddingTop, sandbox);
    var padBottomPx = cssLengthToPx(paddingBottom, sandbox);
    var bodyMarginTopPx = cssLengthToPx(bodyMarginTop, sandbox);

    var probePage = document.createElement("div");
    probePage.className = doc.className;
    probePage.style.width = pageWidth;
    probePage.style.padding = paddingTop + " " + paddingX + " " + paddingBottom;
    sandbox.appendChild(probePage);

    var headerClone = headerTpl.cloneNode(true);
    headerClone.style.display = "block";
    probePage.appendChild(headerClone);
    var headerHeight = headerClone.getBoundingClientRect().height;

    var footerClone = footerTpl.cloneNode(true);
    footerClone.style.display = "block";
    footerClone.style.position = "absolute";
    footerClone.style.left = "0";
    footerClone.style.right = "0";
    footerClone.style.bottom = "0";
    probePage.appendChild(footerClone);
    var footerHeight = footerClone.getBoundingClientRect().height;

    document.body.removeChild(sandbox);

    var maxContentPx =
      pageHeightPx - padTopPx - padBottomPx - headerHeight - bodyMarginTopPx - footerHeight - 6;

    var measureHost = document.createElement("div");
    measureHost.className = "firm-letter-body";
    measureHost.style.position = "absolute";
    measureHost.style.visibility = "hidden";
    measureHost.style.left = "-9999px";
    measureHost.style.width = pageWidth;
    measureHost.style.padding = "0 " + paddingX;
    measureHost.style.marginTop = bodyMarginTop;
    document.body.appendChild(measureHost);

    var blocks = collectBlocks(body);
    var pages = [];
    var current = [];
    var currentHeight = 0;

    blocks.forEach(function (block) {
      var clone = block.cloneNode(true);
      var blockHeight = measureBlockHeight(clone, measureHost);
      if (current.length && currentHeight + blockHeight > maxContentPx) {
        pages.push(current);
        current = [];
        currentHeight = 0;
      }
      current.push(block);
      currentHeight += blockHeight;
    });
    if (current.length) pages.push(current);
    document.body.removeChild(measureHost);

    pagesHost.innerHTML = "";
    pages.forEach(function (pageBlocks, index) {
      var page = document.createElement("div");
      page.className = "firm-letter-screen-page sheet sheet--" + pageSize;
      page.style.width = pageWidth;
      page.style.height = pageHeight;
      page.setAttribute("data-page-index", String(index + 1));

      var header = headerTpl.cloneNode(true);
      header.style.display = "block";
      page.appendChild(header);

      var bodyDiv = document.createElement("div");
      bodyDiv.className = "firm-letter-body";
      bodyDiv.style.marginTop = bodyMarginTop;
      pageBlocks.forEach(function (block) {
        bodyDiv.appendChild(block.cloneNode(true));
      });
      page.appendChild(bodyDiv);

      var footer = footerTpl.cloneNode(true);
      footer.style.display = "block";
      page.appendChild(footer);

      pagesHost.appendChild(page);
    });
    pagesHost.removeAttribute("aria-hidden");
  }

  function run() {
    var done = function () {
      window.setTimeout(paginate, 40);
    };
    var images = document.querySelectorAll(".firm-letter-template-header img");
    var pending = images.length;
    if (!pending) {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(done);
      } else {
        done();
      }
      return;
    }
    var finished = function () {
      pending -= 1;
      if (pending <= 0) done();
    };
    Array.prototype.forEach.call(images, function (img) {
      if (img.complete) finished();
      else {
        img.addEventListener("load", finished);
        img.addEventListener("error", finished);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();`;
}

export function buildFirmLetterDocumentHtml(options: {
  pageSize: FirmPageSize;
  title: string;
  bodyHtml: string;
  letterheadHtml?: string;
}): string {
  const spec = getFirmPageSpec(options.pageSize);
  const layout = getFirmLetterSheetLayout(options.pageSize);
  const letterhead = options.letterheadHtml ?? buildFirmLetterheadHtml({ pageSize: options.pageSize });
  const letterheadTemplate = letterhead.replace(
    /class="firm-lh([^"]*)"/,
    'class="firm-lh$1 firm-letter-template-header"'
  );
  const letterheadPrint = letterhead.replace(/class="firm-lh([^"]*)"/, 'class="firm-lh$1 firm-letter-print-band"');
  const footer = buildFirmPageFooterHtml();
  const footerTemplate = footer.replace(
    'class="firm-page-foot"',
    'class="firm-page-foot firm-letter-template-footer"'
  );
  const footerPrint = footer.replace('class="firm-page-foot"', 'class="firm-page-foot firm-letter-print-band"');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${options.title}</title>
  ${buildFirmLetterheadFontLinkHtml()}
  <style>
    @page { size: ${spec.pageCss}; margin: 0; }
    ${buildFirmLetterheadCss()}
    ${buildFirmStationeryCss()}
    ${buildFirmLetterBodyCss()}
    ${buildFirmPagedLetterLayoutCss(options.pageSize)}
    .firm-letter-document {
      width: ${spec.widthCss};
    }
  </style>
</head>
<body class="firm-letter-doc-root">
  <div
    class="firm-letter-document sheet sheet--${options.pageSize}"
    data-page-size="${options.pageSize}"
    data-page-width="${spec.widthCss}"
    data-page-height="${spec.heightCss}"
    data-padding-top="${layout.paddingTop}"
    data-padding-x="${layout.paddingX}"
    data-padding-bottom="${layout.paddingBottom}"
    data-body-margin-top="${layout.bodyMarginTop}"
  >
    <div class="firm-letter-template-header" hidden aria-hidden="true">${letterheadTemplate}</div>
    <div class="firm-letter-template-footer" hidden aria-hidden="true">${footerTemplate}</div>
    ${letterheadPrint}
    ${footerPrint}
    <div class="firm-letter-print-watermark" aria-hidden="true"></div>
    <main class="firm-letter-flow">
      <div class="firm-letter-body" style="margin-top:${layout.bodyMarginTop};">
        ${options.bodyHtml}
      </div>
    </main>
    <div class="firm-letter-screen-pages" aria-hidden="true"></div>
  </div>
  <script>${buildFirmLetterScreenPaginationScript()}</script>
</body>
</html>`;
}

export function buildLetterheadPreviewDocumentHtml(): string {
  const logoPublic = firmLetterheadLogoPublicUrl();
  const contact = getFirmLetterheadContact();
  const letterheadCss = buildFirmLetterheadCss();
  const stationeryCss = buildFirmStationeryCss();
  const bodyCss = buildFirmLetterBodyCss();

  const sheets = FIRM_PAGE_SIZE_ORDER.map((size) => {
    const spec = getFirmPageSpec(size);
    return (
      `<section class="preview-block" data-size="${size}">` +
      `<p class="preview-block__label">${escapeHtml(spec.label)}</p>` +
      `<div class="sheet sheet--${size}">` +
      buildFirmLetterheadHtml({ logoSrc: logoPublic, contact, pageSize: size }) +
      `<div class="body-sample">` +
      `<p>[Date]</p>` +
      `<p>[Client name]<br />[Client address]</p>` +
      `<p><strong>Re: [Subject / matter reference]</strong></p>` +
      `<p>Dear Sir/Ma'am:</p>` +
      `<p>[Body of letter or contract begins here — spacing matches this paper size.]</p>` +
      `<p>Very truly yours,</p>` +
      `<p>[Signature line]<br />${escapeHtml(FIRM_NAME)}</p>` +
      `</div>` +
      buildFirmPageFooterHtml(contact) +
      `</div></section>`
    );
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(FIRM_NAME)} — Letterhead</title>
  ${buildFirmLetterheadFontLinkHtml()}
  <style>
    ${letterheadCss}
    ${stationeryCss}
    ${bodyCss}
    html, body { margin: 0; background: #ece8df; color: ${INK}; }
    body { font-family: ${SERIF}; }
    .preview-toolbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 254, 253, 0.92);
      border-bottom: 1px solid ${ACCENT_PALE};
      backdrop-filter: blur(8px);
      font-family: ${SANS};
    }
    .preview-toolbar button {
      border: 1px solid ${ACCENT_PALE};
      background: #ffffff;
      color: ${ACCENT};
      border-radius: 999px;
      padding: 7px 14px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .preview-toolbar button.is-active {
      border-color: ${ACCENT_LIGHT};
      background: linear-gradient(145deg, #f5f5f5, #ffffff);
      color: ${INK};
    }
    .preview-stack { padding: 16px 12px 40px; }
    .preview-block { margin: 0 auto 28px; max-width: 100%; }
    .preview-block__label {
      margin: 0 0 10px;
      text-align: center;
      font-family: ${SANS};
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }
    .sheet {
      position: relative;
      margin: 0 auto;
      background: ${PAPER};
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
      box-sizing: border-box;
      --firm-sheet-x: 0.6in;
      padding: 0.38in var(--firm-sheet-x) 0.92in;
      overflow: hidden;
    }
    .sheet--letter { width: 8.5in; height: 11in; }
    .sheet--legal { width: 8.5in; height: 13in; }
    .sheet--a4 { width: 210mm; height: 297mm; padding: 14mm 15mm 22mm; }
    .body-sample {
      margin-top: 0.22in;
      padding-bottom: 0.88in;
      box-sizing: border-box;
    }
    .sheet--a4 .body-sample {
      margin-top: 5mm;
      padding-bottom: 24mm;
    }
    .preview-note {
      max-width: 36rem;
      margin: 0 auto;
      padding: 0 16px 24px;
      font-family: ${SANS};
      font-size: 10px;
      line-height: 1.55;
      color: ${MUTED};
      text-align: center;
    }
    @media print {
      html, body { background: #fff; }
      .preview-toolbar, .preview-block__label, .preview-note { display: none !important; }
      .preview-stack { padding: 0; }
      .preview-block { display: none; margin: 0; page-break-after: always; }
      .preview-block.is-print-target { display: block; }
      .sheet {
        margin: 0;
        box-shadow: none;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .sheet--letter { width: 8.5in; height: 11in; size: letter; }
      .sheet--legal { width: 8.5in; height: 13in; size: legal; }
      .sheet--a4 { width: 210mm; height: 297mm; padding: 14mm 15mm 22mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="preview-toolbar" role="tablist" aria-label="Paper size">
    ${FIRM_PAGE_SIZE_ORDER.map(
      (size) =>
        `<button type="button" data-size="${size}" class="${size === "legal" ? "is-active" : ""}">${escapeHtml(getFirmPageSpec(size).label)}</button>`
    ).join("")}
    <button type="button" id="print-btn">Print selected size</button>
  </div>
  <p class="preview-note">Choose a size, then Print → Save as PDF for stationery. Contract PDFs in this app use the same letterhead layout.</p>
  <div class="preview-stack">
    ${sheets}
  </div>
  <script>
    (function () {
      var active = "legal";
      var blocks = document.querySelectorAll(".preview-block");
      var buttons = document.querySelectorAll(".preview-toolbar button[data-size]");
      function setActive(size) {
        active = size;
        buttons.forEach(function (btn) {
          btn.classList.toggle("is-active", btn.getAttribute("data-size") === size);
        });
        blocks.forEach(function (block) {
          var match = block.getAttribute("data-size") === size;
          block.style.display = match ? "block" : "none";
          block.classList.toggle("is-print-target", match);
        });
      }
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          setActive(btn.getAttribute("data-size"));
        });
      });
      document.getElementById("print-btn").addEventListener("click", function () {
        window.print();
      });
      setActive(active);
    })();
  </script>
</body>
</html>`;
}
