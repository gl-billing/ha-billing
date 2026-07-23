import { isPleadingCategory, normalizeEventFormInput } from "@/lib/office-tasks/event-form-utils";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { eventFormInputFromOfficeItem } from "@/lib/office-tasks/prep-checklist-server";
import { buildFilingPrepChecklistMarker } from "@/lib/office-tasks/filing-prep-checklist-core";
import {
  nextActionForPrepChecklist,
  parsePrepChecklistState
} from "@/lib/office-tasks/prep-checklist-storage";
import { SHEETS } from "@/lib/tasks-config";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";

/** Add interactive filing prep checklist to a pleading event row (no separate task). */
export async function initializeFilingPrepChecklistOnEvent(
  accessToken: string,
  event: OfficeItem
): Promise<{ eventId: string; total: number }> {
  if (event.source !== "Event" || event.rowNumber < 2) {
    throw new Error("Valid filing event row is required.");
  }

  const form = normalizeEventFormInput(eventFormInputFromOfficeItem(event));
  if (!isPleadingCategory(form.category)) {
    throw new Error("Only filing / pleading events can have a filing prep checklist.");
  }
  if (parsePrepChecklistState(event.remarks || "")) {
    throw new Error("Interactive filing prep checklist already exists on this event.");
  }

  const marker = buildFilingPrepChecklistMarker(form.details || "", form);
  if (!marker) {
    throw new Error("Could not build filing prep checklist for this event.");
  }

  const state = parsePrepChecklistState(marker);
  if (!state) throw new Error("Could not build filing prep checklist.");

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
