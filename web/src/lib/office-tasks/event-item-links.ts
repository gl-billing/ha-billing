/** Markers linking events and auto-created tasks (stored in Remarks). */

const FOLLOWUP_RE = /EVENT_FOLLOWUP:([A-Z0-9-]+)/i;
const REMINDER_RE = /EVENT_REMINDER:([A-Z0-9-]+)/i;
const LINKED_FOLLOWUP_RE = /LINKED_FOLLOWUP_TASK:([A-Z0-9-]+)/i;
const LINKED_REMINDER_RE = /LINKED_REMINDER_TASK:([A-Z0-9-]+)/i;
const PTO_BATCH_RE = /PTO_BATCH:([A-Z0-9-]+)/i;
const PLEADING_CASE_RE = /PLEADING_CASE:(Civil\/Administrative|Criminal|Civil|Administrative)/i;
const PREP_ASSIGNEE_RE = /PREP_ASSIGNEE:([^\n]+)/i;
const EVENT_BILLING_APPEARANCE_RE = /EVENT_BILLING:APPEARANCE:([A-Z0-9-]+)/i;
const EVENT_BILLING_PLEADING_RE = /EVENT_BILLING:PLEADING:([A-Z0-9-]+)/i;
const POST_HEARING_RE = /POST_HEARING_FOLLOWUP:([A-Z0-9-]+)/i;
const FILE_PROOF_RE = /FILE_PROOF_TASK:([A-Z0-9-]+)/i;
const COURT_CONFIRM_RE = /COURT_CONFIRM:([A-Z0-9-]+)/i;
const LINKED_COURT_CONFIRM_RE = /LINKED_COURT_CONFIRM_TASK:([A-Z0-9-]+)/i;

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

export function eventBillingAppearanceMarker(eventId: string): string {
  return `EVENT_BILLING:APPEARANCE:${eventId}`;
}

export function eventBillingPleadingMarker(eventId: string): string {
  return `EVENT_BILLING:PLEADING:${eventId}`;
}

export function hasEventBillingAppearanceMarker(remarks: string): boolean {
  return EVENT_BILLING_APPEARANCE_RE.test(remarks);
}

export function hasEventBillingPleadingMarker(remarks: string): boolean {
  return EVENT_BILLING_PLEADING_RE.test(remarks);
}

export function courtConfirmTaskMarker(eventId: string): string {
  return `COURT_CONFIRM:${eventId}`;
}

export function linkedCourtConfirmTaskMarker(taskId: string): string {
  return `LINKED_COURT_CONFIRM_TASK:${taskId}`;
}

export function postHearingFollowUpMarker(eventId: string): string {
  return `POST_HEARING_FOLLOWUP:${eventId}`;
}

export function postHearingFollowUpDoneMarker(eventId: string): string {
  return `POST_HEARING_FOLLOWUP_DONE:${eventId}`;
}

export function fileProofTaskMarker(eventId: string): string {
  return `FILE_PROOF_TASK:${eventId}`;
}

export function fileProofPendingMarker(eventId: string): string {
  return `FILE_PROOF_PENDING:${eventId}`;
}

export function fileProofDoneMarker(eventId: string): string {
  return `FILE_PROOF_DONE:${eventId}`;
}

export function hasFileProofPending(remarks: string, eventId: string): boolean {
  const marker = fileProofPendingMarker(eventId).toUpperCase();
  return String(remarks || "").toUpperCase().includes(marker);
}

export function hasFileProofDone(remarks: string, eventId: string): boolean {
  const marker = fileProofDoneMarker(eventId).toUpperCase();
  return String(remarks || "").toUpperCase().includes(marker);
}

export function preHearingBriefSentMarker(eventId: string): string {
  return `PRE_HEARING_BRIEF_SENT:${eventId}`;
}

export function parseCourtConfirmEventId(remarks: string): string | null {
  return remarks.match(COURT_CONFIRM_RE)?.[1] || null;
}

export function parsePostHearingEventId(remarks: string): string | null {
  return remarks.match(POST_HEARING_RE)?.[1] || null;
}

export function hasPostHearingFollowUpDone(remarks: string, eventId: string): boolean {
  const marker = postHearingFollowUpDoneMarker(eventId).toUpperCase();
  return String(remarks || "").toUpperCase().includes(marker);
}

export function parseFileProofEventId(remarks: string): string | null {
  return remarks.match(FILE_PROOF_RE)?.[1] || null;
}

export function hasPreHearingBriefSent(remarks: string, eventId: string): boolean {
  const marker = preHearingBriefSentMarker(eventId).toUpperCase();
  return String(remarks || "").toUpperCase().includes(marker);
}

export function prepNudgeSentMarker(eventId: string, sentOnYmd: string): string {
  return `PREP_NUDGE_SENT:${eventId}:${sentOnYmd}`;
}

export function hasPrepNudgeSentForDate(remarks: string, eventId: string, sentOnYmd: string): boolean {
  const marker = prepNudgeSentMarker(eventId, sentOnYmd).toUpperCase();
  return String(remarks || "").toUpperCase().includes(marker);
}

export function postHearingOutcomeWarningSentMarker(eventId: string, sentOnYmd: string): string {
  return `POST_HEARING_WARN_SENT:${eventId}:${sentOnYmd}`;
}

export function hasPostHearingOutcomeWarningSentForDate(
  remarks: string,
  eventId: string,
  sentOnYmd: string
): boolean {
  const marker = postHearingOutcomeWarningSentMarker(eventId, sentOnYmd).toUpperCase();
  return String(remarks || "").toUpperCase().includes(marker);
}

export function parsePrepAssignee(remarks: string): string {
  return remarks.match(PREP_ASSIGNEE_RE)?.[1]?.trim() || "";
}

export type EventTaskLinks = {
  followUpTaskId?: string;
  reminderTaskId?: string;
  courtConfirmTaskId?: string;
};

export type TaskEventLink = {
  eventId: string;
  kind: "followUp" | "reminder";
};

export function parseEventTaskLinks(remarks: string): EventTaskLinks {
  return {
    followUpTaskId: remarks.match(LINKED_FOLLOWUP_RE)?.[1],
    reminderTaskId: remarks.match(LINKED_REMINDER_RE)?.[1],
    courtConfirmTaskId: remarks.match(LINKED_COURT_CONFIRM_RE)?.[1]
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
    .replace(/\n?EVENT_BILLING:APPEARANCE:[A-Z0-9-]+/gi, "")
    .replace(/\n?EVENT_BILLING:PLEADING:[A-Z0-9-]+/gi, "")
    .replace(/\n?PREP_DONE_NOTICE:[^\n]+/gi, "")
    .replace(/\n?PREP_READY:[^\n]+/gi, "")
    .replace(/\n?COURT_CONFIRM:[A-Z0-9-]+/gi, "")
    .replace(/\n?LINKED_COURT_CONFIRM_TASK:[A-Z0-9-]+/gi, "")
    .replace(/\n?POST_HEARING_FOLLOWUP:[A-Z0-9-]+/gi, "")
    .replace(/\n?POST_HEARING_FOLLOWUP_DONE:[A-Z0-9-]+/gi, "")
    .replace(/\n?NEXT_SETTING_FOLLOWUP:[A-Z0-9-]+/gi, "")
    .replace(/\n?OUTCOME_FOLLOWUP:(none|next_hearing|submission|other):[A-Z0-9-]+/gi, "")
    .replace(/\n?EVENT_OUTCOME:(completed|rescheduled|postponed|cancelled)/gi, "")
    .replace(/\n?EVENT_OUTCOME_NOTE:[^\n]+/gi, "")
    .replace(/\n?HEARING_OUTCOME_NOTE:[^\n]+/gi, "")
    .replace(/\n?FILE_PROOF_TASK:[A-Z0-9-]+/gi, "")
    .replace(/\n?FILE_PROOF_PENDING:[A-Z0-9-]+/gi, "")
    .replace(/\n?FILE_PROOF_DONE:[A-Z0-9-]+/gi, "")
    .replace(/\n?PRE_HEARING_BRIEF_SENT:[A-Z0-9-]+/gi, "")
    .replace(/\n?PREP_NUDGE_SENT:[A-Z0-9-]+:\d{4}-\d{2}-\d{2}/gi, "")
    .replace(/\n?POST_HEARING_WARN_SENT:[A-Z0-9-]+:\d{4}-\d{2}-\d{2}/gi, "")
    .trim();
}
