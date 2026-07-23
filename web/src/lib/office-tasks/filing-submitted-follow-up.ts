import {
  appendRemarkMarkers,
  eventFollowUpMarker,
  fileProofDoneMarker,
  fileProofPendingMarker,
  hasFileProofDone,
  parseEventTaskLinks,
  parseFileProofEventId
} from "@/lib/office-tasks/event-item-links";
import { hasOpenEventLinkedTask } from "@/lib/office-tasks/event-follow-up-dedupe";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { SHEETS } from "@/lib/tasks-config";
import { toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";

function openFollowUpTasksForEvent(eventId: string, items: OfficeItem[]): OfficeItem[] {
  const marker = eventFollowUpMarker(eventId).toUpperCase();
  const links = items.find((item) => item.source === "Event" && item.id === eventId);
  const linkedId = links ? parseEventTaskLinks(links.remarks).followUpTaskId : undefined;

  const matches = new Map<string, OfficeItem>();
  for (const item of items) {
    if (item.source !== "Task" || item.done) continue;
    if (item.remarks.toUpperCase().includes(marker)) matches.set(item.id, item);
    if (linkedId && item.id === linkedId) matches.set(item.id, item);
  }
  return [...matches.values()];
}

function filingProofAlreadyHandled(items: OfficeItem[], event: OfficeItem): boolean {
  if (hasFileProofDone(event.remarks || "", event.id)) return true;
  const legacyMarker = `FILE_PROOF_TASK:${event.id}`.toUpperCase();
  return items.some(
    (item) =>
      item.source === "Task" &&
      !item.done &&
      (item.remarks.toUpperCase().includes(legacyMarker) || parseFileProofEventId(item.remarks) === event.id)
  );
}

async function appendEventRemarkMarkers(accessToken: string, eventId: string, markers: string[]): Promise<void> {
  if (!markers.length) return;
  const items = await collectAllItems(accessToken);
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event || event.rowNumber < 2) return;
  const remarks = appendRemarkMarkers(event.remarks, markers);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);
}

export type FilingSubmittedFollowUpResult = {
  followUpsClosed: number;
  proofPending: boolean;
};

/** Close linked filing follow-up tasks and mark event proof-pending when marked submitted. */
export async function handleFilingSubmittedFollowUp(
  accessToken: string,
  event: OfficeItem
): Promise<FilingSubmittedFollowUpResult> {
  if (event.source !== "Event") return { followUpsClosed: 0, proofPending: false };

  const items = await collectAllItems(accessToken);
  const toClose = openFollowUpTasksForEvent(event.id, items);
  for (const task of toClose) {
    await setItemDone(accessToken, "Task", task.rowNumber, true);
  }

  let proofPending = false;
  if (!filingProofAlreadyHandled(items, event)) {
    await appendEventRemarkMarkers(accessToken, event.id, [fileProofPendingMarker(event.id)]);
    proofPending = true;
  }

  return { followUpsClosed: toClose.length, proofPending };
}

/** Mark stamped proof received on a submitted filing event. */
export async function markFilingProofComplete(
  accessToken: string,
  event: OfficeItem
): Promise<boolean> {
  if (event.source !== "Event" || event.rowNumber < 2) return false;
  if (hasFileProofDone(event.remarks || "", event.id)) return false;

  const remarks = appendRemarkMarkers(event.remarks, [
    fileProofDoneMarker(event.id)
  ]);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);
  return true;
}

/** True when an open court-confirmation task already exists for this hearing event. */
export function hasOpenCourtConfirmationTask(items: OfficeItem[], eventId: string): boolean {
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  const linkedId = event ? parseEventTaskLinks(event.remarks).courtConfirmTaskId : undefined;
  if (linkedId) {
    const linked = items.find((item) => item.id === linkedId && item.source === "Task");
    if (linked && !linked.done) return true;
  }
  const marker = `COURT_CONFIRM:${eventId}`.toUpperCase();
  return items.some(
    (item) => item.source === "Task" && !item.done && item.remarks.toUpperCase().includes(marker)
  );
}

export { hasOpenEventLinkedTask };
