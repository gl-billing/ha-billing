import { formatDisplayDate } from "@/lib/office-tasks/date-only";
import { myWorkItemKindLabel } from "@/lib/office-tasks/schedule";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

export type MyWorkShareLists = {
  overdue: OfficeItem[];
  eventsToday: OfficeItem[];
  deadlinesToday: OfficeItem[];
  tasksDueToday: OfficeItem[];
  waitingAndStarted: OfficeItem[];
  doneToday: OfficeItem[];
};

function formatShareLine(item: OfficeItem): string {
  const kind = myWorkItemKindLabel(item);
  const detail = (item.details?.trim() || item.nextAction?.trim() || "—").replace(/\s+/g, " ");
  const meta = [item.date, item.startTime, item.assignedTo?.trim(), item.status?.trim()]
    .filter(Boolean)
    .join(" · ");
  return meta ? `${kind} · ${item.clientCase} — ${detail} (${meta})` : `${kind} · ${item.clientCase} — ${detail}`;
}

function section(title: string, items: OfficeItem[]): string[] {
  if (!items.length) return [];
  return [title, ...items.map((item, index) => `${index + 1}. ${formatShareLine(item)}`), ""];
}

export function formatMyWorkListText(options: {
  today: string;
  scopeLabel: string;
  lists: MyWorkShareLists;
}): string {
  const { today, scopeLabel, lists } = options;
  const lines = [
    `HA Office — My work`,
    formatDisplayDate(today),
    scopeLabel,
    ""
  ];

  lines.push(...section("Due first", lists.overdue));
  lines.push(...section("Due today — hearings", lists.eventsToday));
  lines.push(...section("Due today — filing deadlines", lists.deadlinesToday));
  lines.push(...section("Due today — tasks", lists.tasksDueToday));
  lines.push(...section("Waiting / started", lists.waitingAndStarted));
  lines.push(...section("Completed today", lists.doneToday));

  const openCount =
    lists.overdue.length +
    lists.eventsToday.length +
    lists.deadlinesToday.length +
    lists.tasksDueToday.length +
    lists.waitingAndStarted.length;

  lines.push(`Open items: ${openCount} · Done today: ${lists.doneToday.length}`);

  return lines.join("\n").trim();
}
