/** Hidden marker in Remarks so Waiting/Started survive sheet auto-Overdue scripts. */

export type FollowUpMarker = "Waiting" | "Started";

const MARKER_RE = /GL_FOLLOW_UP:(Waiting|Started)/i;

export function getFollowUpFromRemarks(remarks: string): FollowUpMarker | null {
  const match = String(remarks || "").match(MARKER_RE);
  if (!match) return null;
  const value = match[1].toLowerCase();
  return value === "started" ? "Started" : "Waiting";
}

export function applyFollowUpMarker(remarks: string, status: FollowUpMarker): string {
  const base = clearFollowUpMarker(remarks).trimEnd();
  const marker = `GL_FOLLOW_UP:${status}`;
  return base ? `${base}\n${marker}` : marker;
}

const INTERNAL_REMARK_LINE_RES = [
  /^GL_FOLLOW_UP:/i,
  /^EVENT_FOLLOWUP:/i,
  /^EVENT_REMINDER:/i,
  /^LINKED_FOLLOWUP_TASK:/i,
  /^LINKED_REMINDER_TASK:/i,
  /^PTO_BATCH:/i,
  /^PTO_SESSION:/i,
  /^PREP_CHECKLIST:/i,
  /^PLEADING_CASE:/i,
  /^BILLING_TRIGGER:/i
];

function isInternalRemarkLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return INTERNAL_REMARK_LINE_RES.some((re) => re.test(trimmed));
}

/** Split user-visible note from hidden remark markers (checklists, links, etc.). */
export function splitRemarksForFollowUp(remarks: string): { userText: string; internalLines: string[] } {
  const withoutFollowUp = clearFollowUpMarker(remarks);
  const internalLines: string[] = [];
  const userLines: string[] = [];

  for (const line of String(withoutFollowUp || "").split("\n")) {
    if (isInternalRemarkLine(line)) internalLines.push(line.trim());
    else if (line.trim()) userLines.push(line.trimEnd());
  }

  return { userText: userLines.join("\n").trim(), internalLines };
}

/** Apply Waiting/Started marker and optional user note, preserving other internal markers. */
export function applyFollowUpWithNote(
  remarks: string,
  status: FollowUpMarker,
  note?: string
): string {
  const { userText, internalLines } = splitRemarksForFollowUp(remarks);
  const nextUser = note !== undefined ? note.trim() : userText;
  const body = [...(nextUser ? [nextUser] : []), ...internalLines].join("\n");
  return applyFollowUpMarker(body, status);
}

export function clearFollowUpMarker(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?GL_FOLLOW_UP:(Waiting|Started)/gi, "")
    .trim();
}

/** Hide internal follow-up marker in UI. */
export function displayRemarks(remarks: string): string {
  return clearFollowUpMarker(remarks)
    .replace(/\n?EVENT_FOLLOWUP:[A-Z0-9-]+/gi, "")
    .replace(/\n?EVENT_REMINDER:[A-Z0-9-]+/gi, "")
    .replace(/\n?LINKED_FOLLOWUP_TASK:[A-Z0-9-]+/gi, "")
    .replace(/\n?LINKED_REMINDER_TASK:[A-Z0-9-]+/gi, "")
    .replace(/\n?PTO_BATCH:[A-Z0-9-]+/gi, "")
    .replace(/\n?PTO_SESSION:[^\n]+/gi, "")
    .replace(/\n?PREP_CHECKLIST:\{[^\n]+\}/gi, "")
    .replace(/\n?PLEADING_CASE:(Civil\/Administrative|Criminal|Civil|Administrative)/gi, "")
    .trim();
}

/** Prefer marker when sheet Status was overwritten to Overdue / In Progress. */
export function resolveEffectiveStatus(
  status: string,
  remarks: string,
  done: boolean
): string {
  if (done) return status;
  const followUp = getFollowUpFromRemarks(remarks);
  if (!followUp) return status;
  const normalized = status.trim();
  if (
    normalized === "Overdue" ||
    normalized === "In Progress" ||
    normalized === "Scheduled" ||
    !normalized
  ) {
    return followUp;
  }
  return status;
}
