/** Shared client-facing email signature — matches SOA / AR Gmail emails from Apps Script. */

import {
  FIRM_ADDRESS,
  FIRM_EMAIL,
  FIRM_LANDLINE,
  FIRM_MOBILE,
  FIRM_NAME,
  FIRM_SUBTITLE,
  FIRM_WEBSITE
} from "@/lib/billing-document-design";
import { formatFirmContactLine, formatFirmWebsiteLabel } from "@/lib/firm-contact";

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

const CONFIDENTIALITY_NOTICE = `CONFIDENTIALITY NOTICE: This email and any attachments are confidential and may contain privileged, proprietary, or legally protected information intended solely for the use of the individual or entity to whom it is addressed. Any unauthorized review, use, disclosure, copying, or distribution of this communication, in whole or in part, is strictly prohibited and may be unlawful.

If you have received this message in error, please notify the sender immediately by reply email, permanently delete this message and any attachments from your system, and refrain from using, disseminating, or retaining any portion of its contents.

All information contained herein remains confidential and is protected under applicable laws, including but not limited to the Rules on Evidence and the Data Privacy Act of 2012. The sender and its affiliated law office do not waive any privilege or legal right by the inadvertent transmission of this message.

Thank you for your understanding and cooperation.`;

export type FirmEmailSigner = {
  name: string;
  title: string;
};

export function getFirmEmailSigner(): FirmEmailSigner {
  return {
    name: process.env.FIRM_EMAIL_SIGNER_NAME?.trim() || "ELLYZA ANDREA P. AGUANTA",
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

/** Hosted banner URL — preview/fallback only; sent mail uses Drive + inline CID. */
function emailSignatureBannerUrl(): string | null {
  const root = publicAppUrl();
  return root ? `${root}/brand/email-signature-banner.jpg` : null;
}

/** Detect whether HTML already includes the firm email signature block. */
export function clientEmailHasSignature(content: string): boolean {
  return (
    content.includes("gl-email-signature") ||
    content.includes("CONFIDENTIALITY NOTICE:") ||
    content.includes(EMAIL_SIGNATURE_BANNER_CID) ||
    content.includes("/brand/email-signature-banner") ||
    (content.includes(FIRM_CONTACT.email) && content.includes("Respectfully,"))
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
    /(?:<br\s*\/?>\s*)*<table[^>]*style="[^"]*max-width:\s*520px[^"]*"[^>]*>[\s\S]*?Respectfully,[\s\S]*?<\/table>/i
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
  const bannerHtml = bannerSrc
    ? `<img src="${bannerSrc}" alt="${FIRM_CONTACT.name} — ${FIRM_CONTACT.tagline}" width="560" style="display:block;max-width:100%;height:auto;border:0;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.5;color:#1a1612;max-width:520px;border:1px solid #b8913d;">` +
      `<tr><td style="padding:12px;">` +
      `<p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#5c4a1f;">${FIRM_CONTACT.name}</p>` +
      `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8a6b2a;">${FIRM_CONTACT.tagline}</p>` +
      `<p style="margin:0 0 4px;color:#4a4339;">${FIRM_CONTACT.address}</p>` +
      `<p style="margin:0;color:#4a4339;">` +
      `<a href="mailto:${FIRM_CONTACT.email}" style="color:#8a6b2a;text-decoration:none;">${FIRM_CONTACT.email}</a>` +
      (FIRM_CONTACT.mobile
        ? ` &nbsp;|&nbsp; <a href="tel:${FIRM_CONTACT.mobile.replace(/\D/g, "")}" style="color:#8a6b2a;text-decoration:none;">${FIRM_CONTACT.mobile}</a>`
        : "") +
      ` &nbsp;|&nbsp; <a href="tel:+638981032990" style="color:#8a6b2a;text-decoration:none;">${FIRM_CONTACT.landline}</a>` +
      ` &nbsp;|&nbsp; <a href="https://${formatFirmWebsiteLabel(FIRM_CONTACT.website)}" style="color:#8a6b2a;text-decoration:none;">${formatFirmWebsiteLabel(FIRM_CONTACT.website)}</a>` +
      `</p></td></tr></table>`;

  return (
    `<!-- gl-email-signature -->` +
    `<br><br>` +
    `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#1a1612;max-width:520px;">` +
    `<tr><td style="padding:0;">` +
    `<p style="margin:0 0 12px;color:#1a1612;">Respectfully,</p>` +
    bannerHtml +
    `<p style="margin:14px 0 4px;text-align:center;font-size:14px;font-weight:700;color:#1a1612;">${signer.name}</p>` +
    `<p style="margin:0 0 16px;text-align:center;font-size:13px;color:#4a4339;">${signer.title}</p>` +
    `<p style="margin:0;font-size:11px;line-height:1.55;color:#4a4339;text-align:justify;">` +
    CONFIDENTIALITY_NOTICE.replace(/\n\n/g, "<br><br>") +
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
    `${FIRM_CONTACT.name}\n` +
    `${FIRM_CONTACT.tagline}\n` +
    `${FIRM_CONTACT.address}\n` +
    `${formatFirmContactLine()}\n\n` +
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
    `<div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#1a1612;">` +
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
