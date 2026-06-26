import { parseClientCaseDisplay } from "@/lib/office-tasks/client-case-identity";
import { isPleadingCategory } from "@/lib/office-tasks/event-form-utils";
import { parsePrepAssignee } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { matterItemAnchorId } from "@/lib/office-tasks/client-matter";
import {
  looksLikePrepReminderTask,
  resolveFilingEventForPrepTask,
  resolvePrepTaskForEvent
} from "@/lib/office-tasks/prep-task-event-link";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import { shouldShowPrepLinkForViewer } from "@/lib/office-tasks/prep-workload-view";

export type EventPrepLinkNote = {
  text: string;
  linkLabel: string;
  anchorId: string;
};

function formatClientLabel(clientCase: string): string {
  const { title, subtitle } = parseClientCaseDisplay(clientCase);
  if (subtitle) return `${title} — ${subtitle}`;
  return title || clientCase.trim() || "this matter";
}

export function eventHasLinkedPrepTask(event: OfficeItem, items: OfficeItem[]): boolean {
  if (event.source !== "Event" || !isPleadingCategory(event.category)) return false;
  return Boolean(resolvePrepTaskForEvent(event, items) || parsePrepAssignee(event.remarks));
}

export function buildEventPrepLinkNote(
  item: OfficeItem,
  items: OfficeItem[],
  role: PrepWorkloadViewRole = "neutral"
): EventPrepLinkNote | null {
  if (!shouldShowPrepLinkForViewer(item, items, role)) return null;

  if (item.source === "Task" && looksLikePrepReminderTask(item)) {
    const event = resolveFilingEventForPrepTask(item, items);
    if (!event || !isPleadingCategory(event.category)) return null;
    return {
      text: `Connected to ${event.category} for ${formatClientLabel(item.clientCase || event.clientCase)}.`,
      linkLabel: "View court filing",
      anchorId: matterItemAnchorId(event)
    };
  }

  if (item.source === "Event" && isPleadingCategory(item.category)) {
    const prep = resolvePrepTaskForEvent(item, items);
    if (!prep) return null;
    const assignees = prep.assignedTo?.trim() || parsePrepAssignee(item.remarks) || "prep staff";
    return {
      text: `Case prep assigned to ${assignees}.`,
      linkLabel: "View prep task",
      anchorId: matterItemAnchorId(prep)
    };
  }

  return null;
}

export function shouldHideItemFromStaffWorkload(
  _item: OfficeItem,
  _staffName: string,
  _items: OfficeItem[],
  _roster: string[] = []
): boolean {
  return false;
}

export function applyStaffWorkloadDedup(
  list: OfficeItem[],
  _staffName: string,
  _allItems: OfficeItem[],
  _roster: string[] = []
): OfficeItem[] {
  return list;
}
