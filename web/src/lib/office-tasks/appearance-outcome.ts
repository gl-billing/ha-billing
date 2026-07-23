import {
  appendRemarkMarkers,
  postHearingFollowUpDoneMarker
} from "@/lib/office-tasks/event-item-links";
import { isHearingItem } from "@/lib/hearing-escalation";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { cancelLinkedTasksForEvent } from "@/lib/office-tasks/cancel-linked-tasks";
import { resetItemWithNewDate, setItemDone, setItemStatus } from "@/lib/office-tasks/sheets/complete";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { appendEvent, appendTask } from "@/lib/office-tasks/sheets/tasks";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { defaultAndreaOperationsAssignee } from "@/lib/office-tasks/task-assignees";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { SHEETS } from "@/lib/tasks-config";
import { batchUpdateSheetValues, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import {
  APPEARANCE_OUTCOME_CATEGORIES,
  isAppearanceOutcomeEvent,
  normalizeAppearanceCourtFollowUpKind,
  parseAppearanceOutcomeAction,
  parseAppearanceOutcomeNote,
  type AppearanceCourtFollowUpKind,
  type AppearanceOutcomeAction
} from "@/lib/office-tasks/appearance-outcome-shared";

export {
  APPEARANCE_OUTCOME_CATEGORIES,
  isAppearanceOutcomeEvent,
  normalizeAppearanceCourtFollowUpKind,
  parseAppearanceOutcomeAction,
  parseAppearanceOutcomeNote,
  type AppearanceCourtFollowUpKind,
  type AppearanceOutcomeAction
};

/** @deprecated Prefer AppearanceOutcomeAction — kept for existing post-hearing UI. */
export type HearingOutcomeAction = "appeared" | "continued" | "cancelled";

const OUTCOME_ACTION_RE = /\n?EVENT_OUTCOME:(completed|rescheduled|postponed|cancelled)/i;
const OUTCOME_NOTE_RE = /\n?EVENT_OUTCOME_NOTE:[^\n]+/gi;
const LEGACY_HEARING_NOTE_RE = /\n?HEARING_OUTCOME_NOTE:[^\n]+/gi;

/** 1-based event columns (same as sheets/complete.ts). */
const EVENT_COL = {
  nextAction: 13,
  status: 14,
  done: 15,
  dateCompleted: 16,
  remarks: 18,
  lastUpdated: 22
} as const;

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

function stripOutcomeMarkers(remarks: string): string {
  return String(remarks || "")
    .replace(OUTCOME_ACTION_RE, "")
    .replace(OUTCOME_NOTE_RE, "")
    .replace(LEGACY_HEARING_NOTE_RE, "")
    .trim();
}

function nextSettingFollowUpMarker(eventId: string): string {
  return `NEXT_SETTING_FOLLOWUP:${eventId}`;
}

function outcomeCourtFollowUpMarker(kind: AppearanceCourtFollowUpKind, eventId: string): string {
  return `OUTCOME_FOLLOWUP:${kind}:${eventId}`;
}

function outcomeMarkers(eventId: string, action: AppearanceOutcomeAction, note: string): string[] {
  const markers = [`EVENT_OUTCOME:${action}`, postHearingFollowUpDoneMarker(eventId)];
  if (note.trim()) {
    markers.push(`EVENT_OUTCOME_NOTE:${note.trim().slice(0, 400)}`);
  }
  return markers;
}

function applyOutcomeRemarks(existing: string, eventId: string, action: AppearanceOutcomeAction, note: string): string {
  return appendRemarkMarkers(stripOutcomeMarkers(existing), outcomeMarkers(eventId, action, note));
}

async function writeEventOutcomeFields(
  accessToken: string,
  event: OfficeItem,
  input: {
    remarks: string;
    nextAction?: string;
    status?: string;
    done?: boolean;
  }
): Promise<void> {
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const updates: Array<{ range: string; values: unknown[][] }> = [
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.remarks)}${event.rowNumber}`), values: [[input.remarks]] },
    { range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.lastUpdated)}${event.rowNumber}`), values: [[now]] }
  ];
  if (input.nextAction !== undefined) {
    updates.push({
      range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.nextAction)}${event.rowNumber}`),
      values: [[input.nextAction]]
    });
  }
  if (input.status !== undefined) {
    updates.push({
      range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.status)}${event.rowNumber}`),
      values: [[`'${input.status}`]]
    });
  }
  if (input.done !== undefined) {
    updates.push({
      range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.done)}${event.rowNumber}`),
      values: [[input.done]]
    });
    updates.push({
      range: toA1Range(SHEETS.events, `${colLetter(EVENT_COL.dateCompleted)}${event.rowNumber}`),
      values: [[input.done ? todayYmd() : ""]]
    });
  }
  await batchUpdateSheetValues(accessToken, updates);
}

function hasOpenMarkerTask(items: OfficeItem[], marker: string): boolean {
  const needle = marker.toUpperCase();
  return items.some(
    (item) =>
      item.source === "Task" &&
      !item.done &&
      item.status !== "Cancelled" &&
      item.status !== "Reset" &&
      item.remarks.toUpperCase().includes(needle)
  );
}

function hasOpenNextSettingFollowUp(items: OfficeItem[], eventId: string): boolean {
  return hasOpenMarkerTask(items, nextSettingFollowUpMarker(eventId));
}

/** Create desk task to call court / follow up when the next setting date is unknown. */
export async function createNextSettingFollowUpTask(
  accessToken: string,
  event: OfficeItem
): Promise<string | null> {
  if (!event.id || event.rowNumber < 2) return null;

  const items = await collectAllItems(accessToken);
  if (hasOpenNextSettingFollowUp(items, event.id)) return null;

  const roster = await getActiveEmployeeNames(accessToken);
  const assignee = (event.assignedTo || "").trim() || defaultAndreaOperationsAssignee(roster);
  const hearing = isHearingItem(event);
  const snippet = event.details.trim().slice(0, 100);
  const venue = event.venue?.trim();

  const saved = await appendTask(accessToken, {
    clientCase: event.clientCase,
    assignedTo: assignee,
    dueDate: todayYmd(),
    priority: "High",
    taskType: hearing ? "Court liaison" : "Follow-up",
    description: hearing
      ? snippet
        ? `Call court for next hearing date — ${snippet}`
        : "Call court for next hearing date"
      : snippet
        ? `Follow up to reschedule — ${snippet}`
        : `Follow up to reschedule ${event.category || "event"}`,
    nextAction: hearing
      ? venue
        ? `Ask ${venue} for the next setting; update the hearing when confirmed.`
        : "Ask the court for the next setting date; update the hearing when confirmed."
      : "Confirm the new date with the other party or client; update the event when set.",
    remarks: nextSettingFollowUpMarker(event.id),
    status: "In Progress",
    reminderDays: 1,
    calendarSync: false
  });

  const remarks = appendRemarkMarkers(event.remarks, [nextSettingFollowUpMarker(event.id)]);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);

  return saved.id;
}

export type CourtRequiredFollowUpResult = {
  kind: AppearanceCourtFollowUpKind;
  taskId: string | null;
  eventId: string | null;
  message: string;
};

/** Create follow-up hearing / submission / other work required by the court or meeting. */
export async function createCourtRequiredFollowUp(
  accessToken: string,
  event: OfficeItem,
  input: {
    kind: AppearanceCourtFollowUpKind;
    followUpDate?: string;
    followUpNote?: string;
    whatHappened?: string;
  }
): Promise<CourtRequiredFollowUpResult | null> {
  const kind = normalizeAppearanceCourtFollowUpKind(input.kind);
  if (kind === "none" || !event.id) return null;

  const items = await collectAllItems(accessToken);
  const marker = outcomeCourtFollowUpMarker(kind, event.id);
  if (hasOpenMarkerTask(items, marker)) {
    return { kind, taskId: null, eventId: null, message: "Follow-up already open." };
  }

  const roster = await getActiveEmployeeNames(accessToken);
  const assignee = (event.assignedTo || "").trim() || defaultAndreaOperationsAssignee(roster);
  const hearing = isHearingItem(event);
  const snippet = event.details.trim().slice(0, 100);
  const note = String(input.followUpNote || "").trim();
  const outcomeBit = String(input.whatHappened || "").trim().slice(0, 120);
  const date = String(input.followUpDate || "").trim();
  const venue = event.venue?.trim() || "";

  if (kind === "next_hearing") {
    if (date) {
      const saved = await appendEvent(accessToken, {
        clientCase: event.clientCase,
        eventDate: date,
        category: hearing ? "Hearing" : event.category || "Hearing",
        priority: "High",
        responsible: assignee,
        venue,
        details: note
          ? note
          : snippet
            ? `Follow-up hearing after ${snippet}`
            : "Follow-up hearing",
        previousAction: outcomeBit || `After ${event.category || "appearance"} ${event.id}`,
        nextAction: "Appear / prepare for the next setting.",
        status: "Scheduled",
        remarks: marker,
        reminderDays: 1,
        calendarSync: false,
        platform: event.platform || "",
        filingMode: "",
        pleadingType: "",
        filingDeadline: "",
        receivedDate: "",
        periodToFileDays: undefined,
        filingDate: "",
        pleadingCaseNature: ""
      });
      return {
        kind,
        taskId: null,
        eventId: saved.id,
        message: `Created follow-up hearing ${saved.id} on ${date}.`
      };
    }

    if (hasOpenNextSettingFollowUp(items, event.id)) {
      return { kind, taskId: null, eventId: null, message: "Next-setting follow-up already open." };
    }

    const saved = await appendTask(accessToken, {
      clientCase: event.clientCase,
      assignedTo: assignee,
      dueDate: todayYmd(),
      priority: "High",
      taskType: hearing ? "Court liaison" : "Follow-up",
      description: hearing
        ? snippet
          ? `Confirm next hearing date — ${snippet}`
          : "Confirm next hearing date"
        : snippet
          ? `Confirm next meeting date — ${snippet}`
          : "Confirm next meeting date",
      nextAction: note
        ? note
        : hearing
          ? "Court required another setting — get the date and add the hearing."
          : "Get the next meeting date and update the calendar.",
      remarks: `${marker}\n${nextSettingFollowUpMarker(event.id)}`,
      status: "In Progress",
      reminderDays: 1,
      calendarSync: false
    });
    return {
      kind,
      taskId: saved.id,
      eventId: null,
      message: `Created task ${saved.id} to confirm the next hearing date.`
    };
  }

  if (kind === "submission") {
    if (date) {
      const saved = await appendEvent(accessToken, {
        clientCase: event.clientCase,
        eventDate: "",
        category: "Submission",
        priority: "High",
        responsible: assignee,
        venue: "",
        details: note
          ? note
          : snippet
            ? `Follow-up submission after ${snippet}`
            : "Follow-up submission required by court",
        previousAction: outcomeBit || `Ordered after ${event.category || "appearance"} ${event.id}`,
        nextAction: "Prepare, file, and save proof of submission.",
        status: "Scheduled",
        remarks: marker,
        reminderDays: 1,
        calendarSync: false,
        platform: "",
        filingMode: "",
        pleadingType: "",
        filingDeadline: date,
        receivedDate: "",
        periodToFileDays: undefined,
        filingDate: "",
        pleadingCaseNature: ""
      });
      return {
        kind,
        taskId: null,
        eventId: saved.id,
        message: `Created submission deadline ${saved.id} due ${date}.`
      };
    }

    const saved = await appendTask(accessToken, {
      clientCase: event.clientCase,
      assignedTo: assignee,
      dueDate: todayYmd(),
      priority: "High",
      taskType: "Court Follow-up",
      description: note
        ? note.slice(0, 160)
        : snippet
          ? `Follow-up submission — ${snippet}`
          : "Follow-up submission required by court",
      nextAction: note
        ? `File/submit as required. ${note}`.slice(0, 200)
        : "Confirm what must be filed, due date, and prepare the submission.",
      remarks: marker,
      status: "In Progress",
      reminderDays: 1,
      calendarSync: false
    });
    return {
      kind,
      taskId: saved.id,
      eventId: null,
      message: `Created submission follow-up task ${saved.id}.`
    };
  }

  const saved = await appendTask(accessToken, {
    clientCase: event.clientCase,
    assignedTo: assignee,
    dueDate: date || todayYmd(),
    priority: "Medium",
    taskType: "Follow-up",
    description: note
      ? note.slice(0, 160)
      : snippet
        ? `Follow-up after ${snippet}`
        : `Follow-up after ${event.category || "appearance"}`,
    nextAction: note || outcomeBit || "Complete the required follow-up from today’s appearance.",
    remarks: marker,
    status: "In Progress",
    reminderDays: 1,
    calendarSync: false
  });
  return {
    kind,
    taskId: saved.id,
    eventId: null,
    message: `Created follow-up task ${saved.id}.`
  };
}

function mapLegacyAction(action: HearingOutcomeAction): AppearanceOutcomeAction {
  if (action === "appeared") return "completed";
  if (action === "continued") return "rescheduled";
  return "cancelled";
}

function dispositionNextAction(
  action: AppearanceOutcomeAction,
  note: string,
  nextDate?: string,
  followUpCreated?: boolean
): string {
  const noteBit = note.trim() ? ` — ${note.trim().slice(0, 160)}` : "";
  if (action === "completed") return `Completed${noteBit}`;
  if (action === "rescheduled" && nextDate) return `Rescheduled to ${nextDate}${noteBit}`;
  if (action === "postponed") {
    return followUpCreated
      ? `Postponed — follow up for next date${noteBit}`
      : `Postponed — next date pending${noteBit}`;
  }
  return followUpCreated ? `Cancelled — follow up for next date${noteBit}` : `Cancelled${noteBit}`;
}

export type LogAppearanceOutcomeResult = {
  action: AppearanceOutcomeAction;
  followUpTaskId: string | null;
  followUpEventId: string | null;
  message: string;
};

/** Log what happened for a hearing / meeting / consultation in one step. */
export async function logAppearanceOutcome(
  accessToken: string,
  event: OfficeItem,
  input: {
    action: AppearanceOutcomeAction;
    whatHappened: string;
    nextDate?: string;
    /** When postponed/cancelled with no new date: create a follow-up task (default true). */
    createNextDateFollowUp?: boolean;
    /** When completed/rescheduled: optional court-required next work. */
    courtFollowUpKind?: AppearanceCourtFollowUpKind;
    followUpDate?: string;
    followUpNote?: string;
  }
): Promise<LogAppearanceOutcomeResult> {
  if (!isAppearanceOutcomeEvent(event)) {
    throw new Error("Only hearings, meetings, and consultations support this outcome log.");
  }

  const note = input.whatHappened.trim();
  if (!note) throw new Error("Enter a short note on what happened.");

  const action = input.action;
  const createFollowUp = input.createNextDateFollowUp !== false;
  const courtFollowUpKind = normalizeAppearanceCourtFollowUpKind(input.courtFollowUpKind);
  let followUpTaskId: string | null = null;
  let followUpEventId: string | null = null;
  const extras: string[] = [];

  async function maybeCreateCourtFollowUp(baseRemarks: string): Promise<string> {
    if (action !== "completed" && action !== "rescheduled") return baseRemarks;
    if (courtFollowUpKind === "none") return baseRemarks;
    const created = await createCourtRequiredFollowUp(accessToken, event, {
      kind: courtFollowUpKind,
      followUpDate: input.followUpDate,
      followUpNote: input.followUpNote,
      whatHappened: note
    });
    if (!created) return baseRemarks;
    followUpTaskId = created.taskId;
    followUpEventId = created.eventId;
    extras.push(created.message);
    if ((created.taskId || created.eventId) && event.id) {
      return appendRemarkMarkers(baseRemarks, [outcomeCourtFollowUpMarker(created.kind, event.id)]);
    }
    return baseRemarks;
  }

  if (action === "rescheduled") {
    const nextDate = input.nextDate?.trim() || "";
    if (!nextDate) throw new Error("Pick the new scheduled date.");
    await resetItemWithNewDate(accessToken, "Event", event.rowNumber, nextDate, {
      category: event.category,
      hasFilingDeadline: Boolean(event.filingDeadline?.trim())
    });
    let remarks = applyOutcomeRemarks(event.remarks, event.id, action, note);
    remarks = await maybeCreateCourtFollowUp(remarks);
    await writeEventOutcomeFields(accessToken, event, {
      remarks,
      nextAction: dispositionNextAction(action, note, nextDate)
    });
    return {
      action,
      followUpTaskId,
      followUpEventId,
      message: [`Rescheduled to ${nextDate}.`, ...extras].filter(Boolean).join(" ")
    };
  }

  if (action === "completed") {
    await setItemDone(accessToken, "Event", event.rowNumber, true);
    let remarks = applyOutcomeRemarks(event.remarks, event.id, action, note);
    remarks = await maybeCreateCourtFollowUp(remarks);
    await writeEventOutcomeFields(accessToken, event, {
      remarks,
      nextAction: dispositionNextAction(action, note)
    });
    return {
      action,
      followUpTaskId,
      followUpEventId,
      message: ["Marked completed.", ...extras].filter(Boolean).join(" ")
    };
  }

  if (action === "postponed") {
    await setItemStatus(accessToken, "Event", event.rowNumber, "Reset");
    if (createFollowUp) {
      followUpTaskId = await createNextSettingFollowUpTask(accessToken, event);
    }
    let remarks = applyOutcomeRemarks(event.remarks, event.id, action, note);
    if (followUpTaskId) {
      remarks = appendRemarkMarkers(remarks, [nextSettingFollowUpMarker(event.id)]);
    }
    await writeEventOutcomeFields(accessToken, event, {
      remarks,
      nextAction: dispositionNextAction(action, note, undefined, Boolean(followUpTaskId)),
      status: "Reset"
    });
    return {
      action,
      followUpTaskId,
      followUpEventId: null,
      message: followUpTaskId
        ? "Marked postponed and created a follow-up to get the next date."
        : "Marked postponed."
    };
  }

  await setItemStatus(accessToken, "Event", event.rowNumber, "Cancelled");
  if (event.id) {
    await cancelLinkedTasksForEvent(accessToken, event.id, event.rowNumber);
  }
  if (createFollowUp) {
    followUpTaskId = await createNextSettingFollowUpTask(accessToken, event);
  }
  let remarks = applyOutcomeRemarks(event.remarks, event.id, action, note);
  if (followUpTaskId) {
    remarks = appendRemarkMarkers(remarks, [nextSettingFollowUpMarker(event.id)]);
  }
  await writeEventOutcomeFields(accessToken, event, {
    remarks,
    nextAction: dispositionNextAction(action, note, undefined, Boolean(followUpTaskId)),
    status: "Cancelled"
  });

  return {
    action,
    followUpTaskId,
    followUpEventId: null,
    message: followUpTaskId
      ? "Cancelled and created a follow-up to get the next date."
      : "Cancelled."
  };
}

/** Legacy wrapper used by post-hearing matter warnings. */
export async function logHearingOutcome(
  accessToken: string,
  event: OfficeItem,
  input: {
    action: HearingOutcomeAction;
    nextHearingDate?: string;
    note?: string;
  }
): Promise<void> {
  if (!isHearingItem(event)) throw new Error("Only hearing events support outcome logging.");

  const mapped = mapLegacyAction(input.action);
  if (mapped === "rescheduled") {
    await logAppearanceOutcome(accessToken, event, {
      action: "rescheduled",
      whatHappened: input.note?.trim() || "Hearing continued / reset to a new date.",
      nextDate: input.nextHearingDate,
      createNextDateFollowUp: false
    });
    return;
  }
  if (mapped === "completed") {
    await logAppearanceOutcome(accessToken, event, {
      action: "completed",
      whatHappened: input.note?.trim() || "Hearing appeared / taken up.",
      createNextDateFollowUp: false
    });
    return;
  }
  await logAppearanceOutcome(accessToken, event, {
    action: "cancelled",
    whatHappened: input.note?.trim() || "Hearing cancelled.",
    createNextDateFollowUp: false
  });
}
