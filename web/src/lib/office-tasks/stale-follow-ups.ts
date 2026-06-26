import { isWaitingOrStarted } from "@/lib/office-tasks/date-only";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { todayYmd } from "@/lib/office-tasks/schedule";

export const STALE_FOLLOW_UP_DAYS = 7;

function daysSinceYmd(fromYmd: string, today: string): number {
  const from = new Date(`${fromYmd}T12:00:00`);
  const to = new Date(`${today}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Open Waiting/Started items with no sheet update for at least N days. */
export function getStaleFollowUpItems(
  items: OfficeItem[],
  today = todayYmd(),
  minDays = STALE_FOLLOW_UP_DAYS
): OfficeItem[] {
  return items
    .filter((item) => !item.done && isWaitingOrStarted(item))
    .filter((item) => {
      const anchor = item.lastUpdated || item.date;
      if (!anchor) return false;
      return daysSinceYmd(anchor, today) >= minDays;
    })
    .sort(
      (a, b) =>
        (a.lastUpdated || a.date || "").localeCompare(b.lastUpdated || b.date || "") ||
        a.clientCase.localeCompare(b.clientCase)
    );
}

export function staleFollowUpsForAssignee(
  items: OfficeItem[],
  assignee: string,
  today = todayYmd(),
  minDays = STALE_FOLLOW_UP_DAYS
): OfficeItem[] {
  const name = assignee.trim().toLowerCase();
  if (!name) return [];
  return getStaleFollowUpItems(items, today, minDays).filter(
    (item) => item.assignedTo.trim().toLowerCase() === name
  );
}
