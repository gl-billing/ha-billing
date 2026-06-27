import { BILLING_DOC_COLORS, formatBillingDate } from "@/lib/billing-document-design";
import { formatClientSalutation, formatClientSalutationHtml } from "@/lib/client-greeting";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import {
  buildFirmEmailBodyParagraph,
  buildFirmEmailClosingLine,
  buildFirmEmailGreetingLine,
  buildFirmFormalEmailShell,
  escapeFirmEmailHtml,
  wrapFirmClientEmailDocument,
  cream,
  goldLight,
  goldPale,
  ink,
  muted,
  white,
  FIRM_EMAIL_SANS,
  FIRM_EMAIL_SERIF
} from "@/lib/firm-email-shell";
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
  return escapeFirmEmailHtml(value);
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
      `<p style="margin:0 0 12px;font-family:${FIRM_EMAIL_SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${muted};font-weight:700;">${escapeFirmEmailHtml(platformJoinLabel(platform))}</p>` +
      `<a href="${escapeFirmEmailHtml(link)}" style="display:inline-block;padding:12px 28px;background:${BILLING_DOC_COLORS.headerBg};color:${white};font-family:${FIRM_EMAIL_SERIF};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase;">Open meeting link</a>` +
      `<p style="margin:12px 0 0;font-family:${FIRM_EMAIL_SANS};font-size:11px;line-height:1.5;color:${muted};word-break:break-all;">${escapeFirmEmailHtml(link)}</p>` +
      `</td></tr></table>`
    );
  }

  if (venue.trim()) {
    return (
      `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;background:${cream};border:1px solid ${goldPale};">` +
      `<tr><td style="padding:16px 18px;">` +
      `<p style="margin:0 0 8px;font-family:${FIRM_EMAIL_SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${muted};font-weight:700;">Connection details</p>` +
      `<p style="margin:0;font-family:${FIRM_EMAIL_SERIF};font-size:14px;line-height:1.65;color:${ink};white-space:pre-wrap;">${escapeFirmEmailHtml(venue.trim())}</p>` +
      `</td></tr></table>`
    );
  }

  return "";
}

function detailRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td style="padding:10px 14px 10px 0;font-family:${FIRM_EMAIL_SANS};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${muted};width:34%;vertical-align:top;border-bottom:1px solid ${goldPale};">${escapeFirmEmailHtml(label)}</td>` +
    `<td style="padding:10px 0;font-family:${FIRM_EMAIL_SERIF};font-size:14px;line-height:1.55;color:${ink};font-weight:600;vertical-align:top;border-bottom:1px solid ${goldPale};">${escapeFirmEmailHtml(value)}</td>` +
    `</tr>`
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
    formatClientSalutationHtml(input.preferredGreeting, input.clientName, escapeFirmEmailHtml) +
    buildFirmEmailGreetingLine() +
    buildFirmEmailBodyParagraph(
      `This email confirms your scheduled <strong>${escapeFirmEmailHtml(category.toLowerCase())}</strong> with <strong>Hernandez &amp; Associates Law Office</strong>.`,
      { color: ink, size: 15, marginBottom: 14 }
    ) +
    buildFirmEmailBodyParagraph(escapeFirmEmailHtml(plainIntro), { marginBottom: 4 }) +
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
      ? `<p style="margin:18px 0 0;padding:14px 16px;background:${cream};border-left:3px solid ${goldLight};font-family:${FIRM_EMAIL_SERIF};font-size:13px;line-height:1.65;color:${ink};">${escapeFirmEmailHtml(note)}</p>`
      : "") +
    buildFirmEmailBodyParagraph(
      "If you need to reschedule or have questions before the appointment, please reply to this email or contact our office.",
      { marginBottom: 14 }
    ) +
    buildFirmEmailClosingLine();

  const htmlBody = wrapFirmClientEmailDocument(
    buildFirmFormalEmailShell({
      sectionLabel: "Schedule confirmation",
      documentTitle: `${category} · ${dateLabel}`,
      innerHtml,
      maxWidth: 580
    })
  );

  return {
    subject: scheduleConfirmationSubject(input),
    body: buildClientEmailPlain(bodyPlain),
    html: buildClientEmailHtml(htmlBody)
  };
}

export function shouldAutoCreateMeetLink(platform: string): boolean {
  return platform.trim() === "Google Meet";
}
