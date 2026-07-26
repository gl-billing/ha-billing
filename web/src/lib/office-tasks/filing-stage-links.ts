/** Remark markers linking Court Filing stage tasks (drafting → exhibits → serve). */

const FILING_DRAFT_TASK_RE = /FILING_DRAFT_TASK:([A-Z0-9-]+)/i;
const FILING_EXHIBITS_TASK_RE = /FILING_EXHIBITS_TASK:([A-Z0-9-]+)/i;
const FILING_SERVE_TASK_RE = /FILING_SERVE_TASK:([A-Z0-9-]+)/i;

export const FILING_STAGE_DRAFTING = "FILING_STAGE_DRAFTING";
export const FILING_STAGE_EXHIBITS = "FILING_STAGE_EXHIBITS";
export const FILING_STAGE_SERVING = "FILING_STAGE_SERVING";

export const FILING_DRAFTING_TASK_TYPE = "Drafting";
export const FILING_EXHIBITS_TASK_TYPE = "Exhibits & compile";
export const FILING_SERVING_TASK_TYPE = "Serving";

export function filingDraftTaskMarker(taskId: string): string {
  return `FILING_DRAFT_TASK:${taskId}`;
}

export function filingExhibitsTaskMarker(taskId: string): string {
  return `FILING_EXHIBITS_TASK:${taskId}`;
}

export function filingServeTaskMarker(taskId: string): string {
  return `FILING_SERVE_TASK:${taskId}`;
}

export function filingStageDraftingMarker(): string {
  return FILING_STAGE_DRAFTING;
}

export function filingStageExhibitsMarker(): string {
  return FILING_STAGE_EXHIBITS;
}

export function filingStageServingMarker(): string {
  return FILING_STAGE_SERVING;
}

export function parseFilingDraftTaskId(remarks: string): string | null {
  return remarks.match(FILING_DRAFT_TASK_RE)?.[1] || null;
}

export function parseFilingExhibitsTaskId(remarks: string): string | null {
  return remarks.match(FILING_EXHIBITS_TASK_RE)?.[1] || null;
}

export function parseFilingServeTaskId(remarks: string): string | null {
  return remarks.match(FILING_SERVE_TASK_RE)?.[1] || null;
}

export function hasFilingStageDraftingMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_DRAFTING);
}

export function hasFilingStageExhibitsMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_EXHIBITS);
}

export function hasFilingStageServingMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_SERVING);
}

export function isFilingDraftingStageTask(item: {
  source?: string;
  category?: string;
  remarks?: string;
}): boolean {
  if (item.source !== "Task") return false;
  if (String(item.category || "").trim() === FILING_DRAFTING_TASK_TYPE) {
    return hasFilingStageDraftingMarker(item.remarks || "") || Boolean(parseTaskEventReminderId(item.remarks || ""));
  }
  return hasFilingStageDraftingMarker(item.remarks || "");
}

export function isFilingExhibitsStageTask(item: {
  source?: string;
  category?: string;
  remarks?: string;
}): boolean {
  if (item.source !== "Task") return false;
  if (String(item.category || "").trim() === FILING_EXHIBITS_TASK_TYPE) return true;
  return hasFilingStageExhibitsMarker(item.remarks || "");
}

export function isFilingServingStageTask(item: {
  source?: string;
  category?: string;
  remarks?: string;
}): boolean {
  if (item.source !== "Task") return false;
  if (String(item.category || "").trim() === FILING_SERVING_TASK_TYPE) return true;
  return hasFilingStageServingMarker(item.remarks || "");
}

function parseTaskEventReminderId(remarks: string): string | null {
  return remarks.match(/EVENT_REMINDER:([A-Z0-9-]+)/i)?.[1] || null;
}

/** Short label for All items ledger Stage column (filing pipeline). */
export function ledgerFilingStageLabel(item: {
  source?: string;
  category?: string;
  remarks?: string;
  pleadingType?: string | null;
}): string {
  if (isFilingDraftingStageTask(item)) return "Drafting";
  if (isFilingExhibitsStageTask(item)) return "Exhibits";
  if (isFilingServingStageTask(item)) return "Serving";
  if (item.source === "Event") {
    const category = String(item.category || "").trim();
    if (
      category === "Court Filing" ||
      category === "Deadline" ||
      category === "Submission" ||
      Boolean(String(item.pleadingType || "").trim())
    ) {
      return "Filing";
    }
  }
  if (item.source === "Task" && String(item.category || "").trim().toLowerCase() === "filing prep") {
    return "Prep";
  }
  return "";
}
