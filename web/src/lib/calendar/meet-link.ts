import { google } from "googleapis";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { resolveEventJoinUrl } from "@/lib/office-tasks/event-join-link";
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

/** Reuse an existing join URL from venue/details when present. */
export function resolveExistingMeetUrl(item: Pick<OfficeItem, "venue" | "details" | "platform">): string | null {
  return resolveEventJoinUrl(item);
}

function readMeetLinkFromEvent(event: {
  hangoutLink?: string | null;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null } | null;
}): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video");
  return video?.uri || null;
}

/** Create or refresh a Google Calendar event with a Google Meet link. */
export async function createGoogleMeetLinkForItem(
  accessToken: string,
  item: OfficeItem
): Promise<{ meetLink: string; calendarEventId?: string }> {
  if (!item.date) {
    throw new Error("This event needs a date before a Google Meet link can be created.");
  }

  const existing = resolveExistingMeetUrl(item);
  if (existing && /meet\.google\.com/i.test(existing)) {
    return { meetLink: existing, calendarEventId: item.calendarEventId || undefined };
  }

  const calendar = getCalendarClient(accessToken);
  const calId = calendarId();
  const { start, end } = buildCalendarEventStartEnd(item.date, item.startTime, item.endTime);
  const requestId = `gl-meet-${item.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}`;

  const body = {
    summary: `[GL] ${item.category}: ${item.clientCase || item.id}`.slice(0, 200),
    description: [item.details, item.nextAction ? `Next: ${item.nextAction}` : "", `Sheet ID: ${item.id}`]
      .filter(Boolean)
      .join("\n"),
    location: item.venue || undefined,
    start,
    end,
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" }
      }
    }
  };

  let calendarEventId = item.calendarEventId?.trim() || "";
  let eventResponse;

  try {
    if (calendarEventId) {
      eventResponse = await calendar.events.patch({
        calendarId: calId,
        eventId: calendarEventId,
        conferenceDataVersion: 1,
        requestBody: body
      });
    } else {
      eventResponse = await calendar.events.insert({
        calendarId: calId,
        conferenceDataVersion: 1,
        requestBody: body
      });
      calendarEventId = eventResponse.data.id || "";
    }
  } catch (error) {
    throw new Error(formatCalendarApiError(error));
  }

  const meetLink = readMeetLinkFromEvent(eventResponse.data);
  if (!meetLink) {
    throw new Error("Google Calendar did not return a Meet link. Try again or paste a Meet URL in Venue.");
  }

  if (calendarEventId && calendarEventId !== item.calendarEventId) {
    await batchUpdateSheetValues(accessToken, [
      {
        range: toA1Range(item.sheetName, `U${item.rowNumber}`),
        values: [[calendarEventId]]
      }
    ]);
  }

  return { meetLink, calendarEventId: calendarEventId || undefined };
}
