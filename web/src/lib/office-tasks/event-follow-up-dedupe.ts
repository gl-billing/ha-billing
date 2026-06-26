import {
  eventFollowUpMarker,
  eventReminderMarker,
  parseEventTaskLinks,
  parseTaskEventLink,
  taskConfirmsEventLink
} from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isItemOpen } from "@/lib/office-tasks/schedule";

export type EventLinkedTaskKind = "followUp" | "reminder";

function markerForKind(eventId: string, kind: EventLinkedTaskKind): string {
  return (kind === "followUp" ? eventFollowUpMarker : eventReminderMarker)(eventId).toUpperCase();
}

/** True when an open follow-up or prep reminder already exists for this event. */
export function hasOpenEventLinkedTask(
  items: OfficeItem[],
  eventId: string,
  kind: EventLinkedTaskKind
): boolean {
  const marker = markerForKind(eventId, kind);

  if (
    items.some(
      (item) =>
        item.source === "Task" && isItemOpen(item) && item.remarks.toUpperCase().includes(marker)
    )
  ) {
    return true;
  }

  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event) return false;

  const links = parseEventTaskLinks(event.remarks);
  const linkedId = kind === "followUp" ? links.followUpTaskId : links.reminderTaskId;
  if (!linkedId) return false;

  const linked = items.find((item) => item.id === linkedId);
  return Boolean(
    linked && isItemOpen(linked) && taskConfirmsEventLink(linked.remarks || "", eventId, kind)
  );
}

function openTasksForEventKind(
  items: OfficeItem[],
  eventId: string,
  kind: EventLinkedTaskKind
): OfficeItem[] {
  const marker = markerForKind(eventId, kind);
  return items.filter(
    (item) =>
      item.source === "Task" &&
      isItemOpen(item) &&
      item.remarks.toUpperCase().includes(marker)
  );
}

/** When multiple open linked tasks exist for one event, keep one and close the rest. */
export function duplicateEventLinkedTasksToClose(items: OfficeItem[]): OfficeItem[] {
  const eventsById = new Map(
    items.filter((item) => item.source === "Event").map((event) => [event.id, event])
  );
  const grouped = new Map<string, OfficeItem[]>();

  for (const item of items) {
    if (item.source !== "Task" || !isItemOpen(item)) continue;
    const link = parseTaskEventLink(item.remarks);
    if (!link) continue;
    const key = `${link.eventId}:${link.kind}`;
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }

  const toClose: OfficeItem[] = [];

  for (const [key, tasks] of grouped) {
    if (tasks.length <= 1) continue;
    const [eventId, kind] = key.split(":") as [string, EventLinkedTaskKind];
    const event = eventsById.get(eventId);
    const links = parseEventTaskLinks(event?.remarks || "");
    const preferredId = kind === "followUp" ? links.followUpTaskId : links.reminderTaskId;
    const keep =
      (preferredId && tasks.find((task) => task.id === preferredId)) ||
      [...tasks].sort((a, b) =>
        (b.lastUpdated || b.date || "").localeCompare(a.lastUpdated || a.date || "")
      )[0];
    toClose.push(...tasks.filter((task) => task.id !== keep.id));
  }

  // Also collapse marker matches even if parseTaskEventLink failed on older rows.
  for (const event of eventsById.values()) {
    for (const kind of ["followUp", "reminder"] as const) {
      const matches = openTasksForEventKind(items, event.id, kind);
      if (matches.length <= 1) continue;
      const links = parseEventTaskLinks(event.remarks);
      const preferredId = kind === "followUp" ? links.followUpTaskId : links.reminderTaskId;
      const keep =
        (preferredId && matches.find((task) => task.id === preferredId)) ||
        [...matches].sort((a, b) =>
          (b.lastUpdated || b.date || "").localeCompare(a.lastUpdated || a.date || "")
        )[0];
      for (const task of matches) {
        if (task.id !== keep.id && !toClose.some((row) => row.id === task.id)) {
          toClose.push(task);
        }
      }
    }
  }

  return toClose;
}
