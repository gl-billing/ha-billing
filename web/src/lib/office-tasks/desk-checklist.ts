import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { filterItemsForMyWork } from "@/lib/office-tasks/my-work-filter";
import {
  clientCodeFromCase,
  matterItemAnchorId,
  parseClientCaseDisplay
} from "@/lib/office-tasks/client-matter";
import {
  addDaysYmd,
  formatDisplayDate,
  getMondayOfWeekYmd,
  isWaitingOrStarted,
  normalizeOfficeStatus,
  todayYmd
} from "@/lib/office-tasks/date-only";
import { isHearingEventCategory } from "@/lib/office-tasks/event-form-utils";
import { eventVenueDisplay } from "@/lib/office-tasks/event-join-link";
import { getWaitingClientChip } from "@/lib/matter-automation";
import { matterHref } from "@/lib/matter-routes";
import { tasksHref } from "@/lib/tasks-routes";
import { isCancelledStatus, myWorkItemKindLabel, splitAssignees } from "@/lib/office-tasks/schedule";
import {
  isAppearanceOutcomeEvent,
  parseAppearanceOutcomeAction
} from "@/lib/office-tasks/appearance-outcome-shared";
import { hasPostHearingFollowUpDone } from "@/lib/office-tasks/event-item-links";

export type DeskChecklistBucket =
  | "needsOutcome"
  | "overdue"
  | "dueToday"
  | "dueThisWeek"
  | "waitingOnClient"
  | "cancelledPostponed"
  | "completed";

export type DeskChecklistOpenBucket = "needsOutcome" | "overdue" | "dueToday" | "dueThisWeek";

export type DeskChecklistInactiveBucket = "waitingOnClient" | "cancelledPostponed" | "completed";

export type DeskChecklistSection = {
  id: DeskChecklistBucket;
  title: string;
  hint: string;
  items: OfficeItem[];
};

function priorityRank(priority: string): number {
  const order = ["Urgent", "High", "Medium", "Low"];
  const i = order.indexOf(priority.trim());
  return i === -1 ? 99 : i;
}

export function deskChecklistWeekEndYmd(today = todayYmd()): string {
  const monday = getMondayOfWeekYmd(today);
  return addDaysYmd(monday, 6);
}

export function isDeskChecklistDateInScope(item: OfficeItem, weekEnd: string): boolean {
  return Boolean(item.date && item.date <= weekEnd);
}

export function deskChecklistIsWaiting(item: OfficeItem): boolean {
  return isWaitingOrStarted(item);
}

export function deskChecklistIsWaitingOnClient(
  item: OfficeItem,
  today = todayYmd(),
  escalateAfterDays = 14
): boolean {
  if (item.done || isCancelledStatus(item.status)) return false;
  const chip = getWaitingClientChip(item.status, item.remarks || "", item.date, today, escalateAfterDays);
  return chip?.label === "Waiting on client";
}

export function deskChecklistIsCancelledOrPostponed(item: OfficeItem): boolean {
  return !item.done && isCancelledStatus(item.status);
}

/** Past hearing/meeting/consultation still open with no logged outcome. */
export function deskChecklistNeedsOutcome(item: OfficeItem, today = todayYmd()): boolean {
  if (!isAppearanceOutcomeEvent(item)) return false;
  if (item.done || isCancelledStatus(item.status)) return false;
  const date = (item.eventDate || item.date || "").trim();
  if (!date || date >= today) return false;
  if (parseAppearanceOutcomeAction(item.remarks || "")) return false;
  if (item.id && hasPostHearingFollowUpDone(item.remarks || "", item.id)) return false;
  return true;
}

export function deskChecklistInactiveStatusLabel(item: OfficeItem): string {
  const status = item.status.trim();
  if (status === "Reset") return "Postponed";
  if (status === "Cancelled") return "Cancelled";
  return status || "Inactive";
}

export function classifyDeskChecklistBucket(
  item: OfficeItem,
  today: string,
  weekEnd: string
): DeskChecklistOpenBucket | null {
  if (isCancelledStatus(item.status)) return null;
  if (deskChecklistIsWaiting(item)) return null;
  if (deskChecklistNeedsOutcome(item, today)) return "needsOutcome";
  if (!item.date) return null;

  if (item.date < today) return "overdue";
  if (item.date === today) return "dueToday";
  if (item.date > today && item.date <= weekEnd) return "dueThisWeek";
  return null;
}

export function sortDeskChecklistOpenItems(a: OfficeItem, b: OfficeItem): number {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    (a.date || "").localeCompare(b.date || "") ||
    a.clientCase.localeCompare(b.clientCase)
  );
}

export function sortDeskChecklistCompletedItems(a: OfficeItem, b: OfficeItem): number {
  return (
    (b.completedDate || b.date || "").localeCompare(a.completedDate || a.date || "") ||
    a.clientCase.localeCompare(b.clientCase)
  );
}

function deskChecklistMatterGroupKey(item: OfficeItem): string {
  return item.clientCase.trim() || item.id;
}

/** Keep the original row UI — only cluster items with the same case / client label together. */
export function reorderDeskChecklistByMatter(items: OfficeItem[]): OfficeItem[] {
  const buckets = new Map<string, OfficeItem[]>();
  const order: string[] = [];

  for (const row of items) {
    const key = deskChecklistMatterGroupKey(row);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }

  return order.flatMap((key) => buckets.get(key)!);
}

export type DeskChecklistScope = "personal" | "firm";

/** All staff see the firm-wide desk checklist; use filterDeskChecklistItems personal scope only for optional "mine" toggles. */
export function resolveDeskChecklistScope(): DeskChecklistScope {
  return "firm";
}

export function filterDeskChecklistItems(
  items: OfficeItem[],
  options: {
    scope: DeskChecklistScope;
    staffName: string | null;
    roster?: string[];
  }
): OfficeItem[] {
  if (options.scope === "firm") return items;
  const name = options.staffName?.trim();
  if (!name) return [];
  return filterItemsForMyWork(items, name, options.roster ?? []);
}

export function buildDeskChecklistSections(
  items: OfficeItem[],
  today = todayYmd()
): DeskChecklistSection[] {
  const weekEnd = deskChecklistWeekEndYmd(today);
  const openBuckets: Record<DeskChecklistOpenBucket, OfficeItem[]> = {
    needsOutcome: [],
    overdue: [],
    dueToday: [],
    dueThisWeek: []
  };
  const waitingOnClient: OfficeItem[] = [];
  const cancelledPostponed: OfficeItem[] = [];
  const completed: OfficeItem[] = [];

  for (const item of items) {
    if (item.done) {
      if (!isDeskChecklistDateInScope(item, weekEnd)) continue;
      completed.push(item);
      continue;
    }

    if (deskChecklistIsCancelledOrPostponed(item)) {
      if (!isDeskChecklistDateInScope(item, weekEnd)) continue;
      cancelledPostponed.push(item);
      continue;
    }

    if (deskChecklistIsWaiting(item)) {
      waitingOnClient.push(item);
      continue;
    }

    // Past appearances needing an outcome stay visible even if older than this week.
    if (deskChecklistNeedsOutcome(item, today)) {
      openBuckets.needsOutcome.push(item);
      continue;
    }

    if (!isDeskChecklistDateInScope(item, weekEnd)) continue;

    const bucket = classifyDeskChecklistBucket(item, today, weekEnd);
    if (bucket && bucket !== "needsOutcome") openBuckets[bucket].push(item);
  }

  return [
    {
      id: "needsOutcome",
      title: "Needs outcome",
      hint: "Past hearings, meetings, or consultations — log what happened.",
      items: openBuckets.needsOutcome.sort(sortDeskChecklistOpenItems)
    },
    {
      id: "overdue",
      title: "Overdue",
      hint: "Past due — open items only.",
      items: openBuckets.overdue.sort(sortDeskChecklistOpenItems)
    },
    {
      id: "dueToday",
      title: "Due today",
      hint: "Due today, including started items.",
      items: openBuckets.dueToday.sort(sortDeskChecklistOpenItems)
    },
    {
      id: "dueThisWeek",
      title: "Due this week",
      hint: `Through ${formatDisplayDate(weekEnd, "short")}.`,
      items: openBuckets.dueThisWeek.sort(sortDeskChecklistOpenItems)
    },
    {
      id: "waitingOnClient",
      title: "Waiting",
      hint: "Open tasks and events marked Waiting or Started — any due date.",
      items: waitingOnClient.sort(sortDeskChecklistOpenItems)
    },
    {
      id: "cancelledPostponed",
      title: "Cancelled / postponed",
      hint: "Inactive this week — restore from the row menu to reopen.",
      items: cancelledPostponed.sort(sortDeskChecklistOpenItems)
    },
    {
      id: "completed",
      title: "Completed",
      hint: "Checked off this week. Uncheck to reopen.",
      items: completed.sort(sortDeskChecklistCompletedItems)
    }
  ];
}

export function deskChecklistSinceLabel(item: OfficeItem, today = todayYmd()): string {
  if (item.date && item.date < today) {
    return `Overdue since ${formatDisplayDate(item.date, "short")}`;
  }
  const since = item.date;
  if (!since) return "";
  return `Logged ${formatDisplayDate(since, "short")}`;
}

/** Primary line — case / matter caption from the clientCase label. */
export function deskChecklistCaseTitle(item: OfficeItem): string {
  const parsed = parseClientCaseDisplay(item.clientCase);
  if (parsed.subtitle) return parsed.subtitle;
  if (parsed.title !== "—") return parsed.title;
  return item.details?.trim() || item.category?.trim() || item.id;
}

/** Secondary line — client name when the label splits into client + case. */
export function deskChecklistClientName(item: OfficeItem): string {
  const parsed = parseClientCaseDisplay(item.clientCase);
  if (parsed.subtitle && parsed.title !== "—") return parsed.title;
  return "";
}

/** Task or event description — shown below client name. */
export function deskChecklistDetailLine(item: OfficeItem): string {
  return item.details?.trim() || item.nextAction?.trim() || "";
}

export function deskChecklistItemTitle(item: OfficeItem): string {
  const clientName = deskChecklistClientName(item);
  const caseTitle = deskChecklistCaseTitle(item);
  if (clientName && clientName !== caseTitle) return `${caseTitle} — ${clientName}`;
  return caseTitle;
}

export function deskChecklistMatterPageHref(item: OfficeItem): string | null {
  const code = clientCodeFromCase(item.clientCase);
  if (!code) return null;
  return matterHref(code, "tasks");
}

export function deskChecklistAssigneeLabel(item: OfficeItem): string {
  const names = splitAssignees(item.assignedTo);
  if (!names.length) return "";
  return names.join(", ");
}

function deskChecklistTimeLabel(item: OfficeItem): string {
  const start = item.startTime?.trim() || "";
  const end = item.endTime?.trim() || "";
  if (start && end && start !== end) return `${start}–${end}`;
  return start || end;
}

export type DeskChecklistMetaChip = {
  key: string;
  label: string;
  tone?: "kind" | "overdue" | "status" | "priority";
};

export type DeskChecklistMetaLine = {
  key: string;
  label: string;
  value: string;
  tone?: "overdue" | "default";
};

export type DeskChecklistMetaDisplay = {
  chips: DeskChecklistMetaChip[];
  lines: DeskChecklistMetaLine[];
};

export type DeskChecklistStatusPill = {
  key: string;
  label: string;
  tone: "urgent";
};

export function deskChecklistIsOverdue(item: OfficeItem, today = todayYmd()): boolean {
  return Boolean(item.date && item.date < today);
}

export function deskChecklistStatusPills(
  item: OfficeItem,
  options?: { inactive?: boolean }
): DeskChecklistStatusPill[] {
  if (options?.inactive) return [];
  if (item.priority !== "Urgent") return [];
  return [{ key: "urgent", label: "Urgent", tone: "urgent" }];
}

function deskChecklistKindLabel(item: OfficeItem): string {
  return myWorkItemKindLabel(item);
}

/** Checklist rows show time and venue only for scheduled appearances. */
export function deskChecklistShowsScheduleOnRow(item: OfficeItem): boolean {
  if (item.source !== "Event") return false;
  const category = String(item.category || "").trim().toLowerCase();
  if (isHearingEventCategory(item.category)) return true;
  return category === "consultation" || category === "meeting" || category === "internal meeting";
}

function deskChecklistStatusChip(item: OfficeItem, skipOverdueStatus = false): DeskChecklistMetaChip | null {
  if (deskChecklistIsCancelledOrPostponed(item)) {
    return { key: "inactive", label: deskChecklistInactiveStatusLabel(item), tone: "status" };
  }
  if (isWaitingOrStarted(item) && item.status) {
    if (skipOverdueStatus && item.status.trim().toLowerCase() === "overdue") return null;
    return { key: "status", label: item.status, tone: "status" };
  }
  return null;
}

export function deskChecklistItemMetaDisplay(item: OfficeItem, today = todayYmd()): DeskChecklistMetaDisplay {
  const chips: DeskChecklistMetaChip[] = [{ key: "kind", label: deskChecklistKindLabel(item), tone: "kind" }];
  const lines: DeskChecklistMetaLine[] = [];
  const isOverdue = deskChecklistIsOverdue(item, today);

  if (item.priority && item.priority !== "Medium" && item.priority !== "Urgent") {
    chips.push({ key: "priority", label: item.priority, tone: "priority" });
  }

  if (isOverdue) {
    chips.push({ key: "overdue", label: "Overdue", tone: "overdue" });
  }

  const statusChip = deskChecklistStatusChip(item, isOverdue);
  if (statusChip) chips.push(statusChip);

  if (item.date) {
    lines.push({
      key: "due",
      label: "Due",
      value: formatDisplayDate(item.date, "short"),
      tone: isOverdue ? "overdue" : "default"
    });
  }

  const time = deskChecklistTimeLabel(item);
  if (deskChecklistShowsScheduleOnRow(item) && time) {
    lines.push({ key: "time", label: "Time", value: time });
  }

  const venue = eventVenueDisplay(item.venue, null);
  if (deskChecklistShowsScheduleOnRow(item) && venue) {
    lines.push({ key: "venue", label: "Venue", value: venue });
  }

  const assignee = deskChecklistAssigneeLabel(item);
  if (assignee) lines.push({ key: "assignee", label: "Assigned", value: assignee });

  return { chips, lines };
}

/** Richer meta for the checklist details popup — status, schedule, and assignee. */
export function deskChecklistDialogMetaDisplay(
  item: OfficeItem,
  today = todayYmd(),
  joinUrl: string | null = null
): DeskChecklistMetaDisplay {
  const chips: DeskChecklistMetaChip[] = [{ key: "kind", label: deskChecklistKindLabel(item), tone: "kind" }];
  const lines: DeskChecklistMetaLine[] = [];
  const isOverdue = deskChecklistIsOverdue(item, today);

  if (item.priority && item.priority !== "Medium" && item.priority !== "Urgent") {
    chips.push({ key: "priority", label: item.priority, tone: "priority" });
  }

  if (isOverdue) {
    chips.push({ key: "overdue", label: "Overdue", tone: "overdue" });
  }

  const status = normalizeOfficeStatus(item.status);
  if (status && !["Open", "In Progress"].includes(status)) {
    if (!(isOverdue && status.toLowerCase() === "overdue")) {
      chips.push({ key: "status", label: status, tone: "status" });
    }
  } else {
    const statusChip = deskChecklistStatusChip(item, isOverdue);
    if (statusChip) chips.push(statusChip);
  }

  if (item.date) {
    lines.push({
      key: "due",
      label: "Due",
      value: formatDisplayDate(item.date, "short"),
      tone: isOverdue ? "overdue" : "default"
    });
  }

  const time = deskChecklistTimeLabel(item);
  if (time) lines.push({ key: "time", label: "Time", value: time });

  const venue = eventVenueDisplay(item.venue, joinUrl);
  if (venue) lines.push({ key: "venue", label: "Venue", value: venue });

  const assignee = deskChecklistAssigneeLabel(item);
  if (assignee) lines.push({ key: "assignee", label: "Assigned", value: assignee });

  const platform = item.platform?.trim();
  if (platform) lines.push({ key: "platform", label: "Platform", value: platform });

  if (!isOverdue) {
    const since = item.date;
    if (since) {
      lines.push({ key: "logged", label: "Logged", value: formatDisplayDate(since, "short") });
    }
  }

  return { chips, lines };
}

/** @deprecated Use deskChecklistItemMetaDisplay for structured UI. */
export function deskChecklistItemMeta(item: OfficeItem, today = todayYmd()): string {
  const { chips, lines } = deskChecklistItemMetaDisplay(item, today);
  const parts = [
    ...chips.map((chip) => chip.label),
    ...lines.map((line) => (line.key === "assignee" ? `Assigned to ${line.value}` : `${line.label} ${line.value}`))
  ].filter(Boolean);
  return parts.join(" · ");
}

/** @deprecated Use deskChecklistDialogMetaDisplay for structured UI. */
export function deskChecklistDialogMeta(
  item: OfficeItem,
  today = todayYmd(),
  joinUrl: string | null = null
): string {
  const { chips, lines } = deskChecklistDialogMetaDisplay(item, today, joinUrl);
  const parts = [
    ...chips.map((chip) => chip.label),
    ...lines.map((line) => (line.key === "assignee" ? `Assigned to ${line.value}` : `${line.label} ${line.value}`))
  ].filter(Boolean);
  return parts.join(" · ");
}

export function deskChecklistItemHref(
  item: OfficeItem,
  options?: { fallbackTab?: "today" | "all-items" | "calendar" }
): string {
  const code = clientCodeFromCase(item.clientCase);
  if (code) {
    const base = matterHref(code, "tasks");
    return `${base}#${matterItemAnchorId(item)}`;
  }
  return tasksHref({ tab: options?.fallbackTab || "today", q: item.id });
}
