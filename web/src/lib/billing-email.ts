import { formatPeso } from "@/lib/gl-config";
import type { SoaStatusReportPayload } from "@/lib/gl-config";
import { formatClientSalutation } from "@/lib/client-greeting";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import {
  buildFirmEmailBodyParagraph,
  buildFirmEmailClosingLine,
  buildFirmEmailDetailsTable,
  buildFirmEmailGreetingLine,
  buildFirmEmailSalutationLine,
  buildFirmFormalEmailShell,
  cream,
  escapeFirmEmailHtml,
  goldPale,
  ink,
  muted,
  wrapFirmClientEmailDocument,
  FIRM_EMAIL_SANS,
  FIRM_EMAIL_SERIF
} from "@/lib/firm-email-shell";

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

function statusReportHtml(report: SoaStatusReportPayload): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;background:${cream};border:1px solid ${goldPale};">` +
    `<tr><td style="padding:16px 18px;">` +
    `<p style="margin:0 0 10px;font-family:${FIRM_EMAIL_SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${muted};font-weight:700;">Status report</p>` +
    `<p style="margin:0 0 6px;font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.6;color:${ink};"><strong>Case:</strong> ${escapeFirmEmailHtml(report.caseTitle || "—")}</p>` +
    `<p style="margin:0 0 6px;font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.6;color:${ink};"><strong>Hearing / appearance:</strong> ${escapeFirmEmailHtml(report.hearingDate)}${report.hearingTime ? ` at ${escapeFirmEmailHtml(report.hearingTime)}` : ""}</p>` +
    `<p style="margin:0 0 6px;font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.6;color:${ink};"><strong>Incident:</strong> ${escapeFirmEmailHtml(report.incident || "—")}</p>` +
    `<p style="margin:0 0 10px;font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.6;color:${ink};"><strong>Handling lawyer:</strong> ${escapeFirmEmailHtml(report.handlingLawyer || "—")}</p>` +
    `<p style="margin:0;font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.75;color:${muted};">${escapeFirmEmailHtml(report.summary)}</p>` +
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

  const inner =
    buildFirmEmailSalutationLine(formatClientSalutation(input.preferredGreeting, input.clientName)) +
    buildFirmEmailGreetingLine() +
    buildFirmEmailBodyParagraph(escapeFirmEmailHtml(intro)) +
    buildFirmEmailBodyParagraph(
      escapeFirmEmailHtml(
        `Should you have any questions regarding the billing details${hasStatus ? " or the status report" : ""}, kindly contact our office. We appreciate your prompt attention to the amount due by the date indicated in the attached SOA.`
      )
    ) +
    buildFirmEmailDetailsTable([
      { label: "Invoice no.", value: input.invoiceNumber },
      { label: "Client reference", value: input.clientCode },
      { label: "Total amount due", value: formatPeso(input.totalDue) }
    ]) +
    (hasStatus && input.statusReport ? statusReportHtml(input.statusReport) : "") +
    buildFirmEmailClosingLine("Thank you for your continued trust in our firm.");

  return buildClientEmailHtml(
    wrapFirmClientEmailDocument(
      buildFirmFormalEmailShell({
        sectionLabel: "Billing",
        documentTitle: "Statement of Account",
        innerHtml: inner
      })
    )
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
    ? buildFirmEmailBodyParagraph(
        `<strong style="color:${ink};">Note:</strong> ${escapeFirmEmailHtml(input.extraNote.trim())}`,
        { marginBottom: 0, color: muted, size: 13 }
      )
    : "";

  const inner =
    buildFirmEmailSalutationLine(formatClientSalutation(input.preferredGreeting, input.clientName)) +
    buildFirmEmailGreetingLine() +
    buildFirmEmailBodyParagraph(
      "We acknowledge receipt of your recent payment. Please find attached your official Acknowledgment Receipt for your records."
    ) +
    buildFirmEmailBodyParagraph(
      "We sincerely appreciate your prompt payment and truly value the trust you continue to place in our firm."
    ) +
    buildFirmEmailDetailsTable([
      { label: "Receipt no.", value: input.receiptNumber },
      { label: "Payment date", value: input.paymentDate },
      { label: "Amount paid", value: formatPeso(input.amount) },
      { label: "Payment method", value: input.method || "—" },
      { label: "Payment details", value: input.details || "—" },
      { label: "Payment for", value: input.paymentFor || "Payment received" },
      { label: "Remaining balance", value: formatPeso(input.balance) }
    ]) +
    noteHtml +
    buildFirmEmailClosingLine();

  return buildClientEmailHtml(
    wrapFirmClientEmailDocument(
      buildFirmFormalEmailShell({
        sectionLabel: "Receipt",
        documentTitle: "Acknowledgment of Payment",
        innerHtml: inner
      })
    )
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
