import { BILLING_DOC_COLORS, formatBillingDate } from "@/lib/billing-document-design";
import { formatClientSalutation, formatClientSalutationHtml } from "@/lib/client-greeting";
import { billingEmailLetterheadBannerHtml } from "@/lib/firm-print-brand";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import { resolveExistingMeetUrl } from "@/lib/calendar/meet-link";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  isScheduleConfirmationEvent,
  normalizeScheduleCategory,
  SCHEDULE_CONFIRMATION_CATEGORIES,
  SCHEDULE_CONFIRMATION_PLATFORMS
} from "@/lib/office-tasks/event-form-utils";

export {
  isScheduleConfirmationEvent,
  normalizeScheduleCategory,
  SCHEDULE_CONFIRMATION_CATEGORIES,
  SCHEDULE_CONFIRMATION_PLATFORMS
} from "@/lib/office-tasks/event-form-utils";

const { gold, goldLight, goldPale, cream, ink, muted, white } = BILLING_DOC_COLORS;
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";

export type ScheduleConfirmationEmailInput = {
  item: Pick<
    OfficeItem,
    | "category"
    | "clientCase"
    | "date"
    | "eventDate"
    | "startTime"
    | "endTime"
    | "venue"
    | "platform"
    | "details"
    | "assignedTo"
  >;
  clientName: string;
  preferredGreeting?: string;
  meetLink?: string | null;
  customNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventDateYmd(item: Pick<OfficeItem, "date" | "eventDate">): string {
  return (item.eventDate || item.date || "").trim();
}

function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return "";
}

function platformJoinLabel(platform: string): string {
  switch (platform.trim()) {
    case "Google Meet":
      return "Join via Google Meet";
    case "Zoom":
      return "Join via Zoom";
    case "Microsoft Teams":
      return "Join via Microsoft Teams";
    case "Phone":
      return "Phone conference";
    case "Court AVR":
      return "Court AVR session";
    default:
      return "Join details";
  }
}

function joinInstructions(platform: string, meetLink: string | null | undefined, venue: string): string {
  if (meetLink) {
    return `Please use the link below to join at the scheduled time.`;
  }
  if (platform === "Phone" || platform === "Court AVR") {
    return venue.trim()
      ? `Please dial in or connect using the details below at the scheduled time.`
      : `Our office will share dial-in or connection details before the scheduled time.`;
  }
  if (venue.trim()) {
    return `Please use the connection details below at the scheduled time.`;
  }
  return `Our office will send connection details before the scheduled time if needed.`;
}

function joinBlockHtml(platform: string, meetLink: string | null | undefined, venue: string): string {
  const link = meetLink || resolveExistingMeetUrl({ venue, details: "", platform });
  if (link) {
    return (
      `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;">` +
      `<tr><td align="center" style="padding:18px 16px;background:${cream};border:1px solid ${goldPale};">` +
      `<p style="margin:0 0 12px;font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${gold};font-weight:700;">${escapeHtml(platformJoinLabel(platform))}</p>` +
      `<a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;background:${goldLight};color:#fffefd;font-family:${SERIF};font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;letter-spacing:0.02em;">Open meeting link</a>` +
      `<p style="margin:12px 0 0;font-family:${SANS};font-size:11px;line-height:1.5;color:${muted};word-break:break-all;">${escapeHtml(link)}</p>` +
      `</td></tr></table>`
    );
  }

  if (venue.trim()) {
    return (
      `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;background:${cream};border:1px solid ${goldPale};">` +
      `<tr><td style="padding:16px 18px;">` +
      `<p style="margin:0 0 8px;font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${gold};font-weight:700;">Connection details</p>` +
      `<p style="margin:0;font-family:${SERIF};font-size:14px;line-height:1.65;color:${ink};white-space:pre-wrap;">${escapeHtml(venue.trim())}</p>` +
      `</td></tr></table>`
    );
  }

  return "";
}

function detailRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td style="padding:10px 14px 10px 0;font-family:${SANS};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${muted};width:34%;vertical-align:top;border-bottom:1px solid ${goldPale};">${escapeHtml(label)}</td>` +
    `<td style="padding:10px 0;font-family:${SERIF};font-size:14px;line-height:1.55;color:${ink};font-weight:600;vertical-align:top;border-bottom:1px solid ${goldPale};">${escapeHtml(value)}</td>` +
    `</tr>`
  );
}

function scheduleEmailShell(title: string, subtitle: string, innerHtml: string): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:580px;margin:0 auto;width:100%;">` +
    `<tr><td style="padding:0 4px 10px;">` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="background:${cream};border:1px solid ${goldPale};box-shadow:0 10px 28px rgba(26,22,18,0.08);">` +
    `<tr><td style="height:4px;background:linear-gradient(90deg, ${goldLight} 0%, ${gold} 50%, ${goldLight} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:28px 28px 26px;">` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td style="border-bottom:1px solid ${goldPale};padding-bottom:18px;">` +
    billingEmailLetterheadBannerHtml() +
    `<p style="margin:18px 0 0;font-family:${SANS};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${gold};font-weight:700;">${escapeHtml(title)}</p>` +
    `<p style="margin:8px 0 0;font-family:${SERIF};font-size:20px;line-height:1.25;color:${ink};font-weight:700;">${escapeHtml(subtitle)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding-top:24px;">${innerHtml}</td></tr>` +
    `</table></td></tr></table></td></tr></table>`
  );
}

export function scheduleConfirmationSubject(input: ScheduleConfirmationEmailInput): string {
  const category = normalizeScheduleCategory(input.item.category || "Meeting");
  const dateYmd = eventDateYmd(input.item);
  const dateLabel = dateYmd ? formatBillingDate(dateYmd) : "your appointment";
  return `Schedule confirmation — ${category} on ${dateLabel}`;
}

export function buildScheduleConfirmationEmailPreview(input: ScheduleConfirmationEmailInput): {
  subject: string;
  body: string;
  html: string;
} {
  const category = normalizeScheduleCategory(input.item.category || "Meeting");
  const dateYmd = eventDateYmd(input.item);
  const dateLabel = dateYmd ? formatBillingDate(dateYmd) : "To be confirmed";
  const timeLabel = formatTimeRange(input.item.startTime, input.item.endTime);
  const platform = input.item.platform?.trim() || "Meeting";
  const responsible = input.item.assignedTo?.trim() || "our office";
  const caseLabel = input.item.clientCase?.trim() || input.clientName;
  const note = input.customNote?.trim();

  const plainIntro = joinInstructions(platform, input.meetLink, input.item.venue || "");
  const plainRows = [
    `Appointment: ${category}`,
    `Date: ${dateLabel}`,
    timeLabel ? `Time: ${timeLabel}` : "",
    `Format: ${platform}`,
    input.item.venue?.trim() && !input.meetLink ? `Details: ${input.item.venue.trim()}` : "",
    input.meetLink ? `Meeting link: ${input.meetLink}` : "",
    `With: ${responsible}`,
    `Matter: ${caseLabel}`,
    input.item.details?.trim() ? `Agenda: ${input.item.details.trim()}` : ""
  ].filter(Boolean);

  const bodyPlain =
    `${formatClientSalutation(input.preferredGreeting, input.clientName)},\n\n` +
    `Good day.\n\n` +
    `This email confirms your scheduled ${category.toLowerCase()} with Hernandez & Associates Law Office.\n\n` +
    `${plainIntro}\n\n` +
    plainRows.map((line) => `• ${line}`).join("\n") +
    (note ? `\n\n${note}` : "") +
    `\n\nIf you need to reschedule or have questions before the appointment, please reply to this email or contact our office.\n\n` +
    `Thank you.`;

  const innerHtml =
    formatClientSalutationHtml(input.preferredGreeting, input.clientName, escapeHtml) +
    `<p style="margin:0 0 14px;font-family:${SERIF};font-size:15px;line-height:1.7;color:${ink};">Good day.</p>` +
    `<p style="margin:0 0 14px;font-family:${SERIF};font-size:15px;line-height:1.7;color:${ink};">This email confirms your scheduled <strong>${escapeHtml(category.toLowerCase())}</strong> with <strong>Hernandez &amp; Associates Law Office</strong>.</p>` +
    `<p style="margin:0 0 4px;font-family:${SERIF};font-size:14px;line-height:1.65;color:${muted};">${escapeHtml(plainIntro)}</p>` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;background:${white};border:1px solid ${goldPale};border-radius:2px;">` +
    [
      detailRow("Appointment", category),
      detailRow("Date", dateLabel),
      timeLabel ? detailRow("Time", timeLabel) : "",
      detailRow("Format", platform),
      detailRow("With", responsible),
      detailRow("Matter", caseLabel),
      input.item.details?.trim() ? detailRow("Agenda", input.item.details.trim()) : ""
    ]
      .filter(Boolean)
      .join("") +
    `</table>` +
    joinBlockHtml(platform, input.meetLink, input.item.venue || "") +
    (note
      ? `<p style="margin:18px 0 0;padding:14px 16px;background:${cream};border-left:3px solid ${goldLight};font-family:${SERIF};font-size:13px;line-height:1.65;color:${ink};">${escapeHtml(note)}</p>`
      : "") +
    `<p style="margin:18px 0 0;font-family:${SERIF};font-size:14px;line-height:1.7;color:${ink};">If you need to reschedule or have questions before the appointment, please reply to this email or contact our office.</p>` +
    `<p style="margin:14px 0 0;font-family:${SERIF};font-size:14px;line-height:1.7;color:${ink};">Thank you.</p>`;

  const htmlBody = scheduleEmailShell("Schedule confirmation", `${category} · ${dateLabel}`, innerHtml);

  return {
    subject: scheduleConfirmationSubject(input),
    body: buildClientEmailPlain(bodyPlain),
    html: buildClientEmailHtml(htmlBody)
  };
}

export function shouldAutoCreateMeetLink(platform: string): boolean {
  return platform.trim() === "Google Meet";
}
