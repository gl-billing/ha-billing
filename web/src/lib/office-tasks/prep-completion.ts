import "server-only";

import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  clearPrepDoneNotice,
  clearPrepReadyMarker,
  isPreparationTask,
  prepDoneNoticeMarker,
  prepReadyMarker
} from "@/lib/office-tasks/prep-completion-core";
import {
  resolveFilingEventForPrepTask,
  resolvePrepTaskForEvent
} from "@/lib/office-tasks/prep-task-event-link";
import { isOpenFilingEvent } from "@/lib/office-tasks/filing-confirmation";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { SHEETS } from "@/lib/tasks-config";

export {
  clearPrepDoneNotice,
  clearPrepReadyMarker,
  isPreparationTask,
  isPrepReadyTask,
  parsePrepDoneNotice,
  parsePrepReadyMarker,
  prepDoneNoticeMarker,
  prepReadyMarker,
  shouldDeferPrepTaskCompletion
} from "@/lib/office-tasks/prep-completion-core";

const TASK_COL = {
  nextAction: 10,
  remarks: 14,
  lastUpdated: 18
};

const EVENT_COL = {
  nextAction: 13,
  remarks: 18,
  lastUpdated: 22
};

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - r - 1) / 26);
  }
  return s;
}

function openPrepTasksForEvent(event: OfficeItem, items: OfficeItem[]): OfficeItem[] {
  const linked = resolvePrepTaskForEvent(event, items);
  const matches = new Map<string, OfficeItem>();
  if (linked && !linked.done) matches.set(linked.id, linked);

  const marker = `EVENT_REMINDER:${event.id}`.toUpperCase();
  for (const item of items) {
    if (item.source !== "Task" || item.done) continue;
    if (!isPreparationTask(item)) continue;
    if (item.remarks.toUpperCase().includes(marker)) {
      matches.set(item.id, item);
    }
  }

  return [...matches.values()];
}

/** When an event is filed / done, close linked filing prep tasks. */
export async function closeLinkedPrepTasksForEvent(
  accessToken: string,
  eventId: string,
  eventRowNumber: number
): Promise<number> {
  const items = await collectAllItems(accessToken);
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event) return 0;

  const toClose = openPrepTasksForEvent(event, items);
  for (const task of toClose) {
    const remarks = clearPrepReadyMarker(task.remarks || "");
    if (remarks !== (task.remarks || "")) {
      const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
      await batchUpdateSheetValues(accessToken, [
        {
          range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.remarks)}${task.rowNumber}`),
          values: [[remarks]]
        },
        {
          range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${task.rowNumber}`),
          values: [[now]]
        }
      ]);
    }
    await setItemDone(accessToken, "Task", task.rowNumber, true);
  }

  const remarks = clearPrepDoneNotice(event.remarks || "");
  if (remarks !== (event.remarks || "")) {
    const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    await batchUpdateSheetValues(accessToken, [
      {
        range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.remarks)}${eventRowNumber}`),
        values: [[remarks]]
      },
      {
        range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.lastUpdated)}${eventRowNumber}`),
        values: [[now]]
      }
    ]);
  }

  return toClose.length;
}

/** Mark prep ready on the task and notify admin on the linked filing event — task stays open until filing. */
export async function recordPrepReadyState(
  accessToken: string,
  task: OfficeItem,
  completedBy: string,
  items?: OfficeItem[]
): Promise<{ taskRemarks: string; taskNextAction: string } | null> {
  if (task.source !== "Task" || task.rowNumber < 2 || !isPreparationTask(task)) return null;

  const allItems = items ?? (await collectAllItems(accessToken));
  const event = resolveFilingEventForPrepTask(task, allItems);
  if (!event || event.rowNumber < 2 || !isOpenFilingEvent(event)) return null;

  const staff = completedBy.trim() || "prep staff";
  const taskRemarks = appendRemarkMarkers(clearPrepReadyMarker(task.remarks || ""), [prepReadyMarker(staff)]);
  const taskNextAction = "Prep complete — awaiting filing confirmation.";
  const eventRemarks = appendRemarkMarkers(clearPrepDoneNotice(event.remarks || ""), [prepDoneNoticeMarker(staff)]);
  const eventNextAction = `Prep marked done by ${staff} — admin: confirm filing when ready.`;
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.remarks)}${task.rowNumber}`), values: [[taskRemarks]] },
    { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.nextAction)}${task.rowNumber}`), values: [[taskNextAction]] },
    { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${task.rowNumber}`), values: [[now]] },
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.remarks)}${event.rowNumber}`), values: [[eventRemarks]] },
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.nextAction)}${event.rowNumber}`), values: [[eventNextAction]] },
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.lastUpdated)}${event.rowNumber}`), values: [[now]] }
  ]);

  return { taskRemarks, taskNextAction };
}

/** Notify admin on the linked filing event when prep staff mark prep done. */
export async function recordPrepDoneNoticeOnLinkedEvent(
  accessToken: string,
  task: OfficeItem,
  completedBy: string
): Promise<boolean> {
  if (task.source !== "Task" || !isPreparationTask(task)) return false;

  const items = await collectAllItems(accessToken);
  const event = resolveFilingEventForPrepTask(task, items);
  if (!event || event.rowNumber < 2) return false;

  const marker = prepDoneNoticeMarker(completedBy);
  const remarks = appendRemarkMarkers(clearPrepDoneNotice(event.remarks || ""), [marker]);
  const nextAction = `Prep marked done by ${completedBy.trim() || "prep staff"} — admin: confirm filing when ready.`;
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.remarks)}${event.rowNumber}`), values: [[remarks]] },
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.nextAction)}${event.rowNumber}`), values: [[nextAction]] },
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.lastUpdated)}${event.rowNumber}`), values: [[now]] }
  ]);

  return true;
}
