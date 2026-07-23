/** Remark markers linking letter draft and serve tasks (and optional field dispatch). */

const LINKED_SERVE_RE = /LINKED_SERVE_TASK:([A-Z0-9-]+)/i;
const LINKED_DRAFT_RE = /LINKED_DRAFT_TASK:([A-Z0-9-]+)/i;
const FIELD_DISPATCH_LINK_RE = /FIELD_DISPATCH:([A-Z0-9-]+)/i;
const DOC_DONE_RE = /DOC_DONE:([^:\n]+):(\d{4}-\d{2}-\d{2})/i;

export const LETTER_DRAFT_MARKER = "LETTER_DRAFT";
export const LETTER_SERVE_MARKER = "LETTER_SERVE";

export function letterDraftMarker(): string {
  return LETTER_DRAFT_MARKER;
}

export function letterServeMarker(): string {
  return LETTER_SERVE_MARKER;
}

export function linkedServeTaskMarker(taskId: string): string {
  return `LINKED_SERVE_TASK:${taskId}`;
}

export function linkedDraftTaskMarker(taskId: string): string {
  return `LINKED_DRAFT_TASK:${taskId}`;
}

export function fieldDispatchLinkMarker(dispatchId: string): string {
  return `FIELD_DISPATCH:${dispatchId}`;
}

export function docDoneMarker(staffName: string, dateYmd: string): string {
  const name = String(staffName || "Staff").trim().replace(/[\n:]/g, " ") || "Staff";
  return `DOC_DONE:${name}:${dateYmd}`;
}

export function parseLinkedServeTaskId(remarks: string): string | null {
  return remarks.match(LINKED_SERVE_RE)?.[1] || null;
}

export function parseLinkedDraftTaskId(remarks: string): string | null {
  return remarks.match(LINKED_DRAFT_RE)?.[1] || null;
}

export function parseFieldDispatchLinkId(remarks: string): string | null {
  return remarks.match(FIELD_DISPATCH_LINK_RE)?.[1] || null;
}

export function parseDocDoneMarker(remarks: string): { staffName: string; dateYmd: string } | null {
  const match = String(remarks || "").match(DOC_DONE_RE);
  if (!match) return null;
  return { staffName: match[1].trim(), dateYmd: match[2].trim() };
}

export function hasLetterDraftMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(LETTER_DRAFT_MARKER);
}

export function hasLetterServeMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(LETTER_SERVE_MARKER);
}

export function isDocDoneLetterDraft(item: {
  source?: string;
  category?: string;
  remarks?: string;
  done?: boolean;
}): boolean {
  if (item.source !== "Task" || item.done) return false;
  if (!hasLetterDraftMarker(item.remarks || "")) return false;
  return Boolean(parseDocDoneMarker(item.remarks || ""));
}

export function clearDocDoneMarker(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?DOC_DONE:[^\n]+/gi, "")
    .trim();
}
