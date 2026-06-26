import { isOpenHearingEvent, hearingPrepChecklistTitle, isHearingEventCategory } from "@/lib/office-tasks/event-form-utils";
import { isOpenFilingEvent } from "@/lib/office-tasks/filing-confirmation";
import { parseEventTaskLinks } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { looksLikePrepReminderTask } from "@/lib/office-tasks/prep-task-event-link";
import { parsePrepChecklistState, prepChecklistProgress } from "@/lib/office-tasks/prep-checklist-storage";

function hasPrepChecklist(remarks: string): boolean {
  return Boolean(parsePrepChecklistState(remarks));
}

function isLegacyPrepReminderTask(item: Pick<OfficeItem, "source" | "remarks" | "details" | "category">): boolean {
  return looksLikePrepReminderTask(item);
}

export function isHearingChecklistEvent(item: Pick<OfficeItem, "source" | "category" | "remarks">): boolean {
  return item.source === "Event" && isHearingEventCategory(item.category) && hasPrepChecklist(item.remarks || "");
}

/** Prep task row that exists but still needs interactive checklist data in Remarks. */
export function resolvePrepChecklistInitTarget(item: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  if (item.source === "Task") {
    if (hasPrepChecklist(item.remarks || "") || item.done) return null;
    return item;
  }

  if (item.source === "Event" && isHearingEventCategory(item.category) && isOpenHearingEvent(item)) {
    if (!hasPrepChecklist(item.remarks || "")) return item;
    return null;
  }

  if (item.source === "Event") {
    const { reminderTaskId } = parseEventTaskLinks(item.remarks || "");
    if (!reminderTaskId) return null;
    const task = items.find((row) => row.source === "Task" && row.id === reminderTaskId);
    if (task && isLegacyPrepReminderTask(task) && !hasPrepChecklist(task.remarks || "")) return task;
  }

  return null;
}

/** Row that stores the interactive prep checklist (may differ from the card being viewed). */
export function resolvePrepChecklistHost(item: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  if (item.source === "Task" && hasPrepChecklist(item.remarks || "")) {
    return item;
  }

  if (item.source === "Event") {
    if (hasPrepChecklist(item.remarks || "")) return item;

    const { reminderTaskId } = parseEventTaskLinks(item.remarks || "");
    if (!reminderTaskId) return null;
    const task = items.find((row) => row.source === "Task" && row.id === reminderTaskId);
    if (task && hasPrepChecklist(task.remarks || "")) return task;
  }

  return null;
}

export function canOfferPrepChecklistCreation(
  item: Pick<OfficeItem, "source" | "remarks" | "category" | "filingDeadline" | "status" | "done">
): boolean {
  if (item.source === "Event" && isHearingEventCategory(item.category) && isOpenHearingEvent(item)) {
    return !hasPrepChecklist(item.remarks || "");
  }

  if (item.source !== "Event") return false;
  if (!isOpenFilingEvent(item)) return false;
  const { reminderTaskId } = parseEventTaskLinks(item.remarks || "");
  return !reminderTaskId;
}

export function prepChecklistProgressLabel(remarks: string): string | null {
  const state = parsePrepChecklistState(remarks);
  if (!state) return null;
  const { done, total } = prepChecklistProgress(state);
  if (done >= total) return null;
  return `Prep ${done}/${total}`;
}

export function prepChecklistIncompleteForItem(
  item: Pick<OfficeItem, "source" | "category" | "remarks" | "done" | "status">,
  allItems: OfficeItem[]
): string | null {
  if (item.done) return null;
  const host = resolvePrepChecklistHost(item as OfficeItem, allItems);
  if (!host) {
    if (item.source === "Event" && isHearingEventCategory(item.category) && isOpenHearingEvent(item)) {
      return "Prep needed";
    }
    return null;
  }
  return prepChecklistProgressLabel(host.remarks || "");
}

export function prepChecklistTitleForItem(item: Pick<OfficeItem, "category" | "source">): string {
  if (item.source === "Event" && isHearingEventCategory(item.category)) {
    return hearingPrepChecklistTitle(item.category);
  }
  if (item.source === "Task") {
    return "Task prep checklist";
  }
  return "Filing prep checklist";
}
