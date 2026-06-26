import { parseClientCaseDisplay } from "@/lib/office-tasks/client-case-identity";
import { resolveEntryRegistrarLabel } from "@/lib/office-tasks/entry-created-by";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { formatScheduleTimeRange } from "@/lib/office-tasks/schedule-email-ui";

export type DuplicateEntryMatch = {
  source: "Task" | "Event";
  id: string;
  clientCase: string;
  clientName: string;
  category: string;
  date: string;
  timeLabel: string;
  registeredBy: string;
};

export type TaskDuplicateDraft = {
  clientCase: string;
  taskType: string;
  dueDate: string;
  dueTime?: string;
};

export type EventDuplicateDraft = {
  clientCase: string;
  category: string;
  eventDate?: string;
  filingDeadline?: string;
  startTime?: string;
};

function normalizeLabel(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeClientName(clientCase: string): string {
  return normalizeLabel(parseClientCaseDisplay(clientCase).title);
}

export function normalizeEntryTime(value: string | null | undefined): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  const match24 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = Number(match24[1]);
    const minutes = match24[2];
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, "0")}:${minutes}`;
    }
  }

  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = match12[2];
    const meridiem = match12[3];
    if (hours === 12) hours = 0;
    if (meridiem === "pm") hours += 12;
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, "0")}:${minutes}`;
    }
  }

  return normalizeLabel(raw);
}

function eventPrimaryDate(item: Pick<OfficeItem, "eventDate" | "filingDeadline" | "date">): string {
  return String(item.eventDate || item.filingDeadline || item.date || "").trim();
}

function toDuplicateMatch(item: OfficeItem): DuplicateEntryMatch {
  const clientName = parseClientCaseDisplay(item.clientCase).title || item.clientCase;
  const date =
    item.source === "Task"
      ? String(item.date || "").trim()
      : eventPrimaryDate(item);
  const timeLabel = formatScheduleTimeRange(item.startTime, item.endTime) || "all day";

  return {
    source: item.source,
    id: item.id,
    clientCase: item.clientCase,
    clientName,
    category: item.category,
    date,
    timeLabel,
    registeredBy: resolveEntryRegistrarLabel(item)
  };
}

export function findDuplicateTask(
  items: OfficeItem[],
  draft: TaskDuplicateDraft
): DuplicateEntryMatch | null {
  const clientName = normalizeClientName(draft.clientCase);
  const taskType = normalizeLabel(draft.taskType);
  const dueDate = String(draft.dueDate || "").trim();
  const dueTime = normalizeEntryTime(draft.dueTime);
  if (!clientName || !taskType || !dueDate) return null;

  for (const item of items) {
    if (item.source !== "Task") continue;
    if (normalizeClientName(item.clientCase) !== clientName) continue;
    if (normalizeLabel(item.category) !== taskType) continue;
    if (String(item.date || "").trim() !== dueDate) continue;
    if (normalizeEntryTime(item.startTime) !== dueTime) continue;
    return toDuplicateMatch(item);
  }

  return null;
}

export function findDuplicateEvent(
  items: OfficeItem[],
  draft: EventDuplicateDraft
): DuplicateEntryMatch | null {
  const clientName = normalizeClientName(draft.clientCase);
  const category = normalizeLabel(draft.category);
  const eventDate = String(draft.eventDate || draft.filingDeadline || "").trim();
  const startTime = normalizeEntryTime(draft.startTime);
  if (!clientName || !category || !eventDate) return null;

  for (const item of items) {
    if (item.source !== "Event") continue;
    if (normalizeClientName(item.clientCase) !== clientName) continue;
    if (normalizeLabel(item.category) !== category) continue;
    if (eventPrimaryDate(item) !== eventDate) continue;
    if (normalizeEntryTime(item.startTime) !== startTime) continue;
    return toDuplicateMatch(item);
  }

  return null;
}

export function duplicateEntryKindLabel(match: DuplicateEntryMatch): string {
  return match.source === "Task" ? "task" : "event";
}

export function duplicateEntryWarningMessage(match: DuplicateEntryMatch): string {
  const kind = duplicateEntryKindLabel(match);
  const timePart = match.timeLabel === "all day" ? " (all day)" : ` at ${match.timeLabel}`;
  return `A ${match.category} ${kind} for ${match.clientName} on ${match.date}${timePart} was already registered by ${match.registeredBy}.`;
}
