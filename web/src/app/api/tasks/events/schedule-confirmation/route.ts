import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { createGoogleMeetLinkForItem, resolveExistingMeetUrl } from "@/lib/calendar/meet-link";
import { buildPersistedEventJoinFields } from "@/lib/office-tasks/event-join-link";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { getSheetValues, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import {
  getGmailAccountEmail,
  isValidEmailAddress,
  sendClientEmailViaGmail,
  sentMailHint
} from "@/lib/office-tasks/gmail-send";
import {
  buildScheduleConfirmationEmailPreview,
  isScheduleConfirmationEvent,
  shouldAutoCreateMeetLink,
  type ScheduleConfirmationEmailInput
} from "@/lib/office-tasks/schedule-confirmation";
import { parseContactEmails } from "@/lib/contact-emails";
import { resolveEventClientContact } from "@/lib/office-tasks/resolve-event-client-contact";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { SHEETS } from "@/lib/tasks-config";

type Body = {
  action?: "preview" | "send";
  source?: string;
  rowNumber?: number;
  itemId?: string;
  recipientEmail?: string;
  recipientEmails?: string[];
  customNote?: string;
  createMeetLink?: boolean;
  draft?: {
    source?: string;
    category?: string;
    platform?: string;
    clientCase?: string;
    eventDate?: string | null;
    date?: string;
    startTime?: string | null;
    endTime?: string | null;
    venue?: string;
    details?: string;
    assignedTo?: string;
  };
};

function draftToScheduleItem(body: Body) {
  const draft = body.draft;
  if (!draft) return null;
  const item = {
    source: "Event" as const,
    category: String(draft.category || ""),
    platform: String(draft.platform || ""),
    clientCase: String(draft.clientCase || ""),
    eventDate: draft.eventDate ?? draft.date ?? null,
    date: String(draft.date || draft.eventDate || ""),
    startTime: draft.startTime ?? null,
    endTime: draft.endTime ?? null,
    venue: String(draft.venue || ""),
    details: String(draft.details || ""),
    assignedTo: String(draft.assignedTo || "")
  };
  if (!isScheduleConfirmationEvent(item)) {
    throw new Error(
      "Schedule confirmation email is available for meetings, consultations, client calls, and internal meetings."
    );
  }
  return item;
}

function resolveRecipientEmails(body: Body, fallbackEmail: string): string[] {
  const fromList = Array.isArray(body.recipientEmails)
    ? body.recipientEmails.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const single = String(body.recipientEmail || "").trim();
  const merged = fromList.length
    ? fromList
    : single
      ? [single]
      : parseContactEmails(fallbackEmail);
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const email of merged) {
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(email);
  }
  return resolved;
}

function appendScheduleConfirmationRemark(remarks: string, recipients: string[]): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `[Schedule confirmed ${stamp} → ${recipients.join(", ")}]`;
  const base = String(remarks || "").trim();
  if (base.includes(line)) return base;
  return base ? `${base}\n${line}` : line;
}

async function loadEventItem(token: string, body: Body) {
  const draftItem = draftToScheduleItem(body);
  if (draftItem) {
    if (body.action === "send") {
      throw new Error("Save the event before sending the schedule confirmation email.");
    }
    return draftItem;
  }

  const items = await collectAllItems(token);
  const rowNumber = Number(body.rowNumber);
  const itemId = String(body.itemId || "").trim();

  const item =
    (rowNumber >= 2
      ? items.find((row) => row.source === "Event" && row.rowNumber === rowNumber)
      : null) ||
    (itemId ? items.find((row) => row.source === "Event" && row.id === itemId) : null);

  if (!item || item.source !== "Event") {
    throw new Error("Event not found.");
  }
  if (!isScheduleConfirmationEvent(item)) {
    throw new Error(
      "Schedule confirmation email is available for meetings, consultations, client calls, and internal meetings."
    );
  }
  return item;
}

async function persistEventJoinLink(
  token: string,
  item: OfficeItem,
  meetLink: string
): Promise<{ venue: string; details: string } | null> {
  if (!meetLink.trim() || item.rowNumber < 2) return null;
  if (resolveExistingMeetUrl(item)) return null;

  const next = buildPersistedEventJoinFields(item, meetLink);
  if (next.venue !== (item.venue?.trim() || "")) {
    await updateSheetValues(token, toA1Range(SHEETS.events, `J${item.rowNumber}`), [[next.venue]]);
  }
  if (next.details !== (item.details?.trim() || "")) {
    await updateSheetValues(token, toA1Range(SHEETS.events, `K${item.rowNumber}`), [[next.details]]);
  }
  return next;
}

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as Body;
    const action = body.action || "preview";

    const item = await loadEventItem(token, body);
    const contact = await resolveEventClientContact(token, item.clientCase);
    const recipientEmails = resolveRecipientEmails(body, contact?.email || "");
    const recipientEmail = recipientEmails[0] || "";
    const clientName = contact?.name || item.clientCase.split(/\s+—\s+/)[0]?.trim() || "Client";

    let meetLink: string | null = resolveExistingMeetUrl(item as Pick<OfficeItem, "venue" | "details" | "platform">);
    const wantsMeetLink = body.createMeetLink !== false;
    const savedRowNumber = "rowNumber" in item ? item.rowNumber : Number(body.rowNumber) || 0;

    if (
      wantsMeetLink &&
      shouldAutoCreateMeetLink(item.platform) &&
      !meetLink &&
      savedRowNumber >= 2 &&
      "rowNumber" in item
    ) {
      const created = await createGoogleMeetLinkForItem(token, item as OfficeItem);
      meetLink = created.meetLink;
      invalidateTasksDataCache(token);
    }

    const email = buildScheduleConfirmationEmailPreview({
      item: item as ScheduleConfirmationEmailInput["item"],
      clientName,
      preferredGreeting: contact?.preferredGreeting,
      meetLink,
      customNote: body.customNote
    });

    if (action === "preview") {
      return NextResponse.json({
        subject: email.subject,
        body: email.body,
        html: email.html,
        recipientEmail,
        recipientEmails,
        recipientName: clientName,
        meetLink,
        hasValidRecipient: recipientEmails.some((email) => isValidEmailAddress(email)),
        platform: item.platform,
        category: item.category
      });
    }

    const validRecipients = recipientEmails.filter((email) => isValidEmailAddress(email));
    if (!validRecipients.length) {
      return NextResponse.json({ error: "Add at least one valid client email before sending." }, { status: 400 });
    }

    if (!("rowNumber" in item) || item.rowNumber < 2 || !("id" in item)) {
      return NextResponse.json({ error: "Save the event before sending the schedule confirmation email." }, { status: 400 });
    }

    const savedItem = item as OfficeItem;
    let persistedVenue = savedItem.venue;
    let persistedDetails = savedItem.details;

    if (meetLink) {
      const persisted = await persistEventJoinLink(token, savedItem, meetLink);
      if (persisted) {
        persistedVenue = persisted.venue;
        persistedDetails = persisted.details;
      }
    }

    const bccEmail = await getGmailAccountEmail(token, session?.user?.email || undefined);
    for (const to of validRecipients) {
      await sendClientEmailViaGmail({
        accessToken: token,
        to,
        subject: email.subject,
        html: email.html,
        plain: email.body,
        bcc: bccEmail
      });
    }

    const remarksRange = toA1Range(SHEETS.events, `R${savedItem.rowNumber}`);
    const rows = await getSheetValues(token, remarksRange);
    const currentRemarks = String(rows[0]?.[0] ?? "");
    await updateSheetValues(token, remarksRange, [[appendScheduleConfirmationRemark(currentRemarks, validRecipients)]]);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "email",
      source: "Event",
      itemId: savedItem.id,
      summary: `Schedule confirmation sent to ${validRecipients.join(", ")}`
    }).catch(() => undefined);

    invalidateTasksDataCache(token);

    const message =
      validRecipients.length === 1
        ? sentMailHint(bccEmail || "Gmail", validRecipients[0], "sent", true)
        : `Schedule confirmation sent to ${validRecipients.length} recipients (${validRecipients.join(", ")}).`;

    return NextResponse.json({
      ok: true,
      message,
      recipientEmail: validRecipients[0],
      recipientEmails: validRecipients,
      meetLink,
      venue: persistedVenue,
      details: persistedDetails
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare schedule confirmation email.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Gmail")
        ? 403
        : message.includes("not found") || message.includes("available for")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
