import { google } from "googleapis";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { buildCalendarEventStartEnd, formatCalendarApiError } from "@/lib/calendar/event-datetime";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";
}

function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

function eventTitle(item: OfficeItem): string {
  const prefix = item.source === "Task" ? "Task" : item.category || "Event";
  return `[GL] ${prefix}: ${item.clientCase || item.id}`.slice(0, 200);
}

function eventDescription(item: OfficeItem): string {
  return [
    item.details,
    item.nextAction ? `Next: ${item.nextAction}` : "",
    item.assignedTo ? `Assigned: ${item.assignedTo}` : "",
    `Sheet ID: ${item.id}`
  ]
    .filter(Boolean)
    .join("\n");
}

export async function pushItemToCalendar(accessToken: string, item: OfficeItem): Promise<string> {
  if (!item.date) throw new Error("Item has no date for calendar sync.");
  const calendar = getCalendarClient(accessToken);
  const calId = calendarId();
  const { start, end } = buildCalendarEventStartEnd(item.date, item.startTime, item.endTime);

  const body = {
    summary: eventTitle(item),
    description: eventDescription(item),
    location: item.venue || undefined,
    start,
    end
  };

  try {
    if (item.calendarEventId) {
      const updated = await calendar.events.patch({
        calendarId: calId,
        eventId: item.calendarEventId,
        requestBody: body
      });
      return updated.data.id || item.calendarEventId;
    }

    const created = await calendar.events.insert({
      calendarId: calId,
      requestBody: body
    });
    const eventId = created.data.id;
    if (!eventId) throw new Error("Calendar API did not return an event ID.");

    const col = item.source === "Task" ? "Q" : "U";
    await batchUpdateSheetValues(accessToken, [
      {
        range: toA1Range(item.sheetName, `${col}${item.rowNumber}`),
        values: [[eventId]]
      }
    ]);

    return eventId;
  } catch (error) {
    throw new Error(formatCalendarApiError(error));
  }
}

export async function pullCalendarChanges(
  accessToken: string,
  items: OfficeItem[],
  updatedMin?: string
): Promise<{ updated: number; cancelled: number }> {
  const calendar = getCalendarClient(accessToken);
  const calId = calendarId();
  const min = updatedMin || new Date(Date.now() - 7 * 86_400_000).toISOString();

  const list = await calendar.events.list({
    calendarId: calId,
    updatedMin: min,
    singleEvents: true,
    maxResults: 100,
    q: "[GL]"
  });

  const events = list.data.items || [];
  const byId = new Map(items.filter((i) => i.calendarEventId).map((i) => [i.calendarEventId, i]));
  const updates: Array<{ range: string; values: unknown[][] }> = [];
  let updated = 0;
  let cancelled = 0;

  for (const event of events) {
    const id = event.id;
    if (!id) continue;
    const item = byId.get(id);
    if (!item) continue;

    if (event.status === "cancelled") {
      const statusCol = item.source === "Task" ? "K" : "N";
      updates.push({
        range: toA1Range(item.sheetName, `${statusCol}${item.rowNumber}`),
        values: [["Cancelled"]]
      });
      cancelled++;
      continue;
    }

    const start = event.start?.dateTime || event.start?.date;
    if (!start) continue;
    const dateYmd = start.slice(0, 10);
    const dateCol = item.source === "Task" ? "C" : item.filingDeadline ? "Q" : "C";
    updates.push({
      range: toA1Range(item.sheetName, `${dateCol}${item.rowNumber}`),
      values: [[dateYmd]]
    });
    updated++;
  }

  if (updates.length) {
    await batchUpdateSheetValues(accessToken, updates);
  }

  return { updated, cancelled };
}

export async function syncOpenItemsToCalendar(
  accessToken: string,
  items: OfficeItem[],
  options?: { upcomingOnly?: boolean; todayYmd?: string }
): Promise<{ pushed: number; errors: string[] }> {
  const today = options?.todayYmd || new Date().toISOString().slice(0, 10);
  let pushed = 0;
  const errors: string[] = [];

  for (const item of items) {
    if (!item.calendarSync || item.done || !item.date) continue;
    if (options?.upcomingOnly && item.date < today) continue;
    try {
      await pushItemToCalendar(accessToken, item);
      pushed++;
    } catch (error) {
      errors.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { pushed, errors };
}

export function calendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_ID?.trim() || true);
}
