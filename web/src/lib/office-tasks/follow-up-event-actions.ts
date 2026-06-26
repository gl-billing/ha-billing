import { parseTaskEventLink } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

/** Resolve the parent filing event for a court/submission/deadline follow-up task. */
export function resolveFollowUpParentEvent(task: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  if (task.source !== "Task") return null;
  const link = parseTaskEventLink(task.remarks || "");
  if (!link || link.kind !== "followUp") return null;
  return items.find((item) => item.source === "Event" && item.id === link.eventId) || null;
}

export function isEventFollowUpTask(task: Pick<OfficeItem, "source" | "remarks">): boolean {
  if (task.source !== "Task") return false;
  return parseTaskEventLink(task.remarks || "")?.kind === "followUp";
}
