import {
  isConsultationEventCategory,
  isHearingEventCategory,
  isMeetingEventCategory
} from "@/lib/office-tasks/event-form-utils";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { addDaysYmd, isPastDueOpenItem, isWaitingOrStarted } from "@/lib/office-tasks/date-only";
import { isCancelledStatus, isDeadlineLike } from "@/lib/office-tasks/schedule";

export const MOBILE_OFFICE_VIEWS = [
  "schedule",
  "tasks",
  "filing",
  "meeting",
  "notifications"
] as const;

export type MobileOfficeView = (typeof MOBILE_OFFICE_VIEWS)[number];

export const MOBILE_OFFICE_VIEW_TITLES: Record<MobileOfficeView, string> = {
  schedule: "Schedule",
  tasks: "Tasks",
  filing: "Filing Deadline",
  meeting: "Client Meeting",
  notifications: "Notifications"
};

export type MobileOfficeLists = {
  schedule: OfficeItem[];
  hearings: OfficeItem[];
  tasksDue: OfficeItem[];
  overdue: OfficeItem[];
  filing: OfficeItem[];
  approachingFiling: OfficeItem[];
  meeting: OfficeItem[];
  nextMeeting: OfficeItem | null;
};

export function parseMobileOfficeView(raw: string | null | undefined): MobileOfficeView | null {
  const value = String(raw || "").trim();
  return (MOBILE_OFFICE_VIEWS as readonly string[]).includes(value) ? (value as MobileOfficeView) : null;
}

export function mobileHomeTaskRows(lists: MobileOfficeLists, includeOverdue: boolean): OfficeItem[] {
  if (!includeOverdue || lists.overdue.length === 0) return lists.tasksDue;
  const seen = new Set(lists.tasksDue.map((row) => row.id));
  return [...lists.tasksDue, ...lists.overdue.filter((row) => !seen.has(row.id))];
}

export function itemsForMobileOfficeView(lists: MobileOfficeLists, view: MobileOfficeView): OfficeItem[] {
  if (view === "schedule") return lists.schedule;
  if (view === "tasks") return lists.tasksDue;
  if (view === "filing") return lists.filing;
  if (view === "meeting") return lists.meeting;
  return [];
}

export function mobileOfficeEmptyCopy(view: Exclude<MobileOfficeView, "notifications">, dayIsToday: boolean): string {
  if (view === "schedule") {
    return dayIsToday ? "No events scheduled for today." : "No events scheduled for this day.";
  }
  if (view === "tasks") {
    return dayIsToday ? "No tasks due today." : "No tasks due this day.";
  }
  if (view === "filing") {
    return dayIsToday ? "No filing deadlines for today." : "No filing deadlines for this day.";
  }
  return dayIsToday ? "No client meetings scheduled for today." : "No client meetings scheduled for this day.";
}

/** Home card destination: empty/list for 0 or many rows, the record itself when there is exactly one. */
export function mobileOfficeCardHref(
  homeHref: string,
  view: MobileOfficeView,
  rows: OfficeItem[],
  day: string | null
): string {
  if (view === "notifications") {
    return withSearchParams(homeHref, { mo: null, moItem: null, moFrom: null, day });
  }
  if (rows.length === 1 && rows[0]?.id) {
    return withSearchParams(homeHref, { mo: view, moItem: rows[0].id, moFrom: "card", day });
  }
  return withSearchParams(homeHref, { mo: view, moItem: null, moFrom: null, day });
}

export function mobileOfficeItemHref(
  homeHref: string,
  view: MobileOfficeView,
  itemId: string,
  day: string | null
): string {
  return withSearchParams(homeHref, { mo: view, moItem: itemId, moFrom: "list", day });
}

export function mobileOfficeBackHref(homeHref: string, search = ""): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const day = params.get("day")?.trim() || null;
  const view = parseMobileOfficeView(params.get("mo"));
  const itemId = params.get("moItem")?.trim() || "";
  const fromCard = params.get("moFrom") === "card";
  const tab = (params.get("tab") || "").trim().toLowerCase();
  if (tab === "add-task" || tab === "add-event") {
    return withSearchParams(homeHref, { mo: null, moItem: null, moFrom: null, day, tab: "desk-checklist" });
  }
  if (itemId && view && !fromCard) {
    return withSearchParams(homeHref, { mo: view, moItem: null, moFrom: null, day });
  }
  return withSearchParams(homeHref, { mo: null, moItem: null, moFrom: null, day });
}

export function mobileOfficeAfterTaskHref(
  homeHref: string,
  selectedDay: string,
  dueDate: string,
  createdTaskId: string
): string {
  if (createdTaskId && dueDate && dueDate === selectedDay) {
    return withSearchParams(homeHref, {
      mo: "tasks",
      moItem: createdTaskId,
      moFrom: "card",
      day: selectedDay
    });
  }
  return withSearchParams(homeHref, { mo: null, moItem: null, moFrom: null, day: selectedDay });
}

export function withSearchParams(href: string, extra: Record<string, string | null | undefined>): string {
  const url = new URL(href, "https://ha.local");
  for (const [key, value] of Object.entries(extra)) {
    const next = String(value || "").trim();
    if (next) url.searchParams.set(key, next);
    else url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function itemScheduleDate(item: OfficeItem): string {
  if (isDeadlineLike(item)) return (item.filingDeadline || item.date || "").trim();
  return (item.eventDate || item.date || "").trim();
}

export function isClientMeetingLike(item: OfficeItem): boolean {
  if (item.source !== "Event" || isDeadlineLike(item)) return false;
  return isMeetingEventCategory(item.category) || isConsultationEventCategory(item.category);
}

export function mobileOfficeItemTitle(item: OfficeItem): string {
  return item.clientCase.trim() || item.details.trim() || item.category.trim() || item.source;
}

export function shortenHearingLabel(item: OfficeItem, max = 52): string {
  const venue = item.venue.trim();
  const matter = item.clientCase.trim();
  const text = [venue, matter].filter(Boolean).join(" · ") || mobileOfficeItemTitle(item);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function mobileOfficeItemSubtitle(item: OfficeItem): string {
  return [item.startTime, item.venue, item.category, item.assignedTo]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function isOpenWork(item: OfficeItem): boolean {
  if (item.done || isCancelledStatus(item.status) || isWaitingOrStarted(item)) return false;
  return true;
}

function byTimeThenTitle(a: OfficeItem, b: OfficeItem): number {
  const time = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
  if (time !== 0) return time;
  return mobileOfficeItemTitle(a).localeCompare(mobileOfficeItemTitle(b));
}

function upcomingFrom(items: OfficeItem[], selectedDate: string, predicate: (item: OfficeItem) => boolean): OfficeItem | null {
  return (
    items
      .filter((item) => isOpenWork(item) && predicate(item) && itemScheduleDate(item) >= selectedDate)
      .sort((a, b) => itemScheduleDate(a).localeCompare(itemScheduleDate(b)) || byTimeThenTitle(a, b))[0] || null
  );
}

export type MobileOfficeTimelineKind = "hearing" | "meeting" | "filing" | "task";

export function mobileOfficeTimelineKind(item: OfficeItem): MobileOfficeTimelineKind {
  if (item.source === "Task") return "task";
  if (isDeadlineLike(item)) return "filing";
  if (isHearingEventCategory(item.category)) return "hearing";
  return "meeting";
}

export function buildMobileOfficeTimeline(items: OfficeItem[], selectedDate: string, today: string): OfficeItem[] {
  const lists = buildMobileOfficeLists(items, selectedDate, today);
  const map = new Map<string, OfficeItem>();
  for (const row of [...lists.schedule, ...lists.filing, ...lists.tasksDue]) {
    map.set(row.id, row);
  }
  return [...map.values()].sort(byTimeThenTitle);
}

export function buildMobileOfficeLists(
  items: OfficeItem[],
  selectedDate: string,
  today: string
): MobileOfficeLists {
  const open = items.filter(isOpenWork);
  const onDay = open.filter((item) => itemScheduleDate(item) === selectedDate);

  const schedule = onDay.filter((item) => item.source === "Event" && !isDeadlineLike(item)).sort(byTimeThenTitle);
  const hearings = schedule.filter((item) => isHearingEventCategory(item.category));
  const tasksDue = onDay.filter((item) => item.source === "Task").sort(byTimeThenTitle);
  const overdue =
    selectedDate === today
      ? open.filter((item) => isPastDueOpenItem(item, today)).sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      : [];
  const filing = onDay.filter(isDeadlineLike).sort(byTimeThenTitle);
  const horizon = addDaysYmd(selectedDate, 7);
  const approachingFiling = open
    .filter((item) => {
      if (!isDeadlineLike(item)) return false;
      const when = itemScheduleDate(item);
      return when >= selectedDate && when <= horizon;
    })
    .sort((a, b) => itemScheduleDate(a).localeCompare(itemScheduleDate(b)) || byTimeThenTitle(a, b));
  const meeting = onDay.filter(isClientMeetingLike).sort(byTimeThenTitle);
  const nextMeeting = meeting[0] || upcomingFrom(open, selectedDate, isClientMeetingLike);

  return { schedule, hearings, tasksDue, overdue, filing, approachingFiling, meeting, nextMeeting };
}
