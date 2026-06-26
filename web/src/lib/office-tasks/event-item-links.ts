/** Markers linking events and auto-created tasks (stored in Remarks). */

const FOLLOWUP_RE = /EVENT_FOLLOWUP:([A-Z0-9-]+)/i;
const REMINDER_RE = /EVENT_REMINDER:([A-Z0-9-]+)/i;
const LINKED_FOLLOWUP_RE = /LINKED_FOLLOWUP_TASK:([A-Z0-9-]+)/i;
const LINKED_REMINDER_RE = /LINKED_REMINDER_TASK:([A-Z0-9-]+)/i;
const PTO_BATCH_RE = /PTO_BATCH:([A-Z0-9-]+)/i;
const PLEADING_CASE_RE = /PLEADING_CASE:(Civil\/Administrative|Criminal|Civil|Administrative)/i;
const PREP_ASSIGNEE_RE = /PREP_ASSIGNEE:([^\n]+)/i;

export function ptoBatchMarker(batchId: string): string {
  return `PTO_BATCH:${batchId}`;
}

export function parsePtoBatchId(remarks: string): string | null {
  return remarks.match(PTO_BATCH_RE)?.[1] || null;
}

export function eventFollowUpMarker(eventId: string): string {
  return `EVENT_FOLLOWUP:${eventId}`;
}

export function eventReminderMarker(eventId: string): string {
  return `EVENT_REMINDER:${eventId}`;
}

export function linkedFollowUpTaskMarker(taskId: string): string {
  return `LINKED_FOLLOWUP_TASK:${taskId}`;
}

export function linkedReminderTaskMarker(taskId: string): string {
  return `LINKED_REMINDER_TASK:${taskId}`;
}

export function prepAssigneeMarker(assignees: string): string {
  const value = String(assignees || "").trim();
  return value ? `PREP_ASSIGNEE:${value}` : "";
}

export function parsePrepAssignee(remarks: string): string {
  return remarks.match(PREP_ASSIGNEE_RE)?.[1]?.trim() || "";
}

export type EventTaskLinks = {
  followUpTaskId?: string;
  reminderTaskId?: string;
};

export type TaskEventLink = {
  eventId: string;
  kind: "followUp" | "reminder";
};

export function parseEventTaskLinks(remarks: string): EventTaskLinks {
  return {
    followUpTaskId: remarks.match(LINKED_FOLLOWUP_RE)?.[1],
    reminderTaskId: remarks.match(LINKED_REMINDER_RE)?.[1]
  };
}

export function parseTaskEventLink(remarks: string): TaskEventLink | null {
  const followUp = remarks.match(FOLLOWUP_RE)?.[1];
  if (followUp) return { eventId: followUp, kind: "followUp" };
  const reminder = remarks.match(REMINDER_RE)?.[1];
  if (reminder) return { eventId: reminder, kind: "reminder" };
  return null;
}

/** When a task row has an explicit event marker, it must match the expected event. */
export function taskConfirmsEventLink(
  remarks: string,
  eventId: string,
  kind: "followUp" | "reminder"
): boolean {
  const direct = parseTaskEventLink(remarks);
  if (!direct || direct.kind !== kind) return true;
  return direct.eventId === eventId;
}

export function pleadingCaseNatureMarker(nature: string): string {
  return `PLEADING_CASE:${nature}`;
}

export function parsePleadingCaseNature(remarks: string): string {
  const value = remarks.match(PLEADING_CASE_RE)?.[1] || "";
  if (!value) return "";
  if (value === "Civil" || value.toLowerCase() === "administrative") return "Civil/Administrative";
  if (value === "Criminal") return "Criminal";
  return value;
}

export function setPleadingCaseNatureMarker(remarks: string, nature: string): string {
  const stripped = String(remarks || "")
    .replace(/\n?PLEADING_CASE:(Civil\/Administrative|Criminal|Civil|Administrative)/gi, "")
    .trim();
  const normalized = String(nature || "").trim();
  if (!normalized) return stripped;
  const marker = pleadingCaseNatureMarker(normalized);
  return stripped ? `${stripped}\n${marker}` : marker;
}

export function appendRemarkMarkers(remarks: string, markers: string[]): string {
  let next = String(remarks || "").trim();
  for (const marker of markers) {
    if (!marker) continue;
    if (next.toUpperCase().includes(marker.toUpperCase())) continue;
    next = next ? `${next}\n${marker}` : marker;
  }
  return next;
}

/** Hide internal link markers in user-facing remark text. */
export function displayEventRemarks(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?EVENT_FOLLOWUP:[A-Z0-9-]+/gi, "")
    .replace(/\n?EVENT_REMINDER:[A-Z0-9-]+/gi, "")
    .replace(/\n?LINKED_FOLLOWUP_TASK:[A-Z0-9-]+/gi, "")
    .replace(/\n?LINKED_REMINDER_TASK:[A-Z0-9-]+/gi, "")
    .replace(/\n?PTO_BATCH:[A-Z0-9-]+/gi, "")
    .replace(/\n?PTO_SESSION:[^\n]+/gi, "")
    .replace(/\n?PLEADING_CASE:(Civil\/Administrative|Criminal|Civil|Administrative)/gi, "")
    .replace(/\n?PREP_CHECKLIST:\{[^\n]+\}/gi, "")
    .replace(/\n?PREP_ASSIGNEE:[^\n]+/gi, "")
    .replace(/\n?PREP_DONE_NOTICE:[^\n]+/gi, "")
    .trim();
}
