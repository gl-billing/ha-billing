import { isHearingEventCategory } from "@/lib/office-tasks/event-form-utils";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { buildHearingPrepChecklistMarker } from "@/lib/office-tasks/hearing-prep-checklist-core";
import {
  nextActionForPrepChecklist,
  parsePrepChecklistState
} from "@/lib/office-tasks/prep-checklist-storage";
import { SHEETS } from "@/lib/tasks-config";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";

export {
  attachHearingPrepChecklistToRemarks,
  buildHearingPrepChecklistMarker,
  hearingPrepChecklistItemsForEvent
} from "@/lib/office-tasks/hearing-prep-checklist-core";

/** Add interactive PREP_CHECKLIST to a hearing event row. */
export async function initializeHearingPrepChecklistOnEvent(
  accessToken: string,
  event: OfficeItem
): Promise<{ eventId: string; total: number }> {
  if (event.source !== "Event" || event.rowNumber < 2) {
    throw new Error("Valid hearing event row is required.");
  }
  if (!isHearingEventCategory(event.category)) {
    throw new Error("Only hearing events can have a hearing prep checklist.");
  }
  if (parsePrepChecklistState(event.remarks || "")) {
    throw new Error("Interactive hearing prep checklist already exists on this event.");
  }

  const marker = buildHearingPrepChecklistMarker(event.details || "");
  const state = parsePrepChecklistState(marker);
  if (!state) throw new Error("Could not build hearing prep checklist.");

  const nextRemarks = appendRemarkMarkers(event.remarks || "", [marker]);
  const nextAction = nextActionForPrepChecklist(state);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(SHEETS.events, `R${event.rowNumber}`), values: [[nextRemarks]] },
    { range: toA1Range(SHEETS.events, `M${event.rowNumber}`), values: [[nextAction]] },
    { range: toA1Range(SHEETS.events, `V${event.rowNumber}`), values: [[now]] }
  ]);

  return { eventId: event.id, total: state.items.length };
}
