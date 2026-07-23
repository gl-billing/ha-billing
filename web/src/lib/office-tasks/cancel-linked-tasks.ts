import "server-only";

import {
  courtConfirmTaskMarker,
  eventFollowUpMarker,
  eventReminderMarker,
  parseCourtConfirmEventId,
  parseEventTaskLinks,
  parsePostHearingEventId,
  parseTaskEventLink
} from "@/lib/office-tasks/event-item-links";
import { isPreparationTask } from "@/lib/office-tasks/prep-completion-core";
import { resolvePrepTaskForEvent } from "@/lib/office-tasks/prep-task-event-link";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { setItemStatus } from "@/lib/office-tasks/sheets/complete";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { isCancelledStatus } from "@/lib/office-tasks/schedule";

function taskLinkedToEvent(task: OfficeItem, eventId: string): boolean {
  if (task.source !== "Task" || task.done || isCancelledStatus(task.status)) return false;
  const remarks = task.remarks || "";
  const upper = remarks.toUpperCase();
  const link = parseTaskEventLink(remarks);
  if (link?.eventId === eventId) return true;
  if (upper.includes(courtConfirmTaskMarker(eventId).toUpperCase())) return true;
  if (upper.includes(eventFollowUpMarker(eventId).toUpperCase())) return true;
  if (upper.includes(eventReminderMarker(eventId).toUpperCase())) return true;
  if (parseCourtConfirmEventId(remarks) === eventId) return true;
  if (parsePostHearingEventId(remarks) === eventId) return true;
  return false;
}

function linkedTasksForEvent(event: OfficeItem, items: OfficeItem[]): OfficeItem[] {
  const matches = new Map<string, OfficeItem>();
  const links = parseEventTaskLinks(event.remarks || "");

  for (const taskId of [links.followUpTaskId, links.reminderTaskId, links.courtConfirmTaskId]) {
    if (!taskId) continue;
    const task = items.find((item) => item.source === "Task" && item.id === taskId);
    if (task && !task.done && !isCancelledStatus(task.status)) {
      matches.set(task.id, task);
    }
  }

  const prep = resolvePrepTaskForEvent(event, items);
  if (prep && !prep.done && !isCancelledStatus(prep.status)) {
    matches.set(prep.id, prep);
  }

  for (const item of items) {
    if (item.source !== "Task" || !taskLinkedToEvent(item, event.id)) continue;
    if (item.done || isCancelledStatus(item.status)) continue;
    matches.set(item.id, item);
  }

  for (const item of items) {
    if (item.source !== "Task" || item.done || isCancelledStatus(item.status)) continue;
    if (!isPreparationTask(item)) continue;
    if (!item.clientCase.trim() || item.clientCase !== event.clientCase) continue;
    if (item.remarks.toUpperCase().includes(eventReminderMarker(event.id).toUpperCase())) {
      matches.set(item.id, item);
    }
  }

  return [...matches.values()];
}

/** Cancel open tasks linked to a cancelled hearing or event. */
export async function cancelLinkedTasksForEvent(
  accessToken: string,
  eventId: string,
  eventRowNumber: number
): Promise<number> {
  const items = await collectAllItems(accessToken);
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event) {
    const byRow = items.find((item) => item.source === "Event" && item.rowNumber === eventRowNumber);
    if (!byRow) return 0;
    return cancelLinkedTasksForEvent(accessToken, byRow.id, eventRowNumber);
  }

  const toCancel = linkedTasksForEvent(event, items);
  for (const task of toCancel) {
    await setItemStatus(accessToken, "Task", task.rowNumber, "Cancelled", {
      note: `Auto-cancelled — parent event ${eventId} was cancelled.`
    });
  }
  return toCancel.length;
}
