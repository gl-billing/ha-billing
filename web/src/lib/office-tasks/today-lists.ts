import type { OfficeItem, TodayCounts } from "@/lib/office-tasks/item-types";
import { addDaysYmd, getMondayOfWeekYmd, isPastDueOpenItem, isWaitingOrStarted, todayYmd } from "@/lib/office-tasks/date-only";

function isCancelled(status: string): boolean {
  const s = status.trim();
  return s === "Cancelled" || s === "Reset";
}

function isDeadlineLike(item: Pick<OfficeItem, "category">): boolean {
  const c = item.category.toLowerCase();
  return c.includes("deadline") || c.includes("submission") || c.includes("filing");
}

function priorityRank(priority: string): number {
  const order = ["Urgent", "High", "Medium", "Low"];
  const i = order.indexOf(priority.trim());
  return i === -1 ? 99 : i;
}

function endOfWeekYmd(today: string): string {
  return addDaysYmd(getMondayOfWeekYmd(today), 6);
}

export function computeTodayCounts(items: OfficeItem[]): TodayCounts {
  const today = todayYmd();
  const weekEnd = endOfWeekYmd(today);
  const counts: TodayCounts = {
    tasksDueToday: 0,
    eventsToday: 0,
    deadlinesToday: 0,
    overdueOpen: 0,
    dueThisWeek: 0,
    waitingAndStarted: 0,
    completedToday: 0
  };

  items.forEach((item) => {
    if (item.completedDate === today) {
      counts.completedToday++;
    }

    if (isCancelled(item.status)) return;

    if (isWaitingOrStarted(item)) {
      counts.waitingAndStarted++;
      return;
    }

    if (!item.date || item.done) return;

    if (isPastDueOpenItem(item, today)) {
      counts.overdueOpen++;
      return;
    }

    if (item.date !== today) {
      if (item.date > today && item.date <= weekEnd) {
        counts.dueThisWeek++;
      }
      return;
    }

    if (isDeadlineLike(item)) {
      counts.deadlinesToday++;
    } else if (item.source === "Event") {
      counts.eventsToday++;
    } else {
      counts.tasksDueToday++;
    }
  });

  return counts;
}

export function filterTodayLists(items: OfficeItem[]) {
  const today = todayYmd();
  const weekEnd = endOfWeekYmd(today);
  const overdue: OfficeItem[] = [];
  const eventsToday: OfficeItem[] = [];
  const deadlinesToday: OfficeItem[] = [];
  const tasksDueToday: OfficeItem[] = [];
  const dueThisWeek: OfficeItem[] = [];
  const waitingAndStarted: OfficeItem[] = [];
  const doneToday: OfficeItem[] = [];

  items.forEach((item) => {
    if (item.completedDate === today) {
      doneToday.push(item);
    }
    if (isCancelled(item.status)) return;

    if (isWaitingOrStarted(item)) {
      waitingAndStarted.push(item);
      return;
    }

    if (!item.date) return;
    if (item.done) return;

    if (isPastDueOpenItem(item, today)) {
      overdue.push(item);
      return;
    }

    if (item.date === today) {
      if (isDeadlineLike(item)) {
        deadlinesToday.push(item);
      } else if (item.source === "Event") {
        eventsToday.push(item);
      } else {
        tasksDueToday.push(item);
      }
      return;
    }

    if (item.date > today && item.date <= weekEnd) {
      dueThisWeek.push(item);
    }
  });

  const sort = (a: OfficeItem, b: OfficeItem) =>
    (a.date || "").localeCompare(b.date || "") ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.clientCase.localeCompare(b.clientCase);

  return {
    overdue: overdue.sort(sort),
    eventsToday: eventsToday.sort(sort),
    deadlinesToday: deadlinesToday.sort(sort),
    tasksDueToday: tasksDueToday.sort(sort),
    dueThisWeek: dueThisWeek.sort(sort),
    waitingAndStarted: waitingAndStarted.sort(sort),
    doneToday: doneToday.sort(sort)
  };
}

/** Open items due after today (within horizon) — filings, hearings, tasks scheduled ahead. */
export function filterUpcomingWorkItems(items: OfficeItem[], today: string, horizonDays = 90): OfficeItem[] {
  const horizon = addDaysYmd(today, horizonDays);
  const upcoming: OfficeItem[] = [];

  items.forEach((item) => {
    if (isCancelled(item.status) || item.done) return;
    if (isWaitingOrStarted(item)) return;
    if (!item.date || item.date <= today) return;
    if (item.date > horizon) return;
    upcoming.push(item);
  });

  const sort = (a: OfficeItem, b: OfficeItem) =>
    (a.date || "").localeCompare(b.date || "") ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.clientCase.localeCompare(b.clientCase);

  return upcoming.sort(sort);
}
