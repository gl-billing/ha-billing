import { officeItemsShareClientCaseLabel } from "@/lib/office-tasks/client-case-identity";
import { isOpenFilingEvent } from "@/lib/office-tasks/filing-confirmation";
import {
  eventReminderMarker,
  linkedReminderTaskMarker,
  parseEventTaskLinks,
  parseTaskEventLink,
  taskConfirmsEventLink
} from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

const FILING_DEADLINE_IN_TEXT_RE = /\bdue\s+(\d{4}-\d{2}-\d{2})\b/i;
const PREP_TASK_TEXT_RE =
  /\bprep checklist for\b|\bfiling prep for\b|\bthis task is due \d+ days? before\b/i;

export type ParsedPrepTaskDescription = {
  filingDeadline: string;
  pleadingType: string;
  pleadingCaseNature: string;
};

export function looksLikePrepReminderTask(item: Pick<OfficeItem, "source" | "details" | "remarks">): boolean {
  if (item.source !== "Task") return false;
  if (parseTaskEventLink(item.remarks || "")?.kind === "reminder") return true;
  return PREP_TASK_TEXT_RE.test(String(item.details || ""));
}

export function parseFilingDeadlineFromPrepText(text: string): string {
  return text.match(FILING_DEADLINE_IN_TEXT_RE)?.[1]?.trim() || "";
}

/** Parse pleading type / case nature from legacy prep task description text. */
export function parsePrepTaskDescription(text: string): ParsedPrepTaskDescription {
  const lower = String(text || "").toLowerCase();
  const filingDeadline = parseFilingDeadlineFromPrepText(text);

  let pleadingType = "";
  if (lower.includes("responsive pleading")) pleadingType = "Responsive pleading";
  else if (lower.includes("initiatory pleading")) pleadingType = "Initiatory pleading";

  let pleadingCaseNature = "";
  if (lower.includes("criminal case") || lower.includes("(criminal)")) {
    pleadingCaseNature = "Criminal";
  } else if (
    lower.includes("civil/administrative") ||
    lower.includes("civil case") ||
    lower.includes("administrative case")
  ) {
    pleadingCaseNature = "Civil/Administrative";
  }

  return { filingDeadline, pleadingType, pleadingCaseNature };
}

function sameClientCase(
  a: Pick<OfficeItem, "id" | "clientCase">,
  b: Pick<OfficeItem, "id" | "clientCase">
): boolean {
  return officeItemsShareClientCaseLabel(a, b);
}

function prepTaskConfirmsEventLink(task: OfficeItem, eventId: string): boolean {
  return taskConfirmsEventLink(task.remarks || "", eventId, "reminder");
}

/** Find the prep reminder task linked to a filing event — direct link, reverse link, or client/deadline match. */
export function resolvePrepTaskForEvent(event: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  if (event.source !== "Event") return null;

  const links = parseEventTaskLinks(event.remarks || "");
  if (links.reminderTaskId) {
    const linked = items.find((item) => item.source === "Task" && item.id === links.reminderTaskId);
    if (linked && prepTaskConfirmsEventLink(linked, event.id)) return linked;
  }

  for (const task of items) {
    if (task.source !== "Task") continue;
    const link = parseTaskEventLink(task.remarks || "");
    if (link?.kind === "reminder" && link.eventId === event.id) return task;
  }

  const filingDeadline = event.filingDeadline?.trim();
  if (!filingDeadline) return null;

  const matchingEvents = items.filter(
    (candidate) =>
      candidate.source === "Event" &&
      isOpenFilingEvent(candidate) &&
      sameClientCase(candidate, event) &&
      candidate.filingDeadline === filingDeadline
  );
  if (matchingEvents.length !== 1 || matchingEvents[0].id !== event.id) return null;

  const legacyCandidates = items.filter(
    (task) =>
      task.source === "Task" &&
      looksLikePrepReminderTask(task) &&
      !parseTaskEventLink(task.remarks || "") &&
      sameClientCase(task, event) &&
      parseFilingDeadlineFromPrepText(task.details || "") === filingDeadline
  );
  if (legacyCandidates.length === 1) return legacyCandidates[0];

  return null;
}

/** Find the filing event for a prep reminder task — direct link, reverse link, or client/deadline match. */
export function resolveFilingEventForPrepTask(task: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  if (task.source !== "Task") return null;

  const direct = parseTaskEventLink(task.remarks || "");
  if (direct?.kind === "reminder") {
    const linked = items.find((item) => item.source === "Event" && item.id === direct.eventId);
    if (linked) return linked;
  }

  for (const event of items) {
    if (event.source !== "Event") continue;
    if (parseEventTaskLinks(event.remarks).reminderTaskId !== task.id) continue;
    if (prepTaskConfirmsEventLink(task, event.id)) return event;
  }

  if (!looksLikePrepReminderTask(task)) return null;

  const deadlineHint = parseFilingDeadlineFromPrepText(task.details || "");
  if (!deadlineHint) return null;

  const candidates = items.filter(
    (event) =>
      event.source === "Event" &&
      isOpenFilingEvent(event) &&
      sameClientCase(task, event) &&
      event.filingDeadline === deadlineHint
  );

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  return null;
}

export function enrichEventFormFromPrepTask(form: EventFormInput, task: OfficeItem): EventFormInput {
  const parsed = parsePrepTaskDescription(task.details || "");
  return {
    ...form,
    pleadingType: form.pleadingType?.trim() || parsed.pleadingType,
    pleadingCaseNature: form.pleadingCaseNature?.trim() || parsed.pleadingCaseNature
  };
}

export function prepTaskLinkMarkers(eventId: string, taskId: string): { taskMarkers: string[]; eventMarkers: string[] } {
  return {
    taskMarkers: [eventReminderMarker(eventId)],
    eventMarkers: [linkedReminderTaskMarker(taskId)]
  };
}
