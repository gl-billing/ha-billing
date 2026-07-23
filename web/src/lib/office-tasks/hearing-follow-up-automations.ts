import { addDaysYmd } from "@/lib/office-tasks/date-only";
import {
  appendRemarkMarkers,
  courtConfirmTaskMarker,
  hasPostHearingFollowUpDone,
  hasPreHearingBriefSent,
  linkedCourtConfirmTaskMarker,
  parsePostHearingEventId,
  postHearingFollowUpDoneMarker,
  postHearingFollowUpMarker,
  preHearingBriefSentMarker
} from "@/lib/office-tasks/event-item-links";
import { isHearingEventCategory, isOpenHearingEvent } from "@/lib/office-tasks/event-form-utils";
import { isHearingItem } from "@/lib/hearing-escalation";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { resolveEventClientContact } from "@/lib/office-tasks/resolve-event-client-contact";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { appendTask } from "@/lib/office-tasks/sheets/tasks";
import { defaultAndreaOperationsAssignee } from "@/lib/office-tasks/task-assignees";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { hasOpenCourtConfirmationTask } from "@/lib/office-tasks/filing-submitted-follow-up";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { SHEETS } from "@/lib/tasks-config";
import { toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { BILLING_DOC_COLORS, formatBillingDate } from "@/lib/billing-document-design";
import { formatClientSalutation } from "@/lib/client-greeting";
import { buildClientEmailPlain } from "@/lib/firm-email-signature";
import { resolveExistingMeetUrl } from "@/lib/calendar/meet-link";
import {
  isValidEmailAddress,
  sendClientEmailViaGmail
} from "@/lib/office-tasks/gmail-send";

const CLIENT_HEARING_CHECKLIST = [
  "Valid government-issued ID",
  "Arrive at least 30 minutes before the scheduled time",
  "Dress appropriately for court or the scheduled venue",
  "Bring documents we discussed for this hearing",
  "Witnesses, if your case requires them"
] as const;

function hearingEventDate(item: OfficeItem): string {
  return (item.eventDate || item.date || "").trim();
}

async function appendEventMarkers(accessToken: string, event: OfficeItem, markers: string[]): Promise<void> {
  if (!markers.length || event.rowNumber < 2) return;
  const remarks = appendRemarkMarkers(event.remarks, markers);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);
}

/** Create Andrea court-confirmation call task when a hearing is logged. */
export async function createCourtConfirmationTaskForHearing(
  accessToken: string,
  eventId: string,
  form: { clientCase: string; eventDate?: string; details: string; venue?: string }
): Promise<string | null> {
  const items = await collectAllItems(accessToken);
  if (hasOpenCourtConfirmationTask(items, eventId)) return null;

  const roster = await getActiveEmployeeNames(accessToken);
  const assignee = defaultAndreaOperationsAssignee(roster);
  const hearingDate = form.eventDate?.trim() || todayYmd();
  const venue = form.venue?.trim();
  const snippet = form.details.trim().slice(0, 100);

  const saved = await appendTask(accessToken, {
    clientCase: form.clientCase,
    assignedTo: assignee,
    dueDate: addDaysYmd(hearingDate, -2),
    priority: "High",
    taskType: "Court liaison",
    description: snippet
      ? `Call court to confirm hearing — ${snippet}`
      : `Call court to confirm hearing on ${hearingDate}`,
    nextAction: venue
      ? `Confirm date/time with ${venue}; mark hearing court-confirmed when done.`
      : "Confirm hearing date and time with the court; mark court-confirmed when done.",
    remarks: courtConfirmTaskMarker(eventId),
    status: "In Progress",
    reminderDays: 1,
    calendarSync: false
  });

  const event = (await collectAllItems(accessToken)).find((item) => item.source === "Event" && item.id === eventId);
  if (event) {
    await appendEventMarkers(accessToken, event, [linkedCourtConfirmTaskMarker(saved.id)]);
  }

  return saved.id;
}

import {
  postHearingFollowUpTasksForEvent,
  resolvePostHearingEventId
} from "@/lib/office-tasks/post-hearing-follow-up-match";

export {
  hasPostHearingFollowUpTask,
  postHearingFollowUpTasksForEvent,
  resolvePostHearingEventId
} from "@/lib/office-tasks/post-hearing-follow-up-match";

function postHearingFollowUpAlreadyHandled(items: OfficeItem[], event: OfficeItem): boolean {
  if (hasPostHearingFollowUpDone(event.remarks || "", event.id)) return true;
  return postHearingFollowUpTasksForEvent(items, event).length > 0;
}

/** Mark the parent hearing so auto-repair does not recreate this follow-up. */
export async function recordPostHearingFollowUpDone(
  accessToken: string,
  task: Pick<OfficeItem, "source" | "remarks" | "clientCase" | "details" | "category">
): Promise<boolean> {
  if (task.source !== "Task") return false;

  const items = await collectAllItems(accessToken);
  const eventId = resolvePostHearingEventId(task, items);
  if (!eventId) return false;

  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event || hasPostHearingFollowUpDone(event.remarks, eventId)) return false;

  await appendEventMarkers(accessToken, event, [postHearingFollowUpDoneMarker(eventId)]);
  return true;
}

/** Day-after-hearing task: confirm outcome and next date. */
export async function createPostHearingFollowUpIfNeeded(
  accessToken: string,
  event: OfficeItem,
  today = todayYmd()
): Promise<string | null> {
  if (!isHearingItem(event) || event.done) return null;
  const hearingDate = hearingEventDate(event);
  if (!hearingDate || hearingDate >= today) return null;

  const items = await collectAllItems(accessToken);
  if (postHearingFollowUpAlreadyHandled(items, event)) return null;

  const daysSince = Math.floor(
    (new Date(`${today}T12:00:00`).getTime() - new Date(`${hearingDate}T12:00:00`).getTime()) / 86_400_000
  );
  if (daysSince < 1) return null;

  const saved = await appendTask(accessToken, {
    clientCase: event.clientCase,
    assignedTo: event.assignedTo || "Admin",
    dueDate: addDaysYmd(hearingDate, 3),
    priority: daysSince >= 3 ? "High" : "Medium",
    taskType: "Court Follow-up",
    description: `Post-hearing follow-up — ${event.details.trim().slice(0, 120) || "confirm outcome"}`,
    nextAction: "Confirm minutes/outcome, next hearing date, and update client.",
    remarks: postHearingFollowUpMarker(event.id),
    status: "In Progress",
    reminderDays: 1,
    calendarSync: false
  });

  return saved.id;
}

export async function reconcilePostHearingFollowUps(
  accessToken: string,
  today = todayYmd(),
  options?: { createNew?: boolean; skipDuplicateCollapse?: boolean }
): Promise<{ created: number; duplicatesClosed: number }> {
  const duplicatesClosed = options?.skipDuplicateCollapse
    ? 0
    : await collapseDuplicateOpenPostHearingFollowUps(accessToken).catch(() => 0);

  if (options?.createNew === false) {
    return { created: 0, duplicatesClosed };
  }

  const items = await collectAllItems(accessToken);
  let created = 0;
  for (const event of items) {
    if (event.source !== "Event" || !isOpenHearingEvent(event)) continue;
    const hearingDate = hearingEventDate(event);
    if (!hearingDate || hearingDate >= today) continue;
    const taskId = await createPostHearingFollowUpIfNeeded(accessToken, event, today);
    if (taskId) created += 1;
  }
  return { created, duplicatesClosed };
}

/** Close duplicate open post-hearing tasks for the same hearing (keeps the oldest row). */
export async function collapseDuplicateOpenPostHearingFollowUps(accessToken: string): Promise<number> {
  const items = await collectAllItems(accessToken);
  let closed = 0;

  for (const event of items) {
    if (event.source !== "Event" || !isHearingItem(event)) continue;
    const open = postHearingFollowUpTasksForEvent(items, event).filter((row) => !row.done);
    if (open.length <= 1) continue;

    const [keep, ...duplicates] = [...open].sort((a, b) => a.rowNumber - b.rowNumber);
    for (const dup of duplicates) {
      if (dup.rowNumber === keep.rowNumber) continue;
      await setItemDone(accessToken, "Task", dup.rowNumber, true);
      closed += 1;
    }
  }

  return closed;
}

function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (start && end) return `${start} – ${end}`;
  return start || "";
}

export function buildPreHearingBriefEmail(input: {
  item: Pick<OfficeItem, "category" | "clientCase" | "date" | "eventDate" | "startTime" | "endTime" | "venue" | "platform" | "details">;
  clientName: string;
  preferredGreeting?: string;
  meetLink?: string | null;
}) {
  const { ink, muted, line, white } = BILLING_DOC_COLORS;
  const dateYmd = hearingEventDate(input.item as OfficeItem);
  const dateLabel = dateYmd ? formatBillingDate(dateYmd) : "the scheduled date";
  const timeLabel = formatTimeRange(input.item.startTime, input.item.endTime);
  const venue = input.item.venue?.trim() || "";
  const meetLink = input.meetLink || resolveExistingMeetUrl(input.item);
  const greeting = formatClientSalutation(input.preferredGreeting, input.clientName);
  const greetingHtml = greeting.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const checklistHtml = CLIENT_HEARING_CHECKLIST.map(
    (line) => `<li style="margin:0 0 8px;font-family:Georgia,serif;font-size:14px;line-height:1.55;color:${ink};">${line}</li>`
  ).join("");

  const checklistPlain = CLIENT_HEARING_CHECKLIST.map((line) => `• ${line}`).join("\n");

  const subject = `Hearing reminder — ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`;

  const body =
    `${greeting}\n\n` +
    `This is a reminder of your upcoming hearing with our office.\n\n` +
    `Date: ${dateLabel}\n` +
    (timeLabel ? `Time: ${timeLabel}\n` : "") +
    (venue ? `Venue: ${venue}\n` : "") +
    (meetLink ? `Online link: ${meetLink}\n` : "") +
    `\nPlease bring / prepare:\n${checklistPlain}\n\n` +
    `If anything has changed or you have questions, reply to this email.\n\n` +
    `Thank you.`;

  const html =
    `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.65;color:${ink};">${greetingHtml},</p>` +
    `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.65;color:${ink};">This is a reminder of your upcoming hearing with our office.</p>` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:0 0 16px;background:${white};border:1px solid ${line};">` +
    `<tr><td style="padding:16px 18px;">` +
    `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${muted};font-weight:700;">Schedule</p>` +
    `<p style="margin:0;font-family:Georgia,serif;font-size:14px;line-height:1.65;color:${ink};"><strong>Date:</strong> ${dateLabel}<br/>` +
    (timeLabel ? `<strong>Time:</strong> ${timeLabel}<br/>` : "") +
    (venue ? `<strong>Venue:</strong> ${venue.replace(/</g, "&lt;")}<br/>` : "") +
    (meetLink ? `<strong>Link:</strong> <a href="${meetLink}" style="color:${ink};">${meetLink}</a>` : "") +
    `</p></td></tr></table>` +
    `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${muted};font-weight:700;">What to bring / expect</p>` +
    `<ul style="margin:0 0 16px;padding-left:20px;">${checklistHtml}</ul>` +
    `<p style="margin:0;font-family:Georgia,serif;font-size:14px;line-height:1.65;color:${muted};">If anything has changed or you have questions, reply to this email.</p>`;

  return {
    subject,
    body: buildClientEmailPlain(body),
    html
  };
}

export type PreHearingBriefResult = {
  sent: string[];
  skipped: number;
};

/** Send client hearing brief emails for hearings exactly N days from today. */
export async function sendPreHearingBriefs(
  accessToken: string,
  options?: { daysBefore?: number; fromEmail?: string }
): Promise<PreHearingBriefResult> {
  const daysBefore = options?.daysBefore ?? 3;
  const today = todayYmd();
  const targetDate = addDaysYmd(today, daysBefore);
  const items = await collectAllItems(accessToken);
  const sent: string[] = [];
  let skipped = 0;

  for (const event of items) {
    if (!isOpenHearingEvent(event)) continue;
    if (!isHearingEventCategory(event.category)) continue;
    const hearingDate = hearingEventDate(event);
    if (hearingDate !== targetDate) continue;
    if (hasPreHearingBriefSent(event.remarks, event.id)) {
      skipped += 1;
      continue;
    }

    const contact = await resolveEventClientContact(accessToken, event.clientCase);
    const email = contact?.email?.trim() || "";
    if (!email || !isValidEmailAddress(email)) {
      skipped += 1;
      continue;
    }

    const preview = buildPreHearingBriefEmail({
      item: event,
      clientName: contact?.name || event.clientCase.split(/\s+—\s+/)[0]?.trim() || "Client",
      preferredGreeting: contact?.preferredGreeting,
      meetLink: resolveExistingMeetUrl(event)
    });

    await sendClientEmailViaGmail({
      accessToken,
      to: email,
      subject: preview.subject,
      html: preview.html,
      plain: preview.body,
      fromEmail: options?.fromEmail
    });

    await appendEventMarkers(accessToken, event, [preHearingBriefSentMarker(event.id)]);
    sent.push(email);
  }

  return { sent, skipped };
}
