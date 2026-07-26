import "server-only";

import { addDaysYmd } from "@/lib/office-tasks/date-only";
import {
  appendRemarkMarkers,
  eventReminderMarker
} from "@/lib/office-tasks/event-item-links";
import {
  FILING_SERVING_TASK_TYPE,
  filingServeTaskMarker,
  filingStageServingMarker,
  parseFilingServeTaskId
} from "@/lib/office-tasks/filing-stage-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { getSheetValues, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { appendTask } from "@/lib/office-tasks/sheets/tasks";
import { resolveJasAssignee } from "@/lib/office-tasks/task-assignees";
import { SHEETS } from "@/lib/tasks-config";

async function appendEventRemarkMarkers(
  accessToken: string,
  eventId: string,
  markers: string[],
  items?: OfficeItem[]
): Promise<void> {
  const allItems = items ?? (await collectAllItems(accessToken));
  const event = allItems.find((row) => row.source === "Event" && row.id === eventId);
  if (!event || event.rowNumber < 2) return;
  const live = await getSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`));
  const current = String(live[0]?.[0] ?? event.remarks ?? "");
  const next = appendRemarkMarkers(current, markers);
  if (next === current.trim() || next === current) return;
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[next]]);
}

/** After Mark filed — create Serving task for liaison if missing. */
export async function createServingTaskAfterFiled(
  accessToken: string,
  event: OfficeItem,
  items?: OfficeItem[]
): Promise<{ created: boolean; taskId: string | null }> {
  if (event.source !== "Event" || event.rowNumber < 2) {
    return { created: false, taskId: null };
  }
  const existingId = parseFilingServeTaskId(event.remarks || "");
  if (existingId) return { created: false, taskId: existingId };

  const allItems = items ?? (await collectAllItems(accessToken));
  const reminderNeedle = `EVENT_REMINDER:${event.id}`.toUpperCase();
  const already = allItems.find(
    (row) =>
      row.source === "Task" &&
      !row.done &&
      row.category === FILING_SERVING_TASK_TYPE &&
      row.remarks.toUpperCase().includes(reminderNeedle)
  );
  if (already) return { created: false, taskId: already.id };

  const roster = await getActiveEmployeeNames(accessToken);
  const assignee = resolveJasAssignee(roster);
  const due = String(event.filingDeadline || "").trim() || addDaysYmd(todayYmd(), 1);
  const pleading = event.pleadingType?.trim() || event.category || "filing";

  const saved = await appendTask(accessToken, {
    clientCase: event.clientCase,
    assignedTo: assignee,
    dueDate: due,
    priority: event.priority || "High",
    taskType: FILING_SERVING_TASK_TYPE,
    description:
      `Serve / furnish copies after ${pleading} was filed` +
      (event.details?.trim() ? `\n\nEvent notes:\n${event.details.trim().slice(0, 200)}` : ""),
    nextAction: "Serve or furnish copies; save proof of service on the matter.",
    remarks: appendRemarkMarkers("", [
      eventReminderMarker(event.id),
      filingStageServingMarker()
    ]),
    status: "In Progress",
    reminderDays: 1,
    calendarSync: false
  });

  await appendEventRemarkMarkers(accessToken, event.id, [filingServeTaskMarker(saved.id)], allItems);
  return { created: true, taskId: saved.id };
}
