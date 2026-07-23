/**
 * Premium formal email layout — matches Hernandez letterhead (logo, double rules, serif body).
 */

import { BILLING_DOC_COLORS } from "@/lib/billing-document-design";
import { billingEmailLetterheadBannerHtml } from "@/lib/firm-print-brand";

export const FIRM_EMAIL_SERIF = "Georgia,'Times New Roman',serif";
export const FIRM_EMAIL_SANS = "Arial,Helvetica,sans-serif";

const { gold, goldLight, goldPale, cream, ink, muted, line, white, headerBg } = BILLING_DOC_COLORS;

export function escapeFirmEmailHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Double rule masthead — same visual language as formal letterhead PDFs. */
export function buildFirmEmailMastheadRulesHtml(): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td style="border-top:2px solid ${ink};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="border-top:1px solid ${line};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `</table>`
  );
}

export function buildFirmEmailBodyParagraph(
  text: string,
  options?: { marginBottom?: number; color?: string; size?: number }
): string {
  const mb = options?.marginBottom ?? 16;
  const color = options?.color ?? muted;
  const size = options?.size ?? 14;
  return (
    `<p style="margin:0 0 ${mb}px;font-family:${FIRM_EMAIL_SERIF};font-size:${size}px;line-height:1.8;color:${color};">` +
    `${text}</p>`
  );
}

export function buildFirmEmailSalutationLine(text: string): string {
  return (
    `<p style="margin:0 0 4px;font-family:${FIRM_EMAIL_SERIF};font-size:15px;line-height:1.7;color:${ink};font-weight:600;">` +
    `${escapeFirmEmailHtml(text)},</p>`
  );
}

export function buildFirmEmailGreetingLine(): string {
  return buildFirmEmailBodyParagraph("Good day.", { marginBottom: 18, color: ink, size: 14 });
}

export function buildFirmEmailDetailRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td style="padding:9px 12px 9px 0;font-family:${FIRM_EMAIL_SANS};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${muted};width:38%;vertical-align:top;">${escapeFirmEmailHtml(label)}</td>` +
    `<td style="padding:9px 0;font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.5;color:${ink};font-weight:600;vertical-align:top;">${escapeFirmEmailHtml(value)}</td>` +
    `</tr>`
  );
}

export function buildFirmEmailDetailsTable(rows: Array<{ label: string; value: string }>): string {
  const body = rows.map((row) => buildFirmEmailDetailRow(row.label, row.value)).join("");
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;border-top:1px solid ${goldPale};">` +
    body +
    `</table>`
  );
}

export function buildFirmEmailCtaButton(href: string, label: string): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:20px 0 0;">` +
    `<tr><td align="center" style="padding:0;">` +
    `<a href="${escapeFirmEmailHtml(href)}" style="display:inline-block;padding:12px 28px;background:${ink};color:${white};` +
    `font-family:${FIRM_EMAIL_SERIF};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase;">` +
    `${escapeFirmEmailHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

export function buildFirmEmailClosingLine(text = "Thank you."): string {
  return buildFirmEmailBodyParagraph(escapeFirmEmailHtml(text), { marginBottom: 0, color: ink });
}

/** Card shell for SOA, AR, letters, portal links, and similar client correspondence. */
export function buildFirmFormalEmailShell(options: {
  sectionLabel: string;
  documentTitle: string;
  innerHtml: string;
  maxWidth?: number;
}): string {
  const width = options.maxWidth ?? 560;
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:${width}px;margin:0 auto;width:100%;">` +
    `<tr><td bgcolor="${white}" style="padding:26px 30px 28px;border:1px solid ${line};">` +
    billingEmailLetterheadBannerHtml() +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td style="border-bottom:1px solid ${goldPale};padding:18px 0 16px;">` +
    `<p style="margin:0;font-family:${FIRM_EMAIL_SERIF};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${muted};font-weight:700;">${escapeFirmEmailHtml(options.sectionLabel)}</p>` +
    `<p style="margin:8px 0 0;font-family:${FIRM_EMAIL_SERIF};font-size:20px;line-height:1.3;color:${ink};font-weight:700;">${escapeFirmEmailHtml(options.documentTitle)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding-top:22px;">${options.innerHtml}</td></tr>` +
    `</table></td></tr></table>`
  );
}

export function wrapFirmClientEmailDocument(innerShellHtml: string): string {
  return (
    `<div style="font-family:${FIRM_EMAIL_SERIF};font-size:14px;line-height:1.65;color:${ink};">` +
    innerShellHtml +
    `</div>`
  );
}

/** Lighter shell for celebratory or warm-tone messages (birthday, etc.). */
export function buildFirmWarmEmailShell(options: {
  eyebrow: string;
  headline: string;
  innerHtml: string;
}): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;margin:0 auto;width:100%;">` +
    `<tr><td bgcolor="${white}" style="padding:32px 30px 30px;border:1px solid ${line};">` +
    buildFirmEmailMastheadRulesHtml() +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:18px 0 0;">` +
    `<tr><td align="center" style="padding:0 0 8px;">` +
    `<p style="margin:0;font-family:${FIRM_EMAIL_SERIF};font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${muted};">${escapeFirmEmailHtml(options.eyebrow)}</p>` +
    `</td></tr>` +
    `<tr><td align="center" style="padding:0 0 6px;font-family:${FIRM_EMAIL_SERIF};font-size:22px;line-height:1.2;color:${ink};font-weight:700;font-style:italic;">` +
    `${escapeFirmEmailHtml(options.headline)}` +
    `</td></tr>` +
    `<tr><td style="height:1px;background:${line};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding-top:24px;">${options.innerHtml}</td></tr>` +
    `</table></td></tr></table>`
  );
}

export { gold, goldLight, goldPale, cream, ink, muted, line, white, headerBg };
