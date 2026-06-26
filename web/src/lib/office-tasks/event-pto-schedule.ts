import { normalizeEventFormInput } from "@/lib/office-tasks/event-form-utils";
import type { SucceedingHearingDate } from "@/lib/office-tasks/event-form-utils";
import { appendRemarkMarkers, ptoBatchMarker } from "@/lib/office-tasks/event-item-links";
import { appendEvent, type EventFormInput } from "@/lib/office-tasks/sheets/tasks";

function ptoSessionMarker(sessionLabel: string): string {
  return `PTO_SESSION:${sessionLabel.trim()}`;
}

function sessionDetails(base: EventFormInput, row: SucceedingHearingDate): string {
  const shared = String(base.details || "").trim();
  const ptoNote = base.ptoOrderDate?.trim()
    ? `Pre-trial order dated ${base.ptoOrderDate.trim()}`
    : "Pre-trial order schedule";
  const head = `${row.sessionLabel.trim()} — ${ptoNote}`;
  return shared ? `${head}\n\n${shared}` : head;
}

/** Create one hearing event per date listed in the pre-trial order, linked by PTO_BATCH marker. */
export async function appendSucceedingHearingEvents(
  accessToken: string,
  base: EventFormInput,
  dates: SucceedingHearingDate[],
  options?: { createdBy?: string }
): Promise<{ batchId: string; eventIds: string[] }> {
  const normalized = normalizeEventFormInput({ ...base, category: "Hearing" });
  const rows = dates.filter((row) => row.eventDate?.trim() && row.sessionLabel?.trim());
  const batchId = `PTO-${Date.now()}`;
  const batchMarker = ptoBatchMarker(batchId);
  const eventIds: string[] = [];

  for (const row of rows) {
    const remarks = appendRemarkMarkers(normalized.remarks || "", [
      batchMarker,
      ptoSessionMarker(row.sessionLabel)
    ]);
    const saved = await appendEvent(
      accessToken,
      {
        ...normalized,
        category: "Hearing",
        eventDate: row.eventDate.trim(),
        startTime: row.startTime?.trim() || normalized.startTime || "",
        details: sessionDetails(normalized, row),
        remarks
      },
      { createdBy: options?.createdBy }
    );
    eventIds.push(saved.id);
  }

  return { batchId, eventIds };
}
