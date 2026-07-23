import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import { toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { SHEETS } from "@/lib/tasks-config";

/** Append dedupe / link markers to a hearing row (column R = Remarks). */
export async function appendEventSheetRemarkMarkers(
  accessToken: string,
  event: Pick<OfficeItem, "rowNumber" | "remarks">,
  markers: string[]
): Promise<void> {
  if (!markers.length || event.rowNumber < 2) return;
  const remarks = appendRemarkMarkers(event.remarks || "", markers);
  if (remarks === (event.remarks || "").trim()) return;
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);
}
