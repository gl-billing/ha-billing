import { billingEmailLetterheadBannerHtml } from "@/lib/firm-print-brand";
import { formatPeso } from "@/lib/gl-config";
import type { SoaStatusReportPayload } from "@/lib/gl-config";
import { formatClientSalutation } from "@/lib/client-greeting";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";

const GOLD = "#8a6b2a";
const GOLD_LIGHT = "#b8913d";
const GOLD_PALE = "#e8dcc4";
const CREAM = "#faf8f4";
const INK = "#1a1612";
const MUTED = "#4a4339";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";

type ClientEmailGreeting = {
  preferredGreeting?: string;
  clientName?: string;
};

export type SoaEmailInput = ClientEmailGreeting & {
  clientCode: string;
  invoiceNumber: string;
  totalDue: number;
  statusReport?: SoaStatusReportPayload | null;
  includeStatusReport: boolean;
};

export type ArEmailInput = ClientEmailGreeting & {
  clientCode: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  method: string;
  details: string;
  paymentFor: string;
  balance: number;
  extraNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function billingEmailShell(title: string, subtitle: string, innerHtml: string): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;margin:0 auto;width:100%;">` +
    `<tr><td bgcolor="${CREAM}" style="padding:28px 28px 26px;border:1px solid ${GOLD_PALE};">` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td style="border-bottom:2px solid ${GOLD_LIGHT};padding-bottom:16px;">` +
    billingEmailLetterheadBannerHtml() +
    `<p style="margin:16px 0 0;font-family:${SERIF};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${GOLD};font-weight:700;">${escapeHtml(title)}</p>` +
    `<p style="margin:6px 0 0;font-family:${SERIF};font-size:18px;line-height:1.3;color:${INK};font-weight:700;">${escapeHtml(subtitle)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding-top:22px;">${innerHtml}</td></tr>` +
    `</table></td></tr></table>`
  );
}

function detailRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td style="padding:7px 0;font-family:${SANS};font-size:12px;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(label)}</td>` +
    `<td style="padding:7px 0;font-family:${SERIF};font-size:13px;color:${INK};font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>` +
    `</tr>`
  );
}

function detailsTable(rows: Array<{ label: string; value: string }>): string {
  const body = rows.map((row) => detailRow(row.label, row.value)).join("");
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:18px 0 0;border-top:1px solid ${GOLD_PALE};">` +
    body +
    `</table>`
  );
}

function statusReportHtml(report: SoaStatusReportPayload): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;background:${CREAM};border:1px solid ${GOLD_PALE};">` +
    `<tr><td style="padding:14px 16px;">` +
    `<p style="margin:0 0 10px;font-family:${SANS};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${GOLD};font-weight:700;">Status report</p>` +
    `<p style="margin:0 0 6px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${INK};"><strong>Case:</strong> ${escapeHtml(report.caseTitle || "—")}</p>` +
    `<p style="margin:0 0 6px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${INK};"><strong>Hearing / appearance:</strong> ${escapeHtml(report.hearingDate)}${report.hearingTime ? ` at ${escapeHtml(report.hearingTime)}` : ""}</p>` +
    `<p style="margin:0 0 6px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${INK};"><strong>Incident:</strong> ${escapeHtml(report.incident || "—")}</p>` +
    `<p style="margin:0 0 10px;font-family:${SERIF};font-size:13px;line-height:1.6;color:${INK};"><strong>Handling lawyer:</strong> ${escapeHtml(report.handlingLawyer || "—")}</p>` +
    `<p style="margin:0;font-family:${SERIF};font-size:13px;line-height:1.75;color:${MUTED};">${escapeHtml(report.summary)}</p>` +
    `</td></tr></table>`
  );
}

function statusReportPlain(report: SoaStatusReportPayload): string {
  return [
    "",
    "STATUS REPORT",
    `Case: ${report.caseTitle || "—"}`,
    `Hearing / appearance: ${report.hearingDate}${report.hearingTime ? ` at ${report.hearingTime}` : ""}`,
    `Incident: ${report.incident || "—"}`,
    `Handling lawyer: ${report.handlingLawyer || "—"}`,
    "",
    report.summary
  ].join("\n");
}

export function buildSoaEmailHtml(input: SoaEmailInput): string {
  const hasStatus =
    input.includeStatusReport && Boolean(input.statusReport?.summary?.trim());
  const intro = hasStatus
    ? "Please find attached your Statement of Account. For your reference, we have also included a brief status report regarding your matter below."
    : "Please find attached your Statement of Account for your review and records.";

  const paragraphs =
    `<p style="margin:0 0 16px;font-family:${SERIF};font-size:14px;line-height:1.8;color:${MUTED};">${escapeHtml(intro)}</p>` +
    `<p style="margin:0 0 16px;font-family:${SERIF};font-size:14px;line-height:1.8;color:${MUTED};">Should you have any questions regarding the billing details${hasStatus ? " or the status report" : ""}, kindly contact our office. We appreciate your prompt attention to the amount due by the date indicated in the attached SOA.</p>`;

  const inner =
    `<p style="margin:0 0 4px;font-family:${SERIF};font-size:15px;line-height:1.7;color:${INK};">${escapeHtml(formatClientSalutation(input.preferredGreeting, input.clientName))},</p>` +
    `<p style="margin:0 0 18px;font-family:${SERIF};font-size:14px;line-height:1.7;color:${INK};">Good day.</p>` +
    paragraphs +
    detailsTable([
      { label: "Invoice no.", value: input.invoiceNumber },
      { label: "Client reference", value: input.clientCode },
      { label: "Total amount due", value: formatPeso(input.totalDue) }
    ]) +
    (hasStatus && input.statusReport ? statusReportHtml(input.statusReport) : "") +
    `<p style="margin:22px 0 0;font-family:${SERIF};font-size:14px;line-height:1.7;color:${INK};">Thank you for your continued trust in our firm.</p>`;

  return buildClientEmailHtml(
    `<div style="font-family:${SERIF};font-size:14px;line-height:1.65;color:${INK};">` +
      billingEmailShell("Billing", "Statement of Account", inner) +
      `</div>`
  );
}

export function buildSoaEmailPlain(input: SoaEmailInput): string {
  const hasStatus =
    input.includeStatusReport && Boolean(input.statusReport?.summary?.trim());
  const intro = hasStatus
    ? "Please find attached your Statement of Account. For your reference, we have also included a brief status report regarding your matter below."
    : "Please find attached your Statement of Account for your review and records.";

  const body =
    `${formatClientSalutation(input.preferredGreeting, input.clientName)},\n\n` +
    `Good day.\n\n` +
    `${intro}\n\n` +
    `Should you have any questions regarding the billing details${hasStatus ? " or the status report" : ""}, kindly contact our office. We appreciate your prompt attention to the amount due by the date indicated in the attached SOA.\n\n` +
    `Invoice No.: ${input.invoiceNumber}\n` +
    `Client reference: ${input.clientCode}\n` +
    `Total amount due: ${formatPeso(input.totalDue)}\n` +
    (hasStatus && input.statusReport ? statusReportPlain(input.statusReport) + "\n" : "") +
    `\nThank you for your continued trust in our firm.`;

  return buildClientEmailPlain(body);
}

export function buildArEmailHtml(input: ArEmailInput): string {
  const noteHtml = input.extraNote?.trim()
    ? `<p style="margin:16px 0 0;font-family:${SERIF};font-size:13px;line-height:1.7;color:${MUTED};"><strong style="color:${INK};">Note:</strong> ${escapeHtml(input.extraNote.trim())}</p>`
    : "";

  const inner =
    `<p style="margin:0 0 4px;font-family:${SERIF};font-size:15px;line-height:1.7;color:${INK};">${escapeHtml(formatClientSalutation(input.preferredGreeting, input.clientName))},</p>` +
    `<p style="margin:0 0 18px;font-family:${SERIF};font-size:14px;line-height:1.7;color:${INK};">Good day.</p>` +
    `<p style="margin:0 0 16px;font-family:${SERIF};font-size:14px;line-height:1.8;color:${MUTED};">We acknowledge receipt of your recent payment. Please find attached your official Acknowledgment Receipt for your records.</p>` +
    `<p style="margin:0 0 16px;font-family:${SERIF};font-size:14px;line-height:1.8;color:${MUTED};">We sincerely appreciate your prompt payment and truly value the trust you continue to place in our firm.</p>` +
    detailsTable([
      { label: "Receipt no.", value: input.receiptNumber },
      { label: "Payment date", value: input.paymentDate },
      { label: "Amount paid", value: formatPeso(input.amount) },
      { label: "Payment method", value: input.method || "—" },
      { label: "Payment details", value: input.details || "—" },
      { label: "Payment for", value: input.paymentFor || "Payment received" },
      { label: "Remaining balance", value: formatPeso(input.balance) }
    ]) +
    noteHtml +
    `<p style="margin:22px 0 0;font-family:${SERIF};font-size:14px;line-height:1.7;color:${INK};">Thank you.</p>`;

  return buildClientEmailHtml(
    `<div style="font-family:${SERIF};font-size:14px;line-height:1.65;color:${INK};">` +
      billingEmailShell("Receipt", "Acknowledgment of Payment", inner) +
      `</div>`
  );
}

export function buildArEmailPlain(input: ArEmailInput): string {
  const noteText = input.extraNote?.trim() ? `\n\nNote: ${input.extraNote.trim()}` : "";

  const body =
    `${formatClientSalutation(input.preferredGreeting, input.clientName)},\n\n` +
    `Good day.\n\n` +
    `We acknowledge receipt of your recent payment. Please find attached your official Acknowledgment Receipt for your records.\n\n` +
    `We sincerely appreciate your prompt payment and truly value the trust you continue to place in our firm.\n\n` +
    `Receipt No.: ${input.receiptNumber}\n` +
    `Payment Date: ${input.paymentDate}\n` +
    `Amount Paid: ${formatPeso(input.amount)}\n` +
    `Payment Method: ${input.method || "—"}\n` +
    `Payment Details: ${input.details || "—"}\n` +
    `Payment For: ${input.paymentFor || "Payment received"}\n` +
    `Remaining Balance: ${formatPeso(input.balance)}` +
    noteText +
    `\n\nThank you.`;

  return buildClientEmailPlain(body);
}

export function soaEmailSubject(invoiceNumber: string, clientCode: string): string {
  return `Statement of Account: ${invoiceNumber} - ${clientCode}`;
}

export function arEmailSubject(receiptNumber: string, clientCode: string): string {
  return `Acknowledgment Receipt: ${receiptNumber} - ${clientCode}`;
}
