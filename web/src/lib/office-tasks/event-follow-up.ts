import {
  ensurePleadingEventAssignedToAttorney,
  ensurePleadingEventAssignedToAttorneyById,
  resolveAssignedAttorneyForClientCase
} from "@/lib/office-tasks/event-client-attorney";
import { addDaysYmd } from "@/lib/office-tasks/date-only";
import {
  duplicateEventLinkedTasksToClose,
  hasOpenEventLinkedTask
} from "@/lib/office-tasks/event-follow-up-dedupe";
import { isPleadingCategory, normalizeEventFormInput } from "@/lib/office-tasks/event-form-utils";
import { buildPrepReminderTaskCopy } from "@/lib/office-tasks/event-prep-checklist";
import {
  appendRemarkMarkers,
  eventFollowUpMarker,
  eventReminderMarker,
  linkedFollowUpTaskMarker,
  linkedReminderTaskMarker,
  parseEventTaskLinks,
  parsePrepAssignee,
  parseTaskEventLink,
  prepAssigneeMarker
} from "@/lib/office-tasks/event-item-links";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { SHEETS } from "@/lib/tasks-config";
import { toA1Range, updateSheetValues, batchUpdateSheetValues } from "@/lib/office-tasks/sheets/client";
import { appendTask, type EventFormInput, type TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { eventFormInputFromOfficeItem } from "@/lib/office-tasks/prep-checklist-server";
import {
  enrichEventFormFromPrepTask,
  looksLikePrepReminderTask,
  prepTaskLinkMarkers,
  resolveFilingEventForPrepTask
} from "@/lib/office-tasks/prep-task-event-link";
import { inferPrepLeadDaysBefore } from "@/lib/office-tasks/filing-prep-reset";
import { defaultFilingPrepAssignees } from "@/lib/office-tasks/task-assignees";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { parsePrepChecklistState } from "@/lib/office-tasks/prep-checklist-storage";

function followUpTaskType(category: string): string {
  if (category === "Court Filing") return "Court Follow-up";
  return "Filing";
}

function followUpDescription(category: string, details: string, filingDeadline: string): string {
  const snippet = details.trim().slice(0, 140);
  const label =
    category === "Court Filing"
      ? "Court filing follow-up"
      : category === "Submission"
        ? "Submission follow-up"
        : "Deadline follow-up";
  return snippet ? `${label}: ${snippet} (due ${filingDeadline})` : `${label} (due ${filingDeadline})`;
}

async function appendEventRemarkMarkers(accessToken: string, eventId: string, markers: string[]): Promise<void> {
  if (!markers.length) return;
  const items = await collectAllItems(accessToken);
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event) return;
  const remarks = appendRemarkMarkers(event.remarks, markers);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);
}

/** Close extra open filing follow-up / prep reminder tasks for the same event. */
export async function reconcileDuplicateEventLinkedTasks(accessToken: string): Promise<number> {
  const items = await collectAllItems(accessToken);
  const toClose = duplicateEventLinkedTasksToClose(items);
  for (const item of toClose) {
    await setItemDone(accessToken, "Task", item.rowNumber, true);
  }
  return toClose.length;
}

export async function createEventFollowUpTaskIfNeeded(
  accessToken: string,
  eventId: string,
  form: EventFormInput,
  createFollowUp: boolean
): Promise<string | null> {
  if (!createFollowUp) return null;

  const normalized = normalizeEventFormInput(form);
  if (!isPleadingCategory(normalized.category)) return null;

  const dueDate = normalized.filingDeadline?.trim();
  if (!dueDate) return null;

  const items = await collectAllItems(accessToken);
  if (hasOpenEventLinkedTask(items, eventId, "followUp")) return null;
  const marker = eventFollowUpMarker(eventId);
  const roster = await getActiveEmployeeNames(accessToken);
  const handlingLawyer =
    (await resolveAssignedAttorneyForClientCase(accessToken, normalized.clientCase)) ||
    normalized.responsible.trim();

  const saved = await appendTask(accessToken, {
    clientCase: normalized.clientCase,
    assignedTo: handlingLawyer,
    dueDate,
    priority: normalized.priority || "High",
    taskType: followUpTaskType(normalized.category),
    description: followUpDescription(normalized.category, normalized.details, dueDate),
    nextAction: normalized.nextAction?.trim() || "Confirm filing and mark the event submitted or done",
    remarks: marker,
    status: "In Progress",
    reminderDays: normalized.reminderDays ?? 1,
    calendarSync: normalized.calendarSync === true
  });

  await appendEventRemarkMarkers(accessToken, eventId, [linkedFollowUpTaskMarker(saved.id)]);
  return saved.id;
}

export async function createEventReminderTaskIfNeeded(
  accessToken: string,
  eventId: string,
  form: EventFormInput,
  createReminder: boolean,
  daysBefore: number
): Promise<string | null> {
  if (!createReminder) return null;

  const normalized = normalizeEventFormInput(form);
  if (!isPleadingCategory(normalized.category)) return null;

  const filingDeadline = normalized.filingDeadline?.trim();
  if (!filingDeadline) return null;

  const leadDays = Number.isFinite(daysBefore) && daysBefore > 0 ? Math.floor(daysBefore) : 3;
  const dueDate = addDaysYmd(filingDeadline, -leadDays);
  const items = await collectAllItems(accessToken);
  if (hasOpenEventLinkedTask(items, eventId, "reminder")) return null;
  const marker = eventReminderMarker(eventId);
  const prepCopy = buildPrepReminderTaskCopy(normalized, filingDeadline, leadDays);
  const remarks = appendRemarkMarkers("", [marker, prepCopy.checklistMarker]);
  const roster = await getActiveEmployeeNames(accessToken);
  const prepAssignee =
    normalized.prepAssignedTo?.trim() || defaultFilingPrepAssignees(roster);

  const saved = await appendTask(accessToken, {
    clientCase: normalized.clientCase,
    assignedTo: prepAssignee,
    dueDate,
    priority: normalized.priority || "Medium",
    taskType: "Filing prep",
    description: prepCopy.description,
    nextAction: prepCopy.nextAction,
    remarks,
    status: "In Progress",
    reminderDays: 1,
    calendarSync: false
  });

  await appendEventRemarkMarkers(accessToken, eventId, [
    linkedReminderTaskMarker(saved.id),
    prepAssigneeMarker(prepAssignee)
  ]);
  return saved.id;
}

export async function createEventLinkedTasks(
  accessToken: string,
  eventId: string,
  form: EventFormInput
): Promise<{ followUpTaskId: string | null; reminderTaskId: string | null }> {
  const roster = await getActiveEmployeeNames(accessToken);
  await ensurePleadingEventAssignedToAttorneyById(accessToken, eventId, roster);
  const formForTasks = form;

  const followUpTaskId = await createEventFollowUpTaskIfNeeded(
    accessToken,
    eventId,
    formForTasks,
    form.createFollowUpTask === true
  );
  const reminderTaskId = await createEventReminderTaskIfNeeded(
    accessToken,
    eventId,
    formForTasks,
    form.createReminderTask === true,
    form.reminderTaskDaysBefore ?? 3
  );
  return { followUpTaskId, reminderTaskId };
}

function findOpenPrepReminderTask(items: OfficeItem[], eventId: string): OfficeItem | null {
  const marker = eventReminderMarker(eventId).toUpperCase();
  const fromMarker = items.find(
    (item) =>
      item.source === "Task" &&
      !item.done &&
      item.remarks.toUpperCase().includes(marker)
  );
  if (fromMarker) return fromMarker;

  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  const taskId = event ? parseEventTaskLinks(event.remarks).reminderTaskId : undefined;
  if (taskId) {
    const linked = items.find((item) => item.id === taskId && item.source === "Task");
    if (linked && !linked.done) return linked;
  }

  if (!event) return null;

  const legacyMatches = items.filter(
    (item) =>
      item.source === "Task" &&
      !item.done &&
      looksLikePrepReminderTask(item) &&
      resolveFilingEventForPrepTask(item, items)?.id === eventId
  );
  if (legacyMatches.length === 1) return legacyMatches[0];

  return null;
}

/** Add interactive PREP_CHECKLIST data to an existing prep reminder task row. */
export async function initializeInteractivePrepChecklistOnTask(
  accessToken: string,
  task: OfficeItem,
  event: OfficeItem
): Promise<{ taskId: string; total: number }> {
  if (task.source !== "Task" || task.rowNumber < 2) {
    throw new Error("Valid prep task row is required.");
  }
  if (parsePrepChecklistState(task.remarks || "")) {
    throw new Error("Interactive prep checklist already exists on this task.");
  }

  const form = enrichEventFormFromPrepTask(eventFormInputFromOfficeItem(event), task);
  const filingDeadline = form.filingDeadline?.trim() || event.filingDeadline?.trim();
  if (!filingDeadline) throw new Error("Linked event has no filing deadline.");

  const leadDays = inferPrepLeadDaysBefore(task, filingDeadline);
  const prepCopy = buildPrepReminderTaskCopy(form, filingDeadline, leadDays);
  const linkMarkers = prepTaskLinkMarkers(event.id, task.id);
  const hasReminderLink = parseTaskEventLink(task.remarks || "")?.kind === "reminder";
  const nextRemarks = appendRemarkMarkers(task.remarks || "", [
    ...(hasReminderLink ? [] : linkMarkers.taskMarkers),
    prepCopy.checklistMarker
  ]);
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    { range: toA1Range(SHEETS.tasks, `G${task.rowNumber}`), values: [["Filing prep"]] },
    { range: toA1Range(SHEETS.tasks, `N${task.rowNumber}`), values: [[nextRemarks]] },
    { range: toA1Range(SHEETS.tasks, `J${task.rowNumber}`), values: [[prepCopy.nextAction]] },
    { range: toA1Range(SHEETS.tasks, `R${task.rowNumber}`), values: [[now]] }
  ]);

  await appendEventRemarkMarkers(accessToken, event.id, linkMarkers.eventMarkers);

  return { taskId: task.id, total: prepCopy.checklistItems.length };
}

/** Enable interactive checklist on a prep task row (looks up linked filing event). */
export async function initializeInteractivePrepChecklistFromTaskRow(
  accessToken: string,
  task: OfficeItem
): Promise<{ taskId: string; total: number; message: string }> {
  if (task.source !== "Task" || task.rowNumber < 2) {
    throw new Error("Valid prep task row is required.");
  }

  const items = await collectAllItems(accessToken);
  const event = resolveFilingEventForPrepTask(task, items);
  if (!event) {
    throw new Error(
      "Could not find the linked Court Filing event — open the filing event for this case and use Create filing prep checklist, or confirm the case and filing deadline match."
    );
  }

  const result = await initializeInteractivePrepChecklistOnTask(accessToken, task, event);
  return {
    ...result,
    message: `Interactive checklist enabled (${result.total} items). Expand the checklist below.`
  };
}

/** Create (or skip if exists) a prep reminder task with checklist for a saved filing event. */
export async function createEventReminderTaskForExistingEvent(
  accessToken: string,
  event: OfficeItem,
  daysBefore = 3
): Promise<{ taskId: string | null; created: boolean; message: string }> {
  if (event.source !== "Event") {
    return { taskId: null, created: false, message: "Only filing events can have a prep checklist." };
  }

  const roster = await getActiveEmployeeNames(accessToken);
  await ensurePleadingEventAssignedToAttorney(accessToken, event, roster);

  const form = {
    ...eventFormInputFromOfficeItem(event),
    prepAssignedTo: parsePrepAssignee(event.remarks || "")
  };
  const existing = await collectAllItems(accessToken);
  const openPrepTask = findOpenPrepReminderTask(existing, event.id);
  if (openPrepTask) {
    if (!parsePrepChecklistState(openPrepTask.remarks || "")) {
      const initialized = await initializeInteractivePrepChecklistOnTask(accessToken, openPrepTask, event);
      return {
        taskId: initialized.taskId,
        created: true,
        message: `Interactive checklist enabled on prep task (${initialized.taskId}). Expand the checklist below.`
      };
    }
    return {
      taskId: openPrepTask.id,
      created: false,
      message: `Prep checklist task already exists (${openPrepTask.id}).`
    };
  }

  const taskId = await createEventReminderTaskIfNeeded(accessToken, event.id, form, true, daysBefore);
  if (!taskId) {
    return {
      taskId: null,
      created: false,
      message: "Could not create prep checklist — confirm this event has a filing deadline."
    };
  }

  return {
    taskId,
    created: true,
    message: `Filing prep checklist created (${taskId}). Open the checklist on this event or the prep task.`
  };
}
