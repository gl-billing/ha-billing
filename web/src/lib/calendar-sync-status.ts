import { isCancelledStatus } from "@/lib/office-tasks/schedule";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

export type CalendarSyncSummary = {
  flaggedOpen: number;
  syncedOpen: number;
  needsAttention: number;
  tone: "ok" | "warn" | "muted";
  message: string;
};

export function summarizeCalendarSync(items: OfficeItem[]): CalendarSyncSummary {
  let flaggedOpen = 0;
  let syncedOpen = 0;
  let needsAttention = 0;

  for (const item of items) {
    if (!item.calendarSync || item.done || isCancelledStatus(item.status)) continue;
    flaggedOpen++;
    if (item.calendarEventId?.trim()) syncedOpen++;
    else needsAttention++;
  }

  if (flaggedOpen === 0) {
    return {
      flaggedOpen,
      syncedOpen,
      needsAttention,
      tone: "muted",
      message: "Calendar sync — no open items flagged for Google Calendar."
    };
  }

  if (needsAttention > 0) {
    return {
      flaggedOpen,
      syncedOpen,
      needsAttention,
      tone: "warn",
      message: `Calendar sync — ${syncedOpen} linked, ${needsAttention} need attention (sync on but no event ID).`
    };
  }

  return {
    flaggedOpen,
    syncedOpen,
    needsAttention,
    tone: "ok",
    message: `Calendar sync — ${syncedOpen} open item${syncedOpen === 1 ? "" : "s"} linked to Google Calendar.`
  };
}
