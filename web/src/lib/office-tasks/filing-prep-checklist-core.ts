import { parseFilingPrepItemsFromDetails } from "@/lib/office-tasks/event-form-utils";
import { prepChecklistItemsForEvent } from "@/lib/office-tasks/event-prep-checklist";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import {
  createPrepChecklistState,
  parsePrepChecklistState,
  prepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";

export function filingPrepChecklistItemsForEvent(
  details: string,
  form?: Pick<EventFormInput, "category" | "categoryOther" | "pleadingType" | "pleadingCaseNature">
): string[] {
  const selected = parseFilingPrepItemsFromDetails(details);
  if (selected.length) return selected;
  if (form) return prepChecklistItemsForEvent(form as EventFormInput);
  return [];
}

export function buildFilingPrepChecklistMarker(
  details: string,
  form?: Pick<EventFormInput, "category" | "categoryOther" | "pleadingType" | "pleadingCaseNature">
): string {
  const items = filingPrepChecklistItemsForEvent(details, form);
  if (!items.length) return "";
  return prepChecklistMarker(createPrepChecklistState(items));
}

export function attachFilingPrepChecklistToRemarks(
  remarks: string,
  details: string,
  form: Pick<EventFormInput, "category" | "categoryOther" | "pleadingType" | "pleadingCaseNature">
): string {
  if (parsePrepChecklistState(remarks)) return remarks;
  const marker = buildFilingPrepChecklistMarker(details, form);
  if (!marker) return remarks;
  return appendRemarkMarkers(remarks, [marker]);
}
