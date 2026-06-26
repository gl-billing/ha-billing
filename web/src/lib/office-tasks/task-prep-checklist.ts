import { SHEETS } from "@/lib/tasks-config";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  createPrepChecklistState,
  nextActionForPrepChecklist,
  parsePrepChecklistState,
  prepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";
import { defaultTaskChecklistItems, splitTaskType } from "@/lib/office-tasks/task-form-utils";

export function resolveGenericTaskChecklistItems(task: Pick<OfficeItem, "category">): string[] {
  const { taskType } = splitTaskType(task.category || "Task");
  return defaultTaskChecklistItems(taskType);
}

/** Attach interactive PREP_CHECKLIST data to a generic task row (not filing-prep linked). */
export async function initializeGenericTaskPrepChecklist(
  accessToken: string,
  task: OfficeItem,
  itemsOverride?: readonly string[]
): Promise<{ taskId: string; total: number; message: string }> {
  if (task.source !== "Task" || task.rowNumber < 2) {
    throw new Error("Valid task row is required.");
  }
  if (parsePrepChecklistState(task.remarks || "")) {
    throw new Error("Interactive prep checklist already exists on this task.");
  }
  if (task.done) {
    throw new Error("Cannot add a checklist to a completed task.");
  }

  const items = (itemsOverride?.map((item) => item.trim()).filter(Boolean) ||
    resolveGenericTaskChecklistItems(task)) as string[];
  if (!items.length) {
    throw new Error("No checklist items for this task type.");
  }

  const state = createPrepChecklistState(items);
  const marker = prepChecklistMarker(state);
  const nextRemarks = appendRemarkMarkers(task.remarks || "", [marker]);
  const nextAction = task.nextAction?.trim() || nextActionForPrepChecklist(state);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(SHEETS.tasks, `N${task.rowNumber}`), values: [[nextRemarks]] },
    { range: toA1Range(SHEETS.tasks, `J${task.rowNumber}`), values: [[nextAction]] },
    { range: toA1Range(SHEETS.tasks, `R${task.rowNumber}`), values: [[now]] }
  ]);

  return {
    taskId: task.id,
    total: items.length,
    message: `Interactive checklist enabled (${items.length} items). Expand the checklist below.`
  };
}
