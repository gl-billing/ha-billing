import { parseTaskEventLink } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { canonicalizeStaffName, isOwnerAdminAssigneeAlias, resolveFirmOwnerAssignee } from "@/lib/staff-assignee";
import { partitionFirmOwnerItems, partitionAndreaItems } from "@/lib/office-tasks/firm-task-groups";
import { filterStaffWorkloadItems } from "@/lib/office-tasks/andrea-workload";
import { resolveAndreaAssignee } from "@/lib/office-tasks/task-assignees";
import {
  OFFICE_TIMEZONE,
  addDaysYmd,
  buildMonthGrid,
  formatDisplayDate,
  formatMonthYear,
  getMondayOfWeekYmd,
  getWeekDatesYmd,
  isPastDueOpenItem,
  isWaitingOrStarted,
  normalizeOfficeStatus,
  todayYmd,
  type CalendarCell
} from "@/lib/office-tasks/date-only";

export {
  OFFICE_TIMEZONE,
  buildMonthGrid,
  formatDisplayDate,
  formatMonthYear,
  todayYmd,
  type CalendarCell
};

/** Stable React key for a sheet row (unique per Task/Event workbook). */
export function officeItemKey(
  item: Pick<OfficeItem, "source" | "rowNumber" | "id">,
  index = 0
): string {
  if (typeof item.rowNumber === "number" && item.rowNumber >= 2) {
    return `${item.source}-${item.rowNumber}`;
  }
  const id = (item.id || "").trim();
  return id ? `${item.source}-${id}-${index}` : `${item.source}-row-${index}`;
}

export type MonthStats = {
  total: number;
  events: number;
  deadlines: number;
  tasks: number;
  overdue: number;
  done: number;
};

export type EmployeeStat = {
  name: string;
  total: number;
  open: number;
  dueToday: number;
  dueThisWeek: number;
  overdue: number;
  done: number;
  completionRate: number;
};

export function isDeadlineLike(item: Pick<OfficeItem, "category">): boolean {
  const c = item.category.toLowerCase();
  return c.includes("deadline") || c.includes("submission") || c.includes("filing");
}

export function isCancelledStatus(status: string): boolean {
  const s = status.trim();
  return s === "Cancelled" || s === "Reset";
}

export function addDays(ymd: string, days: number): string {
  return addDaysYmd(ymd, days);
}

export function getMondayOfWeek(anchorYmd: string): string {
  return getMondayOfWeekYmd(anchorYmd);
}

export function getWeekDates(weekStartMonday: string): string[] {
  return getWeekDatesYmd(weekStartMonday);
}

export function groupItemsByDate(items: OfficeItem[]): Record<string, OfficeItem[]> {
  const map: Record<string, OfficeItem[]> = {};
  items.forEach((item) => {
    if (!item.date || isCancelledStatus(item.status)) return;
    if (!map[item.date]) map[item.date] = [];
    map[item.date].push(item);
  });
  Object.keys(map).forEach((key) => sortItems(map[key]));
  return map;
}

export function sortItems(items: OfficeItem[]): void {
  items.sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      (a.date || "").localeCompare(b.date || "") ||
      a.clientCase.localeCompare(b.clientCase)
  );
}

function priorityRank(priority: string): number {
  const order = ["Urgent", "High", "Medium", "Low"];
  const i = order.indexOf(priority.trim());
  return i === -1 ? 99 : i;
}

export function getMonthStats(items: OfficeItem[], year: number, month: number, today: string): MonthStats {
  const stats: MonthStats = { total: 0, events: 0, deadlines: 0, tasks: 0, overdue: 0, done: 0 };
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  items.forEach((item) => {
    if (!item.date?.startsWith(monthPrefix) || isCancelledStatus(item.status)) return;
    stats.total++;
    if (item.done) stats.done++;
    else if (isPastDueOpenItem(item, today)) stats.overdue++;
    if (isDeadlineLike(item)) stats.deadlines++;
    else if (item.source === "Event") stats.events++;
    else stats.tasks++;
  });

  return stats;
}

export function getItemsForMonth(items: OfficeItem[], year: number, month: number): OfficeItem[] {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return items
    .filter((item) => item.date?.startsWith(monthPrefix) && !isCancelledStatus(item.status))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || priorityRank(a.priority) - priorityRank(b.priority));
}

export function getWeekPlan(items: OfficeItem[], weekDates: string[], today: string) {
  const overdue: OfficeItem[] = [];
  const byDay: OfficeItem[][] = weekDates.map(() => []);

  items.forEach((item) => {
    if (isCancelledStatus(item.status)) return;

    if (isWaitingOrStarted(item)) {
      if (item.date) {
        const idx = weekDates.indexOf(item.date);
        if (idx >= 0) byDay[idx].push(item);
      }
      return;
    }

    if (item.date) {
      const idx = weekDates.indexOf(item.date);
      if (idx >= 0) byDay[idx].push(item);
    }

    if (isPastDueOpenItem(item, today)) {
      overdue.push(item);
    }
  });

  sortItems(overdue);
  byDay.forEach(sortItems);

  return { overdue, byDay };
}

export function computeEmployeeStats(items: OfficeItem[], employeeNames: string[], today: string, weekDates: string[]): EmployeeStat[] {
  const weekSet = new Set(weekDates);
  const roster = employeeNames.filter(Boolean);
  const names = new Set<string>();

  roster.forEach((name) => names.add(canonicalizeStaffName(name, roster)));
  items.forEach((item) => {
    splitAssignees(item.assignedTo).forEach((n) => names.add(canonicalizeStaffName(n, roster)));
  });

  return Array.from(names)
    .filter(Boolean)
    .filter((name) => {
      const owner = resolveFirmOwnerAssignee(roster);
      return !(owner && isOwnerAdminAssigneeAlias(name));
    })
    .sort()
    .map((name) => {
      const assigned = filterStaffWorkloadItems(name, items, roster);
      let total = 0;
      let open = 0;
      let dueToday = 0;
      let dueThisWeek = 0;
      let overdue = 0;
      let done = 0;

      assigned.forEach((item) => {
        total++;
        if (item.done || item.status === "Done" || item.status === "Submitted") {
          done++;
        } else {
          open++;
          if (item.date) {
            if (isPastDueOpenItem(item, today)) overdue++;
            if (item.date === today) dueToday++;
            if (weekSet.has(item.date)) dueThisWeek++;
          }
        }
      });

      return {
        name,
        total,
        open,
        dueToday,
        dueThisWeek,
        overdue,
        done,
        completionRate: total ? Math.round((done / total) * 100) : 0
      };
    });
}

export function itemTone(
  item: OfficeItem,
  today?: string
): "overdue" | "deadline" | "event" | "task" | "started" | "waiting" | "done" | "cancelled" {
  if (isCancelledStatus(item.status)) return "cancelled";
  const status = normalizeOfficeStatus(item.status);
  if (item.done || status === "Done" || status === "Submitted") return "done";
  if (isWaitingOrStarted(item)) return status === "Started" ? "started" : "waiting";
  const todayKey = today || todayYmd();
  if (status === "Overdue" || isPastDueOpenItem(item, todayKey)) return "overdue";
  if (isDeadlineLike(item)) return "deadline";
  if (item.source === "Event") return "event";
  return "task";
}

export function toneClass(tone: ReturnType<typeof itemTone>): string {
  switch (tone) {
    case "overdue":
      return "item-tone item-tone--overdue";
    case "deadline":
      return "item-tone item-tone--deadline";
    case "event":
      return "item-tone item-tone--event";
    case "done":
      return "item-tone item-tone--done";
    case "cancelled":
      return "item-tone item-tone--cancelled";
    case "started":
      return "item-tone item-tone--started";
    case "waiting":
      return "item-tone item-tone--waiting";
    default:
      return "item-tone item-tone--task";
  }
}

export function toneDotClass(tone: ReturnType<typeof itemTone>): string {
  return `tone-dot tone-dot--${tone}`;
}

export function shortCalendarLabel(item: OfficeItem): string {
  if (isDeadlineLike(item)) return "Deadline";
  if (item.source === "Event") return item.category || "Event";
  return "Task";
}

function isFilingPrepReminderTask(item: Pick<OfficeItem, "source" | "category" | "remarks" | "details">): boolean {
  if (item.source !== "Task") return false;
  if (parseTaskEventLink(item.remarks || "")?.kind === "reminder") return true;
  const cat = String(item.category || "").trim().toLowerCase();
  if (cat === "filing prep" || cat === "other — drafting" || cat === "drafting") return true;
  const text = `${item.details || ""} ${item.remarks || ""}`.toLowerCase();
  return text.includes("filing prep for") || text.includes("prep checklist for");
}

/** Human-readable kind for My work list rows — Hearing, Meeting, Task, Filing, etc. */
export function myWorkItemKindLabel(
  item: Pick<OfficeItem, "source" | "category" | "remarks" | "details">
): string {
  if (isFilingPrepReminderTask(item)) return "Filing prep";

  const cat = String(item.category || "").trim();
  if (isDeadlineLike(item)) {
    if (cat && !/deadline|submission/i.test(cat)) return cat;
    return "Filing";
  }
  if (item.source === "Event") return cat || "Event";
  if (cat) return cat;
  return "Task";
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

export function splitAssignees(value: string): string[] {
  return String(value || "")
    .split(/[,;]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

export function itemHasAssignee(item: OfficeItem, name: string, roster: string[] = []): boolean {
  const target = roster.length
    ? canonicalizeStaffName(name, roster).trim().toLowerCase()
    : name.trim().toLowerCase();
  return splitAssignees(item.assignedTo).some((a) => {
    const assignee = roster.length
      ? canonicalizeStaffName(a, roster).trim().toLowerCase()
      : a.trim().toLowerCase();
    return assignee === target;
  });
}

export function isItemOpen(item: OfficeItem): boolean {
  return (
    !item.done &&
    item.status !== "Done" &&
    item.status !== "Submitted" &&
    !isCancelledStatus(item.status)
  );
}

export type EmployeeItemGroups = {
  all: OfficeItem[];
  open: OfficeItem[];
  dueToday: OfficeItem[];
  dueThisWeek: OfficeItem[];
  overdue: OfficeItem[];
  done: OfficeItem[];
};

export type FirmOwnerEmployeeView = {
  client: EmployeeItemGroups;
  taxCompliance: EmployeeItemGroups | null;
  adminTasks: EmployeeItemGroups | null;
};

export type AndreaEmployeeView = {
  client: EmployeeItemGroups;
  operations: EmployeeItemGroups | null;
};

function buildEmployeeItemGroupsFromList(
  all: OfficeItem[],
  today: string,
  weekDates: string[]
): EmployeeItemGroups {
  const weekSet = new Set(weekDates);
  const open: OfficeItem[] = [];
  const dueToday: OfficeItem[] = [];
  const dueThisWeek: OfficeItem[] = [];
  const overdue: OfficeItem[] = [];
  const done: OfficeItem[] = [];

  all.forEach((item) => {
    if (!isItemOpen(item)) {
      done.push(item);
      return;
    }
    open.push(item);
    if (isWaitingOrStarted(item)) {
      dueToday.push(item);
      if (item.date && weekSet.has(item.date)) dueThisWeek.push(item);
      return;
    }
    if (!item.date) return;
    if (isPastDueOpenItem(item, today)) overdue.push(item);
    if (item.date === today) dueToday.push(item);
    if (weekSet.has(item.date)) dueThisWeek.push(item);
  });

  const sort = (list: OfficeItem[]) => {
    list.sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        priorityRank(a.priority) - priorityRank(b.priority) ||
        a.clientCase.localeCompare(b.clientCase)
    );
  };

  sort(open);
  sort(dueToday);
  sort(dueThisWeek);
  sort(overdue);
  done.sort(
    (a, b) =>
      (b.date || "").localeCompare(a.date || "") || a.clientCase.localeCompare(b.clientCase)
  );
  all.sort(
    (a, b) =>
      (isItemOpen(a) ? 0 : 1) - (isItemOpen(b) ? 0 : 1) ||
      (a.date || "").localeCompare(b.date || "") ||
      a.clientCase.localeCompare(b.clientCase)
  );

  return { all, open, dueToday, dueThisWeek, overdue, done };
}

export function getEmployeeItemGroups(
  name: string,
  items: OfficeItem[],
  today: string,
  weekDates: string[],
  roster: string[] = []
): EmployeeItemGroups {
  const all = filterStaffWorkloadItems(name, items, roster);
  return buildEmployeeItemGroupsFromList(all, today, weekDates);
}

export type TeamEmployeeView = {
  client: EmployeeItemGroups;
  taxCompliance: EmployeeItemGroups | null;
  adminTasks: EmployeeItemGroups | null;
  operations: EmployeeItemGroups | null;
};

/** Split team workload — owner tax/admin buckets and Andrea billing ops. */
export function getTeamEmployeeView(
  name: string,
  items: OfficeItem[],
  today: string,
  weekDates: string[],
  roster: string[] = []
): TeamEmployeeView {
  const all = filterStaffWorkloadItems(name, items, roster);
  const owner = resolveFirmOwnerAssignee(roster);
  const isOwner = Boolean(
    owner && canonicalizeStaffName(name, roster).trim().toLowerCase() === owner.trim().toLowerCase()
  );
  const andrea = resolveAndreaAssignee(roster);
  const isAndrea = canonicalizeStaffName(name, roster).trim().toLowerCase() === andrea.trim().toLowerCase();

  if (isOwner) {
    const buckets = partitionFirmOwnerItems(all);
    return {
      client: buildEmployeeItemGroupsFromList(buckets.clientMatters, today, weekDates),
      taxCompliance: buildEmployeeItemGroupsFromList(buckets.taxCompliance, today, weekDates),
      adminTasks: buildEmployeeItemGroupsFromList(buckets.adminTasks, today, weekDates),
      operations: null
    };
  }

  if (isAndrea) {
    const buckets = partitionAndreaItems(all);
    return {
      client: buildEmployeeItemGroupsFromList(buckets.clientMatters, today, weekDates),
      taxCompliance: null,
      adminTasks: null,
      operations: buildEmployeeItemGroupsFromList(buckets.operations, today, weekDates)
    };
  }

  return {
    client: buildEmployeeItemGroupsFromList(all, today, weekDates),
    taxCompliance: null,
    adminTasks: null,
    operations: null
  };
}

/** @deprecated Use getTeamEmployeeView */
export function getFirmOwnerEmployeeView(
  name: string,
  items: OfficeItem[],
  today: string,
  weekDates: string[],
  roster: string[] = []
): FirmOwnerEmployeeView {
  const view = getTeamEmployeeView(name, items, today, weekDates, roster);
  return {
    client: view.client,
    taxCompliance: view.taxCompliance,
    adminTasks: view.adminTasks
  };
}

export type DayItemBuckets = {
  overdue: OfficeItem[];
  events: OfficeItem[];
  deadlines: OfficeItem[];
  tasks: OfficeItem[];
  done: OfficeItem[];
};

export function bucketItemsForDay(items: OfficeItem[], date: string, today: string): DayItemBuckets {
  const buckets: DayItemBuckets = { overdue: [], events: [], deadlines: [], tasks: [], done: [] };

  items.forEach((item) => {
    if (isCancelledStatus(item.status)) return;
    const done = item.done || item.status === "Done" || item.status === "Submitted";

    if (done) {
      buckets.done.push(item);
      return;
    }

    if (item.date && item.date < today && isPastDueOpenItem(item, today)) {
      buckets.overdue.push(item);
      return;
    }

    if (isDeadlineLike(item)) buckets.deadlines.push(item);
    else if (item.source === "Event") buckets.events.push(item);
    else buckets.tasks.push(item);
  });

  Object.values(buckets).forEach((list) =>
    list.sort(
      (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.clientCase.localeCompare(b.clientCase)
    )
  );

  return buckets;
}

export function printView(title: string) {
  if (typeof document !== "undefined") {
    document.title = title;
  }
  window.print();
}
