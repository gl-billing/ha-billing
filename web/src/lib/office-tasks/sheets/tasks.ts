import {
  EVENT_CATEGORIES,
  EVENT_CREATE_STATUSES,
  EVENT_HEADERS,
  EVENT_PLATFORMS,
  FILING_MODES,
  PLEADING_CASE_NATURES,
  PLEADING_TYPES,
  PRIORITIES,
  SHEETS,
  TASK_CREATE_STATUSES,
  TASK_HEADERS,
  TASK_TYPES
} from "@/lib/tasks-config";
import { TASK_FORM_TYPES } from "@/lib/office-tasks/task-form-utils";
import { normalizeEventFormInput, isHearingEventCategory, isPleadingCategory } from "@/lib/office-tasks/event-form-utils";
import { attachHearingPrepChecklistToRemarks } from "@/lib/office-tasks/hearing-prep-checklist-core";
import { attachFilingPrepChecklistToRemarks } from "@/lib/office-tasks/filing-prep-checklist-core";
import { resolvePleadingEventResponsible } from "@/lib/office-tasks/event-client-attorney";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import type { SucceedingHearingDate } from "@/lib/office-tasks/event-form-utils";
import {
  appendRowAtColumnA,
  getSheetValues,
  getSpreadsheetId,
  toA1Range,
  updateSheetValues
} from "@/lib/office-tasks/sheets/client";
import { columnIndexToLetter } from "@/lib/office-tasks/sheets/column-letter";
import { collectSourceIdsFromRows } from "@/lib/office-tasks/sheets/row-align";
import { isValidEventSourceId, isValidTaskSourceId } from "@/lib/office-tasks/sheets/repair-source-ids";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { normalizeOfficeStatus, sheetDateCellValue } from "@/lib/office-tasks/date-only";
import {
  applyFollowUpMarker,
  clearFollowUpMarker,
  type FollowUpMarker
} from "@/lib/office-tasks/follow-up-marker";
import { generateSourceId } from "@/lib/office-tasks/sheets/source-id";
import { findEventRowById, findTaskRowById } from "@/lib/office-tasks/sheets/row-verify";
import type { OfficeItem } from "@/lib/office-tasks/sheets/items";
import { parsePleadingCaseNature, setPleadingCaseNatureMarker } from "@/lib/office-tasks/event-item-links";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { canonicalizeStaffAssignees } from "@/lib/staff-assignee";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import { appendEntryCreatedByMarker } from "@/lib/office-tasks/entry-created-by";
import {
  createPrepChecklistState,
  nextActionForPrepChecklist,
  prepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";

export type TaskFormInput = {
  clientCase: string;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  venue?: string;
  priority: string;
  taskType: string;
  taskTypeOther?: string;
  description: string;
  previousAction?: string;
  nextAction?: string;
  remarks?: string;
  reminderDays?: number;
  calendarSync?: boolean;
  status?: string;
  interactiveChecklist?: boolean;
  interactiveChecklistItems?: string[];
};

export type EventFormInput = {
  clientCase: string;
  eventDate?: string;
  filingDeadline?: string;
  startTime?: string;
  endTime?: string;
  category: string;
  categoryOther?: string;
  priority: string;
  responsible: string;
  venue?: string;
  details: string;
  previousAction?: string;
  nextAction?: string;
  remarks?: string;
  reminderDays?: number;
  calendarSync?: boolean;
  status?: string;
  platform?: string;
  filingMode?: string;
  pleadingType?: string;
  pleadingCaseNature?: string;
  receivedDate?: string;
  periodToFileDays?: number;
  filingDate?: string;
  createFollowUpTask?: boolean;
  createReminderTask?: boolean;
  reminderTaskDaysBefore?: number;
  prepAssignedTo?: string;
  fromPretrialOrder?: boolean;
  ptoOrderDate?: string;
  succeedingHearingDates?: SucceedingHearingDate[];
};

function eventSheetEndColumn(): string {
  return columnIndexToLetter(EVENT_HEADERS.length);
}

function taskSheetEndColumn(): string {
  return columnIndexToLetter(TASK_HEADERS.length);
}

function sanitize(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

async function normalizeAssigneeField(accessToken: string, value: string): Promise<string> {
  const roster = await getActiveEmployeeNames(accessToken);
  return canonicalizeStaffAssignees(sanitize(value), roster);
}

async function readExistingTaskIds(accessToken: string): Promise<string[]> {
  const rows = await getSheetValues(
    accessToken,
    toA1Range(SHEETS.tasks, `A2:${taskSheetEndColumn()}`)
  );
  return collectSourceIdsFromRows(rows, isValidTaskSourceId, TASK_HEADERS.length);
}

async function readExistingEventIds(accessToken: string): Promise<string[]> {
  const rows = await getSheetValues(
    accessToken,
    toA1Range(SHEETS.events, `A2:${eventSheetEndColumn()}`)
  );
  return collectSourceIdsFromRows(rows, isValidEventSourceId, EVENT_HEADERS.length);
}

export type AppendSheetItemResult = {
  id: string;
  sheetRow: number;
  updatedRange?: string | null;
};

export async function appendTask(
  accessToken: string,
  form: TaskFormInput,
  options?: { createdBy?: string }
): Promise<AppendSheetItemResult> {
  const clientCase = sanitize(form.clientCase);
  const taskId = generateSourceId(await readExistingTaskIds(accessToken), clientCase, "TASK");

  const row: unknown[] = new Array(TASK_HEADERS.length).fill("");
  const now = todayYmd();
  row[0] = taskId;
  row[1] = now;
  row[2] = form.dueDate;
  row[3] = sanitize(form.priority) || "Medium";
  row[4] = await normalizeAssigneeField(accessToken, form.assignedTo);
  row[5] = clientCase;
  row[6] = sanitize(form.taskType) || "Task";
  row[7] = sanitize(form.description);
  row[8] = sanitize(form.previousAction);
  let nextAction = sanitize(form.nextAction);
  let remarks = sanitize(form.remarks);
  if (form.interactiveChecklist && form.interactiveChecklistItems?.length) {
    const checklistState = createPrepChecklistState(form.interactiveChecklistItems);
    remarks = appendRemarkMarkers(remarks, [prepChecklistMarker(checklistState)]);
    if (!nextAction) nextAction = nextActionForPrepChecklist(checklistState);
  }
  if (options?.createdBy) {
    remarks = appendEntryCreatedByMarker(remarks, options.createdBy);
  }
  row[9] = nextAction;
  const status = normalizeOfficeStatus(sanitize(form.status) || "In Progress");
  row[10] = status;
  row[11] = status === "Done";
  row[13] = remarks;
  row[14] = form.reminderDays ?? 1;
  row[15] = form.calendarSync === true;
  row[17] = now;
  row[18] = sanitize(form.dueTime);
  row[19] = sanitize(form.venue);

  const appendResult = await appendRowAtColumnA(
    accessToken,
    SHEETS.tasks,
    taskSheetEndColumn(),
    row
  );
  const located = await findTaskRowById(accessToken, taskId);
  if (!located) {
    throw new Error(
      `Task ${taskId} was not found in column A of Master Tasks after save. Spreadsheet ${getSpreadsheetId()}${
        appendResult.updatedRange ? ` (wrote: ${appendResult.updatedRange})` : ""
      }.`
    );
  }
  return {
    id: taskId,
    sheetRow: located.rowNumber,
    updatedRange: appendResult.updatedRange
  };
}

export async function appendEvent(
  accessToken: string,
  form: EventFormInput,
  options?: { createdBy?: string }
): Promise<AppendSheetItemResult> {
  const normalized = normalizeEventFormInput(form);
  if (!normalized.eventDate && !normalized.filingDeadline) {
    throw new Error("Enter either an event date or a filing deadline.");
  }

  const clientCase = sanitize(normalized.clientCase);
  const eventId = generateSourceId(await readExistingEventIds(accessToken), clientCase, "EVT");

  const roster = await getActiveEmployeeNames(accessToken);
  let responsible = sanitize(normalized.responsible);
  if (isPleadingCategory(normalized.category)) {
    responsible = await resolvePleadingEventResponsible(
      accessToken,
      clientCase,
      responsible,
      roster
    );
  }

  const row: unknown[] = new Array(EVENT_HEADERS.length).fill("");
  const now = todayYmd();
  row[0] = eventId;
  row[1] = sheetDateCellValue(now);
  row[2] = sheetDateCellValue(normalized.eventDate || "");
  row[3] = normalized.startTime || "";
  row[4] = normalized.endTime || "";
  row[5] = sanitize(normalized.category) || "Hearing";
  row[6] = sanitize(normalized.priority) || "Medium";
  row[7] = await normalizeAssigneeField(accessToken, responsible);
  row[8] = clientCase;
  row[9] = sanitize(normalized.venue);
  row[10] = sanitize(normalized.details);
  row[11] = sanitize(normalized.previousAction);
  row[12] = sanitize(normalized.nextAction);
  const status = sanitize(normalized.status) || "Scheduled";
  row[13] = status;
  row[14] = status === "Done" || status === "Submitted";
  row[16] = sheetDateCellValue(normalized.filingDeadline || "");
  let remarks = setPleadingCaseNatureMarker(sanitize(normalized.remarks), normalized.pleadingCaseNature || "");
  if (isHearingEventCategory(normalized.category)) {
    remarks = attachHearingPrepChecklistToRemarks(remarks, normalized.details || "");
  } else if (isPleadingCategory(normalized.category)) {
    remarks = attachFilingPrepChecklistToRemarks(remarks, normalized.details || "", normalized);
  }
  if (options?.createdBy) {
    remarks = appendEntryCreatedByMarker(remarks, options.createdBy);
  }
  row[17] = remarks;
  row[18] = normalized.reminderDays ?? 1;
  row[19] = normalized.calendarSync === true;
  row[21] = sheetDateCellValue(now);
  row[22] = sanitize(normalized.platform);
  row[23] = sanitize(normalized.filingMode);
  row[24] = sanitize(normalized.pleadingType);
  row[25] = sheetDateCellValue(normalized.receivedDate || "");
  row[26] = normalized.periodToFileDays ?? "";
  row[27] = sheetDateCellValue(normalized.filingDate || "");

  const appendResult = await appendRowAtColumnA(
    accessToken,
    SHEETS.events,
    eventSheetEndColumn(),
    row
  );
  const located = await findEventRowById(accessToken, eventId);
  if (!located) {
    throw new Error(
      `Event ${eventId} was not found in column A of Hearings & Events after save. Spreadsheet ${getSpreadsheetId()}${
        appendResult.updatedRange ? ` (wrote: ${appendResult.updatedRange})` : ""
      }.`
    );
  }
  return {
    id: eventId,
    sheetRow: located.rowNumber,
    updatedRange: appendResult.updatedRange
  };
}

function taskDoneFromStatus(status: string): boolean {
  return status === "Done";
}

function eventDoneFromStatus(status: string): boolean {
  return status === "Done" || status === "Submitted";
}

export async function updateTask(
  accessToken: string,
  rowNumber: number,
  form: TaskFormInput
): Promise<void> {
  if (rowNumber < 2) throw new Error("Invalid row.");

  const status = normalizeOfficeStatus(sanitize(form.status) || "In Progress");
  const done = taskDoneFromStatus(status);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const today = todayYmd();
  let remarks = sanitize(form.remarks);
  if (status === "Waiting" || status === "Started") {
    remarks = applyFollowUpMarker(remarks, status as FollowUpMarker);
  } else {
    remarks = clearFollowUpMarker(remarks);
  }

  const row: unknown[] = [
    sanitize(form.dueDate),
    sanitize(form.priority) || "Medium",
    await normalizeAssigneeField(accessToken, form.assignedTo),
    sanitize(form.clientCase),
    sanitize(form.taskType) || "Task",
    sanitize(form.description),
    sanitize(form.previousAction),
    sanitize(form.nextAction),
    status,
    done,
    done ? today : "",
    remarks,
    form.reminderDays ?? 1,
    form.calendarSync === true
  ];

  await updateSheetValues(accessToken, toA1Range(SHEETS.tasks, `C${rowNumber}:P${rowNumber}`), [row]);
  await updateSheetValues(accessToken, toA1Range(SHEETS.tasks, `R${rowNumber}`), [[now]]);
  await updateSheetValues(accessToken, toA1Range(SHEETS.tasks, `S${rowNumber}:T${rowNumber}`), [
    [sanitize(form.dueTime), sanitize(form.venue)]
  ]);
}

export async function updateEvent(
  accessToken: string,
  rowNumber: number,
  form: EventFormInput
): Promise<void> {
  if (rowNumber < 2) throw new Error("Invalid row.");
  const normalized = normalizeEventFormInput(form);
  if (!normalized.eventDate && !normalized.filingDeadline) {
    throw new Error("Enter either an event date or a filing deadline.");
  }

  const status = sanitize(normalized.status) || "Scheduled";
  const done = eventDoneFromStatus(status);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const today = todayYmd();

  const roster = await getActiveEmployeeNames(accessToken);
  let responsible = sanitize(normalized.responsible);
  if (isPleadingCategory(normalized.category)) {
    responsible = await resolvePleadingEventResponsible(
      accessToken,
      normalized.clientCase,
      responsible,
      roster
    );
  }

  const row: unknown[] = [
    sheetDateCellValue(normalized.eventDate || ""),
    normalized.startTime || "",
    normalized.endTime || "",
    sanitize(normalized.category) || "Hearing",
    sanitize(normalized.priority) || "Medium",
    await normalizeAssigneeField(accessToken, responsible),
    sanitize(normalized.clientCase),
    sanitize(normalized.venue),
    sanitize(normalized.details),
    sanitize(normalized.previousAction),
    sanitize(normalized.nextAction),
    status,
    done,
    done ? sheetDateCellValue(today) : "",
    sheetDateCellValue(normalized.filingDeadline || ""),
    setPleadingCaseNatureMarker(sanitize(normalized.remarks), normalized.pleadingCaseNature || ""),
    normalized.reminderDays ?? 1,
    normalized.calendarSync === true
  ];

  const extended: unknown[] = [
    sanitize(normalized.platform),
    sanitize(normalized.filingMode),
    sanitize(normalized.pleadingType),
    sheetDateCellValue(normalized.receivedDate || ""),
    normalized.periodToFileDays ?? "",
    sheetDateCellValue(normalized.filingDate || "")
  ];

  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `C${rowNumber}:T${rowNumber}`), [row]);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `W${rowNumber}:AB${rowNumber}`), [extended]);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `V${rowNumber}`), [[now]]);
}

export { getActiveEmployeeNames, getEmployeeDirectory, type EmployeeRecord } from "@/lib/office-tasks/sheets/employees";

export async function listRecentItems(accessToken: string, limit = 80): Promise<OfficeItem[]> {
  const items = await collectAllItems(accessToken);
  return items
    .filter((item) => !item.done && !["Cancelled", "Reset"].includes(item.status))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.clientCase.localeCompare(b.clientCase))
    .slice(0, limit);
}

export function getFormOptions() {
  return {
    priorities: [...PRIORITIES],
    taskTypes: [...TASK_TYPES],
    taskFormTypes: [...TASK_FORM_TYPES],
    eventCategories: [...EVENT_CATEGORIES],
    taskCreateStatuses: [...TASK_CREATE_STATUSES],
    eventCreateStatuses: [...EVENT_CREATE_STATUSES],
    filingModes: [...FILING_MODES],
    pleadingTypes: [...PLEADING_TYPES],
    pleadingCaseNatures: [...PLEADING_CASE_NATURES],
    platforms: [...EVENT_PLATFORMS]
  };
}
