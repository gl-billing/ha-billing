import { SHEETS } from "@/lib/tasks-config";
import {
  applyFollowUpWithNote,
  clearFollowUpMarker,
  getFollowUpFromRemarks,
  type FollowUpMarker
} from "@/lib/office-tasks/follow-up-marker";
import {
  prepTaskDueDateForFilingDeadline,
  resetPrepTaskRemarks,
  updatePrepTaskDescriptionForDeadline
} from "@/lib/office-tasks/filing-prep-reset";
import {
  eventFollowUpMarker,
  eventReminderMarker,
  parseEventTaskLinks
} from "@/lib/office-tasks/event-item-links";
import { looksLikePrepReminderTask, resolveFilingEventForPrepTask } from "@/lib/office-tasks/prep-task-event-link";
import { batchUpdateSheetValues, getSheetValues, updateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { normalizeOfficeStatus } from "@/lib/office-tasks/date-only";
import { shouldUpdateFilingDeadlineOnReset } from "@/lib/office-tasks/reset-target";
import { todayYmd } from "@/lib/office-tasks/schedule";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import { resolveStatusLabel } from "@/lib/office-tasks/status";
import {
  applyPrepChecklistToggle,
  applyPrepChecklistMutation,
  nextActionForPrepChecklist,
  nextActionAfterPrepChecklistDelete,
  parsePrepChecklistState,
  type PrepChecklistMutation
} from "@/lib/office-tasks/prep-checklist-storage";

export type { ItemStatusUpdate } from "@/lib/office-tasks/status";

/** 1-based column indices matching TASK_HEADERS / EVENT_HEADERS */
const TASK_COL = {
  dueDate: 3,
  description: 8,
  nextAction: 10,
  status: 11,
  done: 12,
  dateCompleted: 13,
  remarks: 14,
  lastUpdated: 18
};
const EVENT_COL = {
  eventDate: 3,
  nextAction: 13,
  status: 14,
  done: 15,
  dateCompleted: 16,
  filingDeadline: 17,
  remarks: 18,
  lastUpdated: 22
};

function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

export async function setEventSubmitted(
  accessToken: string,
  rowNumber: number,
  submitted: boolean
): Promise<void> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const today = todayYmd();
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const sheet = SHEETS.events;
  const status = submitted ? "Submitted" : "Scheduled";
  const done = submitted;

  const remarksRows = await getSheetValues(
    accessToken,
    toA1Range(sheet, `${colLetter(EVENT_COL.remarks)}${rowNumber}`)
  );
  const remarks = clearFollowUpMarker(String(remarksRows[0]?.[0] ?? ""));

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.status)}${rowNumber}`), values: [[status]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.done)}${rowNumber}`), values: [[done]] },
    {
      range: toA1Range(sheet, `${colLetter(EVENT_COL.dateCompleted)}${rowNumber}`),
      values: [[submitted ? today : ""]]
    },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.remarks)}${rowNumber}`), values: [[remarks]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.lastUpdated)}${rowNumber}`), values: [[now]] }
  ]);
}

export async function setItemDone(
  accessToken: string,
  source: "Task" | "Event",
  rowNumber: number,
  done: boolean
): Promise<void> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const today = todayYmd();
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  if (source === "Task") {
    const sheet = SHEETS.tasks;
    const status = done ? "Done" : "In Progress";
    const remarksRows = await getSheetValues(
      accessToken,
      toA1Range(sheet, `${colLetter(TASK_COL.remarks)}${rowNumber}`)
    );
    const remarks = clearFollowUpMarker(String(remarksRows[0]?.[0] ?? ""));
    await batchUpdateSheetValues(accessToken, [
      { range: toA1Range(sheet, `${colLetter(TASK_COL.status)}${rowNumber}`), values: [[status]] },
      { range: toA1Range(sheet, `${colLetter(TASK_COL.done)}${rowNumber}`), values: [[done]] },
      {
        range: toA1Range(sheet, `${colLetter(TASK_COL.dateCompleted)}${rowNumber}`),
        values: [[done ? today : ""]]
      },
      { range: toA1Range(sheet, `${colLetter(TASK_COL.remarks)}${rowNumber}`), values: [[remarks]] },
      { range: toA1Range(sheet, `${colLetter(TASK_COL.lastUpdated)}${rowNumber}`), values: [[now]] }
    ]);
    return;
  }

  const status = done ? "Done" : "Scheduled";
  const sheet = SHEETS.events;
  const remarksRows = await getSheetValues(
    accessToken,
    toA1Range(sheet, `${colLetter(EVENT_COL.remarks)}${rowNumber}`)
  );
  const remarks = clearFollowUpMarker(String(remarksRows[0]?.[0] ?? ""));
  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.status)}${rowNumber}`), values: [[status]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.done)}${rowNumber}`), values: [[done]] },
    {
      range: toA1Range(sheet, `${colLetter(EVENT_COL.dateCompleted)}${rowNumber}`),
      values: [[done ? today : ""]]
    },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.remarks)}${rowNumber}`), values: [[remarks]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.lastUpdated)}${rowNumber}`), values: [[now]] }
  ]);
}

export async function setItemStatus(
  accessToken: string,
  source: "Task" | "Event",
  rowNumber: number,
  statusUpdate: ItemStatusUpdate,
  options?: { note?: string }
): Promise<{ status: string; remarks: string }> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const cols = source === "Task" ? TASK_COL : EVENT_COL;
  const sheet = source === "Task" ? SHEETS.tasks : SHEETS.events;

  const status = resolveStatusLabel(source, statusUpdate);
  const done = false;
  const dateCompleted = "";
  const statusRange = toA1Range(sheet, `${colLetter(cols.status)}${rowNumber}`);
  const remarksRange = toA1Range(sheet, `${colLetter(cols.remarks)}${rowNumber}`);

  const existingRemarksRows = await getSheetValues(accessToken, remarksRange);
  const existingRemarks = String(existingRemarksRows[0]?.[0] ?? "");
  let remarks = existingRemarks;
  if (status === "Waiting" || status === "Started") {
    remarks = applyFollowUpWithNote(existingRemarks, status as FollowUpMarker, options?.note);
  } else {
    remarks = clearFollowUpMarker(existingRemarks);
  }

  await batchUpdateSheetValues(accessToken, [
    { range: statusRange, values: [[`'${status}`]] },
    { range: toA1Range(sheet, `${colLetter(cols.done)}${rowNumber}`), values: [[done]] },
    { range: toA1Range(sheet, `${colLetter(cols.dateCompleted)}${rowNumber}`), values: [[dateCompleted]] },
    { range: remarksRange, values: [[remarks]] },
    { range: toA1Range(sheet, `${colLetter(cols.lastUpdated)}${rowNumber}`), values: [[now]] }
  ]);

  const rows = await getSheetValues(accessToken, statusRange);
  const confirmed = normalizeOfficeStatus(String(rows[0]?.[0] ?? ""));
  if (confirmed !== status) {
    throw new Error(
      `Status did not save (expected "${status}", sheet shows "${confirmed || "blank"}"). If the Status column has data validation, add Waiting and Started to the allowed list.`
    );
  }

  return { status: confirmed, remarks };
}

async function resetLinkedTasksForFilingReset(
  accessToken: string,
  eventId: string,
  eventRowNumber: number,
  newFilingDeadline: string
): Promise<void> {
  if (!eventId) return;

  const remarksRows = await getSheetValues(
    accessToken,
    toA1Range(SHEETS.events, `${colLetter(EVENT_COL.remarks)}${eventRowNumber}`)
  );
  const remarks = String(remarksRows[0]?.[0] ?? "");
  const links = parseEventTaskLinks(remarks);
  const linkedIds = new Set(
    [links.followUpTaskId, links.reminderTaskId].filter((id): id is string => Boolean(id?.trim()))
  );

  const followUpMarker = eventFollowUpMarker(eventId).toUpperCase();
  const reminderMarker = eventReminderMarker(eventId).toUpperCase();
  const items = await collectAllItems(accessToken);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  for (const item of items) {
    if (item.source !== "Task") continue;

    const remarksUpper = item.remarks.toUpperCase();
    const isPrep =
      linkedIds.has(item.id) && links.reminderTaskId === item.id
        ? true
        : remarksUpper.includes(reminderMarker) ||
          (looksLikePrepReminderTask(item) && resolveFilingEventForPrepTask(item, items)?.id === eventId);
    const isFollowUp =
      !isPrep &&
      (linkedIds.has(item.id) ||
        remarksUpper.includes(followUpMarker) ||
        (links.followUpTaskId === item.id && !looksLikePrepReminderTask(item)));

    if (!isPrep && !isFollowUp) continue;

    if (isPrep) {
      const dueDate = prepTaskDueDateForFilingDeadline(item, newFilingDeadline);
      const description = updatePrepTaskDescriptionForDeadline(item.details, newFilingDeadline);
      const reset = resetPrepTaskRemarks(item.remarks);
      const updates: Array<{ range: string; values: unknown[][] }> = [
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.dueDate)}${item.rowNumber}`), values: [[dueDate]] },
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.description)}${item.rowNumber}`), values: [[description]] },
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.status)}${item.rowNumber}`), values: [["In Progress"]] },
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.done)}${item.rowNumber}`), values: [[false]] },
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.dateCompleted)}${item.rowNumber}`), values: [[""]] },
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.remarks)}${item.rowNumber}`), values: [[reset.remarks]] },
        { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${item.rowNumber}`), values: [[now]] }
      ];
      if (reset.nextAction) {
        updates.push({
          range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.nextAction)}${item.rowNumber}`),
          values: [[reset.nextAction]]
        });
      }
      await batchUpdateSheetValues(accessToken, updates);
      continue;
    }

    await batchUpdateSheetValues(accessToken, [
      { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.dueDate)}${item.rowNumber}`), values: [[newFilingDeadline]] },
      { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.status)}${item.rowNumber}`), values: [["In Progress"]] },
      { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.done)}${item.rowNumber}`), values: [[false]] },
      { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.dateCompleted)}${item.rowNumber}`), values: [[""]] },
      { range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${item.rowNumber}`), values: [[now]] }
    ]);
  }
}

/** Reset with a new date — reactivates the row (In Progress / Scheduled) and updates the due or event date. */
export async function resetItemWithNewDate(
  accessToken: string,
  source: "Task" | "Event",
  rowNumber: number,
  newDate: string,
  options?: { useFilingDeadline?: boolean; hasFilingDeadline?: boolean; category?: string }
): Promise<void> {
  if (rowNumber < 2) throw new Error("Invalid row.");
  if (!isValidYmd(newDate)) throw new Error("Invalid date. Use YYYY-MM-DD.");

  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const done = false;
  const dateCompleted = "";

  if (source === "Task") {
    const sheet = SHEETS.tasks;
    await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(TASK_COL.dueDate)}${rowNumber}`), [[newDate]]);
    await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(TASK_COL.status)}${rowNumber}`), [["In Progress"]]);
    await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(TASK_COL.done)}${rowNumber}`), [[done]]);
    await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(TASK_COL.dateCompleted)}${rowNumber}`), [[dateCompleted]]);
    await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(TASK_COL.lastUpdated)}${rowNumber}`), [[now]]);
    return;
  }

  const sheet = SHEETS.events;
  const updateFilingDeadline = shouldUpdateFilingDeadlineOnReset(
    source,
    options?.category ?? "",
    options?.hasFilingDeadline === true
  );
  const eventIdRows = await getSheetValues(accessToken, toA1Range(sheet, `A${rowNumber}`));
  const eventId = String(eventIdRows[0]?.[0] ?? "").trim();

  const updates: Array<{ range: string; values: unknown[][] }> = [];

  if (updateFilingDeadline) {
    updates.push({
      range: toA1Range(sheet, `${colLetter(EVENT_COL.filingDeadline)}${rowNumber}`),
      values: [[newDate]]
    });
    updates.push({
      range: toA1Range(sheet, `${colLetter(EVENT_COL.eventDate)}${rowNumber}`),
      values: [[newDate]]
    });
  } else {
    updates.push({
      range: toA1Range(sheet, `${colLetter(EVENT_COL.eventDate)}${rowNumber}`),
      values: [[newDate]]
    });
  }

  updates.push(
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.status)}${rowNumber}`), values: [["Scheduled"]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.done)}${rowNumber}`), values: [[done]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.dateCompleted)}${rowNumber}`), values: [[dateCompleted]] },
    { range: toA1Range(sheet, `${colLetter(EVENT_COL.lastUpdated)}${rowNumber}`), values: [[now]] }
  );

  await batchUpdateSheetValues(accessToken, updates);

  if (updateFilingDeadline) {
    await resetLinkedTasksForFilingReset(accessToken, eventId, rowNumber, newDate);
  }
}

export async function updateItemNextAction(
  accessToken: string,
  source: "Task" | "Event",
  rowNumber: number,
  nextAction: string
): Promise<void> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const text = nextAction.trim();
  if (!text) throw new Error("Enter a next action.");

  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const sheet = source === "Task" ? SHEETS.tasks : SHEETS.events;
  const col = source === "Task" ? TASK_COL.nextAction : EVENT_COL.nextAction;
  const lastCol = source === "Task" ? TASK_COL.lastUpdated : EVENT_COL.lastUpdated;

  await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(col)}${rowNumber}`), [[text]]);
  await updateSheetValues(accessToken, toA1Range(sheet, `${colLetter(lastCol)}${rowNumber}`), [[now]]);
}

export async function updateTaskPrepChecklistItem(
  accessToken: string,
  rowNumber: number,
  itemIndex: number,
  checked: boolean
): Promise<{ done: number; total: number; nextAction: string }> {
  return updateItemPrepChecklistItem(accessToken, "Task", rowNumber, itemIndex, checked);
}

export async function updateItemPrepChecklistItem(
  accessToken: string,
  source: "Task" | "Event",
  rowNumber: number,
  itemIndex: number,
  checked: boolean
): Promise<{ done: number; total: number; nextAction: string }> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const sheet = source === "Task" ? SHEETS.tasks : SHEETS.events;
  const remarksCol = source === "Task" ? TASK_COL.remarks : EVENT_COL.remarks;
  const nextActionCol = source === "Task" ? TASK_COL.nextAction : EVENT_COL.nextAction;
  const lastUpdatedCol = source === "Task" ? TASK_COL.lastUpdated : EVENT_COL.lastUpdated;

  const remarksRows = await getSheetValues(
    accessToken,
    toA1Range(sheet, `${colLetter(remarksCol)}${rowNumber}`)
  );
  const remarks = String(remarksRows[0]?.[0] ?? "");
  const nextRemarks = applyPrepChecklistToggle(remarks, itemIndex, checked);
  if (!nextRemarks) throw new Error("Prep checklist not found on this item.");

  const state = parsePrepChecklistState(nextRemarks);
  if (!state) throw new Error("Prep checklist not found on this item.");

  const nextAction = nextActionForPrepChecklist(state);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(sheet, `${colLetter(remarksCol)}${rowNumber}`), values: [[nextRemarks]] },
    { range: toA1Range(sheet, `${colLetter(nextActionCol)}${rowNumber}`), values: [[nextAction]] },
    { range: toA1Range(sheet, `${colLetter(lastUpdatedCol)}${rowNumber}`), values: [[now]] }
  ]);

  return { done: state.done.length, total: state.items.length, nextAction };
}

export async function mutateItemPrepChecklist(
  accessToken: string,
  source: "Task" | "Event",
  rowNumber: number,
  mutation: PrepChecklistMutation
): Promise<{ done: number; total: number; nextAction: string; deleted?: boolean }> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const sheet = source === "Task" ? SHEETS.tasks : SHEETS.events;
  const remarksCol = source === "Task" ? TASK_COL.remarks : EVENT_COL.remarks;
  const nextActionCol = source === "Task" ? TASK_COL.nextAction : EVENT_COL.nextAction;
  const lastUpdatedCol = source === "Task" ? TASK_COL.lastUpdated : EVENT_COL.lastUpdated;

  const remarksRows = await getSheetValues(
    accessToken,
    toA1Range(sheet, `${colLetter(remarksCol)}${rowNumber}`)
  );
  const remarks = String(remarksRows[0]?.[0] ?? "");
  const nextRemarks = applyPrepChecklistMutation(remarks, mutation);
  if (nextRemarks === null) {
    if (mutation.action === "remove") {
      throw new Error("Checklist must keep at least one item.");
    }
    if (mutation.action === "delete") {
      throw new Error("Prep checklist not found on this item.");
    }
    throw new Error("Could not update prep checklist.");
  }

  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  if (mutation.action === "delete") {
    const nextActionRows = await getSheetValues(
      accessToken,
      toA1Range(sheet, `${colLetter(nextActionCol)}${rowNumber}`)
    );
    const currentNextAction = String(nextActionRows[0]?.[0] ?? "");
    const nextAction = nextActionAfterPrepChecklistDelete(currentNextAction);

    await batchUpdateSheetValues(accessToken, [
      { range: toA1Range(sheet, `${colLetter(remarksCol)}${rowNumber}`), values: [[nextRemarks]] },
      { range: toA1Range(sheet, `${colLetter(nextActionCol)}${rowNumber}`), values: [[nextAction]] },
      { range: toA1Range(sheet, `${colLetter(lastUpdatedCol)}${rowNumber}`), values: [[now]] }
    ]);

    return { done: 0, total: 0, nextAction, deleted: true };
  }

  const state = parsePrepChecklistState(nextRemarks);
  if (!state) throw new Error("Prep checklist not found on this item.");

  const nextAction = nextActionForPrepChecklist(state);

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(sheet, `${colLetter(remarksCol)}${rowNumber}`), values: [[nextRemarks]] },
    { range: toA1Range(sheet, `${colLetter(nextActionCol)}${rowNumber}`), values: [[nextAction]] },
    { range: toA1Range(sheet, `${colLetter(lastUpdatedCol)}${rowNumber}`), values: [[now]] }
  ]);

  return { done: state.done.length, total: state.items.length, nextAction };
}

function sheetBool(value: unknown): boolean {
  return value === true || String(value ?? "").toUpperCase() === "TRUE";
}

/** Re-write Status from GL_FOLLOW_UP marker when sheet scripts reset it to Overdue. */
export async function repairFollowUpStatusesFromRemarks(accessToken: string): Promise<number> {
  const taskRange = toA1Range(SHEETS.tasks, `K2:N`);
  const eventRange = toA1Range(SHEETS.events, `N2:R`);
  const [taskRows, eventRows] = await Promise.all([
    getSheetValues(accessToken, taskRange),
    getSheetValues(accessToken, eventRange)
  ]);

  const updates: Array<{ range: string; values: unknown[][] }> = [];
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  taskRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const status = normalizeOfficeStatus(String(row[0] ?? ""));
    const done = sheetBool(row[1]);
    const remarks = String(row[3] ?? "");
    const followUp = getFollowUpFromRemarks(remarks);
    if (!followUp || done || status === followUp) return;
    if (status !== "Overdue" && status !== "In Progress" && status !== "") return;
    updates.push({
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.status)}${rowNumber}`),
      values: [[`'${followUp}`]]
    });
    updates.push({
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${rowNumber}`),
      values: [[now]]
    });
  });

  eventRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const status = normalizeOfficeStatus(String(row[0] ?? ""));
    const done = sheetBool(row[1]);
    const remarks = String(row[4] ?? "");
    const followUp = getFollowUpFromRemarks(remarks);
    if (!followUp || done || status === followUp) return;
    if (status !== "Overdue" && status !== "Scheduled" && status !== "") return;
    updates.push({
      range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.status)}${rowNumber}`),
      values: [[`'${followUp}`]]
    });
    updates.push({
      range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.lastUpdated)}${rowNumber}`),
      values: [[now]]
    });
  });

  if (!updates.length) return 0;
  await batchUpdateSheetValues(accessToken, updates);
  return updates.length / 2;
}
