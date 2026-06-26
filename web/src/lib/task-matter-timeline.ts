import type { ActivityItem } from "@/lib/gl-config";
import {
  clientCaseMatchesBillingClient,
  clientCodeFromCase,
  groupItemsByClientCode,
  matterItemAnchorId,
  type MatterClientContext
} from "@/lib/office-tasks/client-matter";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";

function toSortKey(value: string): number {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function itemDate(item: OfficeItem): string {
  return item.date || item.eventDate || item.filingDeadline || "";
}

function officeItemToActivity(item: OfficeItem): ActivityItem {
  const isEvent = item.source === "Event";
  const date = itemDate(item) || "—";
  const kind = isEvent ? "hearing" : "task";

  return {
    id: `${kind}-${item.sheetName}-${item.rowNumber}`,
    date,
    sortKey: toSortKey(date),
    kind,
    title: item.details?.trim() || item.clientCase || (isEvent ? "Hearing / event" : "Task"),
    subtitle: [item.clientCase, isEvent ? item.venue : item.assignedTo, item.status]
      .filter(Boolean)
      .join(" · "),
    status: item.status || undefined,
    matterAnchor: matterItemAnchorId(item)
  };
}

function taskActivityToItem(entry: TaskActivityEntry): ActivityItem {
  return {
    id: `task-action-${entry.logRow}`,
    date: entry.timestamp,
    sortKey: toSortKey(entry.timestamp),
    kind: "task-action",
    title: entry.summary || entry.action,
    subtitle: [entry.user, entry.source, entry.clientCase].filter(Boolean).join(" · "),
    status: entry.action
  };
}

function matchesClientCode(clientCase: string, clientCode: string): boolean {
  const upper = clientCode.trim().toUpperCase();
  if (!clientCase.trim() || !upper) return false;
  const fromCase = clientCodeFromCase(clientCase);
  if (fromCase === upper) return true;
  if (upper.length > 3 && fromCase === upper.slice(0, 3)) return true;
  if (fromCase.length > 3 && upper === fromCase.slice(0, 3)) return true;
  return false;
}

/** Merge billing activity with tasks / hearings / staff actions (client-safe — no Google APIs). */
export function mergeTaskTimelineItems(
  clientCode: string,
  billingItems: ActivityItem[],
  options?: {
    taskItems?: OfficeItem[];
    taskActivity?: TaskActivityEntry[];
    /** Tasks sheet prefix (3 letters from case name) — may differ from billing Master List code. */
    taskGroupCode?: string;
    clientContext?: MatterClientContext | null;
  }
): ActivityItem[] {
  const items: ActivityItem[] = [...billingItems];
  const taskCode = (options?.taskGroupCode || clientCode).trim().toUpperCase();
  const clientContext = options?.clientContext ?? null;

  if (options?.taskItems?.length) {
    const grouped = groupItemsByClientCode(options.taskItems, clientCode, taskCode, clientContext);
    for (const task of grouped.tasks) items.push(officeItemToActivity(task));
    for (const event of grouped.events) items.push(officeItemToActivity(event));
  }

  if (options?.taskActivity?.length) {
    for (const entry of options.taskActivity) {
      if (clientContext) {
        if (!clientCaseMatchesBillingClient(entry.clientCase, clientContext)) continue;
      } else if (!matchesClientCode(entry.clientCase, taskCode)) {
        continue;
      }
      items.push(taskActivityToItem(entry));
    }
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.sortKey - a.sortKey);
}

/** Tasks / hearings / staff actions only — for matter popup when billing is unavailable. */
export function getTaskMatterTimeline(
  clientCode: string,
  options?: {
    taskItems?: OfficeItem[];
    taskActivity?: TaskActivityEntry[];
  }
): ActivityItem[] {
  return mergeTaskTimelineItems(clientCode, [], options);
}
