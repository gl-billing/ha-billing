import fs from "fs";
import path from "path";
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
import { formatFirmContactLine } from "@/lib/firm-contact";
import { firmLogoPublicUrl } from "@/lib/firm-logo-url";

const SERIF = "Georgia,'Times New Roman',serif";

export const FIRM_LOGO_PATH = path.join(process.cwd(), "public", "brand", "logo.png");

/** Same official seal as the billing app — used on letterhead and formal PDFs. */
export const FIRM_LETTERHEAD_LOGO_PATH = FIRM_LOGO_PATH;

/** Content-ID for the inline firm logo in outgoing email MIME. */
export const FIRM_LOGO_EMAIL_CID = "ha_firm_logo";

export type FirmLogoInlineImage = {
  contentId: string;
  filename: string;
  mimeType: string;
  content: Buffer;
};

/** Hosted logo URL for in-app previews (falls back to relative path). */
export { firmLogoPublicUrl, firmLetterheadLogoPublicUrl } from "@/lib/firm-logo-url";

export function firmLogoCidSrc(): string {
  return `cid:${FIRM_LOGO_EMAIL_CID}`;
}

function detectImageMimeType(bytes: Buffer): { mimeType: "image/jpeg" | "image/png"; filename: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return { mimeType: "image/jpeg", filename: "logo.jpg" };
  }
  return { mimeType: "image/png", filename: "logo.png" };
}

/** Load firm logo bytes for Gmail inline embedding (correct MIME even when file is JPEG named .png). */
export function loadFirmLogoInlineImage(): FirmLogoInlineImage | null {
  try {
    const content = fs.readFileSync(FIRM_LOGO_PATH);
    const { mimeType, filename } = detectImageMimeType(content);
    return {
      contentId: FIRM_LOGO_EMAIL_CID,
      filename,
      mimeType,
      content
    };
  } catch {
    return null;
  }
}

/** Swap hosted logo URLs for cid:… so the logo renders inside the email body. */
export function inlineFirmLogoInEmailHtml(html: string): { html: string; logoInline: FirmLogoInlineImage | null } {
  const logoInline = loadFirmLogoInlineImage();
  if (!logoInline) return { html, logoInline: null };

  const cidSrc = firmLogoCidSrc();
  const swapped = html.replace(/src="[^"]*\/brand\/logo\.png(?:\?[^"]*)?"/gi, `src="${cidSrc}"`);
  if (swapped === html) return { html, logoInline: null };
  return { html: swapped, logoInline };
}

/** Logo + firm identity row for SOA / AR email letterheads. */
export function billingEmailLetterheadBannerHtml(logoSrc = firmLogoPublicUrl()): string {
  const { gold, goldLight, goldPale, muted } = BILLING_DOC_COLORS;

  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr>` +
    `<td width="76" valign="middle" style="padding-right:16px;">` +
    `<img src="${logoSrc}" alt="" width="120" height="48" style="display:block;width:120px;height:auto;max-height:48px;border:0;background:#ffffff;" />` +
    `</td>` +
    `<td valign="middle" style="border-left:1px solid ${goldPale};padding-left:16px;">` +
    `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.2;color:${gold};font-weight:700;">${FIRM_NAME}</p>` +
    `<p style="margin:4px 0 0;font-family:${SERIF};font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:${muted};">${FIRM_SUBTITLE}</p>` +
    `<p style="margin:6px 0 0;font-family:${SERIF};font-size:9px;line-height:1.45;color:${muted};">${FIRM_ADDRESS}</p>` +
    `<p style="margin:4px 0 0;font-family:${SERIF};font-size:8px;line-height:1.45;color:${muted};">${formatFirmContactLine({
      address: FIRM_ADDRESS,
      mobile: FIRM_MOBILE,
      landline: FIRM_LANDLINE,
      email: FIRM_EMAIL,
      website: FIRM_WEBSITE
    })}</p>` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `<div style="margin:14px 0 0;height:2px;background:linear-gradient(to right,transparent,${goldLight},transparent);"></div>`
  );
}

/** HTML note shown below SOA / AR email previews — matches billing document styling. */
export function billingEmailAttachmentNoteHtml(documentLabel: string): string {
  const { goldPale, muted, gold } = BILLING_DOC_COLORS;
  return (
    `<p style="margin:18px 0 0;padding-top:14px;border-top:1px dashed ${goldPale};` +
    `font-family:${SERIF};font-size:10px;line-height:1.5;color:${muted};">` +
    `<span style="color:${gold};font-weight:700;">PDF attachment:</span> ${documentLabel} will be attached when sent.` +
    `</p>`
  );
}

export { FIRM_ADDRESS, FIRM_NAME, FIRM_SUBTITLE };
