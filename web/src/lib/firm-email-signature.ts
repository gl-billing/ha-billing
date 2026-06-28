/** Shared client-facing email signature — matches SOA / AR Gmail emails from Apps Script. */

import {
  BILLING_DOC_COLORS,
  FIRM_ADDRESS,
  FIRM_EMAIL,
  FIRM_LANDLINE,
  FIRM_MOBILE,
  FIRM_NAME,
  FIRM_SUBTITLE,
  FIRM_WEBSITE
} from "@/lib/billing-document-design";
import { SECRETARY } from "@/lib/firm-team-config";

export const FIRM_CONTACT = {
  name: FIRM_NAME,
  tagline: FIRM_SUBTITLE,
  address: FIRM_ADDRESS,
  email: FIRM_EMAIL,
  phone: FIRM_LANDLINE,
  mobile: FIRM_MOBILE,
  landline: FIRM_LANDLINE,
  website: FIRM_WEBSITE
} as const;

const CONFIDENTIALITY_NOTICE =
  "CONFIDENTIALITY NOTICE: This email and its attachments are confidential and may contain privileged, proprietary, or legally protected information intended only for the addressee. If you received this email in error, please notify the sender immediately, delete the message and attachments from your system, and do not copy, disclose, distribute, or use any part of its contents. Hernandez & Associates does not waive any privilege, confidentiality protection, or legal right by reason of any inadvertent or erroneous transmission.";

/** Hosted banner — Hernandez logo bar (matches `public/brand/cover.png`). */
export const EMAIL_SIGNATURE_BANNER_PATH = "/brand/email-signature-banner.png";
export const EMAIL_SIGNATURE_BANNER_VERSION = "ha-v1";

export type FirmEmailSigner = {
  name: string;
  title: string;
};

export function getFirmEmailSigner(): FirmEmailSigner {
  return {
    name: process.env.FIRM_EMAIL_SIGNER_NAME?.trim() || SECRETARY.signatureName,
    title: process.env.FIRM_EMAIL_SIGNER_TITLE?.trim() || "Firm Secretary"
  };
}

/** Content-ID for the inline signature banner image in outgoing email MIME. */
export const EMAIL_SIGNATURE_BANNER_CID = "gl_email_signature_banner";

function emailSignatureBannerCidSrc(): string {
  return `cid:${EMAIL_SIGNATURE_BANNER_CID}`;
}

function publicAppUrl(): string | null {
  const root = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return root || null;
}

/** Hosted banner URL — preview/fallback; sent mail uses Drive + inline CID. */
function emailSignatureBannerUrl(): string | null {
  const root = publicAppUrl();
  const path = `${EMAIL_SIGNATURE_BANNER_PATH}?v=${EMAIL_SIGNATURE_BANNER_VERSION}`;
  return root ? `${root}${path}` : path;
}

function buildSignatureBannerHtml(bannerSrc: string): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin:0 0 8px;">` +
    `<tr><td align="center" style="padding:0;line-height:0;font-size:0;">` +
    `<img src="${bannerSrc}" alt="${FIRM_NAME}" width="560" ` +
    `style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />` +
    `</td></tr></table>`
  );
}

/** Detect whether HTML already includes the firm email signature block. */
export function clientEmailHasSignature(content: string): boolean {
  return (
    content.includes("gl-email-signature") ||
    content.includes("CONFIDENTIALITY NOTICE:") ||
    content.includes(EMAIL_SIGNATURE_BANNER_CID) ||
    content.includes("/brand/email-signature-banner") ||
    (content.includes(FIRM_NAME) && content.includes("Respectfully,"))
  );
}

/** Remove an appended firm signature so send-time can re-insert with inline cid banner. */
export function stripClientEmailSignature(html: string): string {
  const trimmed = String(html || "").trim();
  if (!clientEmailHasSignature(trimmed)) return trimmed;

  const marker = "<!-- gl-email-signature -->";
  const markerIdx = trimmed.indexOf(marker);
  if (markerIdx >= 0) {
    return trimmed.slice(0, markerIdx).replace(/(<br\s*\/?>\s*)+$/i, "").trim();
  }

  const tableMatch = trimmed.match(
    /(?:<br\s*\/?>\s*)*<table[^>]*style="[^"]*max-width:\s*560px[^"]*"[^>]*>[\s\S]*?Respectfully,[\s\S]*?<\/table>/i
  );
  if (tableMatch?.index != null) {
    return trimmed.slice(0, tableMatch.index).replace(/(<br\s*\/?>\s*)+$/i, "").trim();
  }

  const respectfullyIdx = trimmed.search(/Respectfully,/i);
  if (respectfullyIdx < 0) return trimmed;
  return trimmed.slice(0, respectfullyIdx).replace(/(<br\s*\/?>\s*)+$/i, "").trim();
}

export function getFirmEmailSignatureHtml(options?: { bannerSrc?: string | null }): string {
  const signer = getFirmEmailSigner();
  const bannerSrc = options?.bannerSrc ?? emailSignatureBannerCidSrc();
  const { ink, muted } = BILLING_DOC_COLORS;
  const bannerHtml = bannerSrc ? buildSignatureBannerHtml(bannerSrc) : "";

  return (
    `<!-- gl-email-signature -->` +
    `<br><br>` +
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" ` +
    `style="max-width:560px;font-family:Georgia,'Times New Roman',serif;color:${ink};">` +
    `<tr><td style="padding:0;">` +
    `<p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${ink};">Respectfully,</p>` +
    bannerHtml +
    `<p style="margin:8px 0 2px;text-align:center;font-size:11px;line-height:1.4;font-weight:600;color:${ink};">${signer.name}</p>` +
    `<p style="margin:0 0 12px;text-align:center;font-size:10px;line-height:1.35;color:${muted};">${signer.title}</p>` +
    `<p style="margin:0;font-size:9px;line-height:1.45;color:${muted};text-align:justify;">` +
    CONFIDENTIALITY_NOTICE +
    `</p>` +
    `</td></tr></table>`
  );
}

export function getFirmEmailSignaturePlain(): string {
  const signer = getFirmEmailSigner();
  return (
    `\n\nRespectfully,\n\n` +
    `${signer.name}\n` +
    `${signer.title}\n\n` +
    CONFIDENTIALITY_NOTICE
  );
}

export function buildClientEmailHtml(bodyHtml: string): string {
  return ensureClientEmailHtml(bodyHtml);
}

export function buildClientEmailPlain(bodyPlain: string): string {
  return ensureClientEmailPlain(bodyPlain);
}

function wrapClientEmailHtml(bodyHtml: string, signatureHtml: string): string {
  const body = String(bodyHtml || "").trim();
  const wrappedBody =
    body.startsWith('<div style="font-family:Georgia') && body.endsWith("</div>")
      ? body.slice(0, body.lastIndexOf("</div>")).trim()
      : body;

  return (
    `<div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:${BILLING_DOC_COLORS.ink};">` +
    wrappedBody +
    signatureHtml +
    `</div>`
  );
}

/** Wrap client email HTML with the firm signature when missing. */
export function ensureClientEmailHtml(bodyHtml: string, options?: { bannerSrc?: string | null }): string {
  const trimmed = String(bodyHtml || "").trim();
  const bannerSrc =
    options?.bannerSrc === undefined
      ? emailSignatureBannerUrl() || emailSignatureBannerCidSrc()
      : options.bannerSrc;
  const signatureHtml = getFirmEmailSignatureHtml({ bannerSrc });
  const sendingWithInlineBanner = Boolean(bannerSrc?.startsWith("cid:"));

  if (!trimmed) {
    return wrapClientEmailHtml("", signatureHtml);
  }

  // Preview HTML may already include the signature with a hosted banner URL.
  // At send time, strip and re-append so the HTML references cid:… and the banner
  // renders inline (same as SOA/AR) instead of appearing as a separate attachment.
  if (sendingWithInlineBanner && clientEmailHasSignature(trimmed)) {
    const bodyOnly = stripClientEmailSignature(trimmed);
    return wrapClientEmailHtml(bodyOnly, signatureHtml);
  }

  if (clientEmailHasSignature(trimmed)) return trimmed;

  return wrapClientEmailHtml(trimmed, signatureHtml);
}

/** Append plain-text firm signature when missing. */
export function stripClientEmailSignaturePlain(plain: string): string {
  const trimmed = String(plain || "").trim();
  const respectfullyIdx = trimmed.search(/\n\nRespectfully,\n\n/i);
  if (respectfullyIdx >= 0) return trimmed.slice(0, respectfullyIdx).trim();
  const noticeIdx = trimmed.indexOf("CONFIDENTIALITY NOTICE:");
  if (noticeIdx >= 0) return trimmed.slice(0, noticeIdx).trim();
  return trimmed;
}

export function ensureClientEmailPlain(bodyPlain: string, options?: { reswapSignature?: boolean }): string {
  const trimmed = String(bodyPlain || "").trim();
  if (options?.reswapSignature) {
    const bodyOnly = stripClientEmailSignaturePlain(trimmed);
    return `${bodyOnly}${getFirmEmailSignaturePlain()}`;
  }
  if (!trimmed) return getFirmEmailSignaturePlain().trim();
  if (trimmed.includes("CONFIDENTIALITY NOTICE:") || trimmed.includes("Respectfully,")) {
    return trimmed;
  }
  return `${trimmed}${getFirmEmailSignaturePlain()}`;
}
