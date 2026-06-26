import type { OfficeItem } from "@/lib/office-tasks/sheets/items";
import { getEmployeeItemGroups } from "@/lib/office-tasks/schedule";

export type ReminderScope = "daily" | "overdue" | "both";

/** Daily-only reminders still include overdue when any exist — overdue must not be hidden. */
export function effectiveReminderScope(scope: ReminderScope, overdueCount: number): ReminderScope {
  if (scope === "daily" && overdueCount > 0) return "both";
  return scope;
}

export type ReminderPreview = {
  assignee: string;
  email: string;
  dueToday: number;
  overdue: number;
  canSend: boolean;
  missingEmail: boolean;
};

export function buildReminderPreview(
  assignee: string,
  email: string,
  items: OfficeItem[],
  today: string,
  weekDates: string[],
  roster: string[] = []
): ReminderPreview {
  const groups = getEmployeeItemGroups(assignee, items, today, weekDates, roster);
  return {
    assignee,
    email,
    dueToday: groups.dueToday.length,
    overdue: groups.overdue.length,
    canSend: Boolean(email?.trim()),
    missingEmail: !email?.trim()
  };
}

export function scopeLabel(scope: ReminderScope): string {
  switch (scope) {
    case "daily":
      return "Due today";
    case "overdue":
      return "Overdue";
    default:
      return "Today + overdue";
  }
}
