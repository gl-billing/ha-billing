import {
  HEARING_PREP_ITEMS,
  parseHearingPrepItemsFromDetails
} from "@/lib/office-tasks/event-form-utils";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import {
  createPrepChecklistState,
  parsePrepChecklistState,
  prepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";

export function hearingPrepChecklistItemsForEvent(details: string): string[] {
  const selected = parseHearingPrepItemsFromDetails(details);
  if (selected.length) return selected;
  return [...HEARING_PREP_ITEMS];
}

export function buildHearingPrepChecklistMarker(details: string): string {
  const items = hearingPrepChecklistItemsForEvent(details);
  return prepChecklistMarker(createPrepChecklistState(items));
}

export function attachHearingPrepChecklistToRemarks(remarks: string, details: string): string {
  if (parsePrepChecklistState(remarks)) return remarks;
  return appendRemarkMarkers(remarks, [buildHearingPrepChecklistMarker(details)]);
}
