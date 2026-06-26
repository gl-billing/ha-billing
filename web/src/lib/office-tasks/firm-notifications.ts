import { isHearingEventCategory } from "@/lib/office-tasks/event-form-utils";
import { clientCodeFromCase } from "@/lib/office-tasks/client-matter";
import { eventVenueDisplay } from "@/lib/office-tasks/event-join-link";
import { isOpenFilingEvent, isFilingDeadlineEvent } from "@/lib/office-tasks/filing-confirmation";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { parsePrepDoneNotice } from "@/lib/office-tasks/prep-completion-core";
import { isCancelledStatus } from "@/lib/office-tasks/schedule";

export type FirmNotificationKind = "birthday" | "filing-due" | "hearing-today" | "prep-ready";

export type FirmNotificationMarkFiledAction = {
  source: "Event";
  rowNumber: number;
  itemId: string;
  clientCase: string;
};

export type FirmNotification = {
  id: string;
  kind: FirmNotificationKind;
  title: string;
  subtitle: string;
  clientCode: string;
  /** Admin-only prep-ready alerts */
  adminOnly?: boolean;
  /** Present on filing notices when admin actions are enabled */
  markFiledAction?: FirmNotificationMarkFiledAction;
};

export type BirthdayNotificationClient = {
  code: string;
  name: string;
  birthdayLabel?: string;
  hasValidEmail?: boolean;
  greetingSentThisYear?: boolean;
};

function eventScheduleDate(item: OfficeItem): string {
  return (item.eventDate || item.date || "").trim();
}

function isOpenHearingToday(item: OfficeItem, today: string): boolean {
  if (item.source !== "Event" || !isHearingEventCategory(item.category)) return false;
  if (item.done || isCancelledStatus(item.status)) return false;
  const when = eventScheduleDate(item);
  return when === today;
}

function isFilingDueToday(item: OfficeItem, today: string): boolean {
  if (!isOpenFilingEvent(item) || !isFilingDeadlineEvent(item)) return false;
  const deadline = item.filingDeadline?.trim();
  return deadline === today;
}

function filingActionForEvent(item: OfficeItem): FirmNotificationMarkFiledAction | undefined {
  if (item.source !== "Event" || item.rowNumber < 2 || !item.id) return undefined;
  return {
    source: "Event",
    rowNumber: item.rowNumber,
    itemId: item.id,
    clientCase: item.clientCase || ""
  };
}

export function buildFirmNotifications(input: {
  items: OfficeItem[];
  today: string;
  birthdays?: BirthdayNotificationClient[];
  includeAdminNotices?: boolean;
  includeMarkFiledActions?: boolean;
}): FirmNotification[] {
  const {
    items,
    today,
    birthdays = [],
    includeAdminNotices = false,
    includeMarkFiledActions = false
  } = input;
  const list: FirmNotification[] = [];

  for (const client of birthdays) {
    const code = String(client.code || "").trim();
    if (!code || client.greetingSentThisYear) continue;
    list.push({
      id: `birthday-${code}`,
      kind: "birthday",
      title: client.name || code,
      subtitle: [
        "Birthday today",
        client.birthdayLabel,
        client.hasValidEmail ? "Ready to send" : "Add email to send"
      ]
        .filter(Boolean)
        .join(" · "),
      clientCode: code
    });
  }

  for (const item of items) {
    if (isFilingDueToday(item, today)) {
      const code = clientCodeFromCase(item.clientCase || "") || "APP";
      const kind = item.category?.trim() || "Filing";
      list.push({
        id: `filing-due-${item.id}`,
        kind: "filing-due",
        title: item.clientCase?.trim() || kind,
        subtitle: `${kind} due today (${today}) — confirm if this has already been submitted or filed.`,
        clientCode: code,
        markFiledAction: includeMarkFiledActions ? filingActionForEvent(item) : undefined
      });
    }

    if (isOpenHearingToday(item, today)) {
      const code = clientCodeFromCase(item.clientCase || "") || "APP";
      const time = item.startTime?.trim();
      const place = eventVenueDisplay(item.venue, null);
      list.push({
        id: `hearing-${item.id}`,
        kind: "hearing-today",
        title: item.clientCase?.trim() || "Hearing today",
        subtitle: [
          "Hearing today",
          time ? `at ${time}` : "",
          place ? `· ${place}` : ""
        ]
          .filter(Boolean)
          .join(" ")
          .replace("Hearing today  at", "Hearing today at"),
        clientCode: code
      });
    }

    if (includeAdminNotices && item.source === "Event" && isOpenFilingEvent(item)) {
      const notice = parsePrepDoneNotice(item.remarks || "");
      if (!notice) continue;
      const code = clientCodeFromCase(item.clientCase || "") || "APP";
      list.push({
        id: `prep-ready-${item.id}-${notice.dateYmd}`,
        kind: "prep-ready",
        title: item.clientCase?.trim() || item.category?.trim() || "Filing event",
        subtitle: `Prep marked done by ${notice.staffName} on ${notice.dateYmd} — confirm filing when ready.`,
        clientCode: code,
        adminOnly: true,
        markFiledAction: includeMarkFiledActions ? filingActionForEvent(item) : undefined
      });
    }
  }

  const rank: Record<FirmNotificationKind, number> = {
    birthday: 0,
    "filing-due": 1,
    "hearing-today": 2,
    "prep-ready": 3
  };

  return list.sort((a, b) => rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title));
}
