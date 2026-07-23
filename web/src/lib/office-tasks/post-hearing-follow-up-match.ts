import {
  parsePostHearingEventId,
  postHearingFollowUpMarker
} from "@/lib/office-tasks/event-item-links";
import { isHearingItem } from "@/lib/hearing-escalation";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

/** Tasks linked to a hearing's post-hearing follow-up (marker or legacy description match). */
export function postHearingFollowUpTasksForEvent(items: OfficeItem[], event: OfficeItem): OfficeItem[] {
  const marker = postHearingFollowUpMarker(event.id).toUpperCase();
  const byMarker = items.filter(
    (item) => item.source === "Task" && String(item.remarks || "").toUpperCase().includes(marker)
  );
  if (byMarker.length) return byMarker;

  const eventSnippet = event.details.trim().slice(0, 40).toLowerCase();
  if (!eventSnippet) return [];

  return items.filter((item) => {
    if (item.source !== "Task") return false;
    if ((item.category || "").trim() !== "Court Follow-up") return false;
    const details = String(item.details || "").toLowerCase();
    if (!details.includes("post-hearing")) return false;
    if (item.clientCase.trim().toUpperCase() !== event.clientCase.trim().toUpperCase()) return false;
    return details.includes(eventSnippet.slice(0, Math.min(24, eventSnippet.length)));
  });
}

export function hasPostHearingFollowUpTask(items: OfficeItem[], eventId: string): boolean {
  const marker = postHearingFollowUpMarker(eventId).toUpperCase();
  return items.some(
    (item) => item.source === "Task" && String(item.remarks || "").toUpperCase().includes(marker)
  );
}

/** Resolve hearing event id from task markers or post-hearing description match. */
export function resolvePostHearingEventId(
  task: Pick<OfficeItem, "remarks" | "clientCase" | "details" | "category">,
  items: OfficeItem[]
): string | null {
  const fromRemarks = parsePostHearingEventId(task.remarks || "");
  if (fromRemarks) return fromRemarks;

  if ((task.category || "").trim() !== "Court Follow-up") return null;
  const details = String(task.details || "").toLowerCase();
  if (!details.includes("post-hearing")) return null;

  const client = task.clientCase.trim().toUpperCase();
  for (const event of items) {
    if (event.source !== "Event" || !isHearingItem(event)) continue;
    if (event.clientCase.trim().toUpperCase() !== client) continue;
    const snippet = event.details.trim().slice(0, 40).toLowerCase();
    if (!snippet) continue;
    if (details.includes(snippet.slice(0, Math.min(24, snippet.length)))) return event.id;
  }

  return null;
}
