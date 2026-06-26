import { isHearingEventCategory } from "@/lib/office-tasks/event-form-utils";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

/** Client-safe API route helpers — no Google Sheets imports. */
export function prepChecklistInitializeUrl(item: Pick<OfficeItem, "source" | "category">): string {
  if (item.source === "Event" && isHearingEventCategory(item.category)) {
    return "/api/tasks/events/hearing-prep";
  }
  if (item.source === "Task") return "/api/tasks/items/prep-checklist/initialize";
  return "/api/tasks/events/prep-reminder";
}

export function prepChecklistCreateUrl(item: Pick<OfficeItem, "source" | "category">): string {
  if (item.source === "Event" && isHearingEventCategory(item.category)) {
    return "/api/tasks/events/hearing-prep";
  }
  return "/api/tasks/events/prep-reminder";
}
