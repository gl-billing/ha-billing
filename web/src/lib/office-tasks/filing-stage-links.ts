/** Remark markers linking Court Filing stage tasks (drafting → … → proof). */

const FILING_DRAFT_TASK_RE = /FILING_DRAFT_TASK:([A-Z0-9-]+)/i;
const FILING_REVIEW_TASK_RE = /FILING_REVIEW_TASK:([A-Z0-9-]+)/i;
const FILING_EXHIBITS_TASK_RE = /FILING_EXHIBITS_TASK:([A-Z0-9-]+)/i;
const FILING_FILING_TASK_RE = /FILING_FILING_TASK:([A-Z0-9-]+)/i;
const FILING_SERVE_TASK_RE = /FILING_SERVE_TASK:([A-Z0-9-]+)/i;
const FILING_PROOF_TASK_RE = /FILING_PROOF_TASK:([A-Z0-9-]+)/i;

export const FILING_STAGE_DRAFTING = "FILING_STAGE_DRAFTING";
export const FILING_STAGE_REVIEW = "FILING_STAGE_REVIEW";
export const FILING_STAGE_EXHIBITS = "FILING_STAGE_EXHIBITS";
export const FILING_STAGE_FILING = "FILING_STAGE_FILING";
export const FILING_STAGE_SERVING = "FILING_STAGE_SERVING";
export const FILING_STAGE_PROOF = "FILING_STAGE_PROOF";

export const FILING_DRAFTING_TASK_TYPE = "Drafting";
export const FILING_REVIEW_TASK_TYPE = "Review";
export const FILING_REVIEW_APPROVAL_TASK_TYPE = "Review & Approval";
export const FILING_EXHIBITS_TASK_TYPE = "Exhibits & compile";
export const FILING_FILING_TASK_TYPE = "Filing";
export const FILING_SERVING_TASK_TYPE = "Serving";
export const FILING_PROOF_TASK_TYPE = "Proof upload";

export function filingDraftTaskMarker(taskId: string): string {
  return `FILING_DRAFT_TASK:${taskId}`;
}

export function filingReviewTaskMarker(taskId: string): string {
  return `FILING_REVIEW_TASK:${taskId}`;
}

export function filingExhibitsTaskMarker(taskId: string): string {
  return `FILING_EXHIBITS_TASK:${taskId}`;
}

export function filingFilingTaskMarker(taskId: string): string {
  return `FILING_FILING_TASK:${taskId}`;
}

export function filingServeTaskMarker(taskId: string): string {
  return `FILING_SERVE_TASK:${taskId}`;
}

export function filingProofTaskMarker(taskId: string): string {
  return `FILING_PROOF_TASK:${taskId}`;
}

export function filingStageDraftingMarker(): string {
  return FILING_STAGE_DRAFTING;
}

export function filingStageReviewMarker(): string {
  return FILING_STAGE_REVIEW;
}

export function filingStageExhibitsMarker(): string {
  return FILING_STAGE_EXHIBITS;
}

export function filingStageFilingMarker(): string {
  return FILING_STAGE_FILING;
}

export function filingStageServingMarker(): string {
  return FILING_STAGE_SERVING;
}

export function filingStageProofMarker(): string {
  return FILING_STAGE_PROOF;
}

export function parseFilingDraftTaskId(remarks: string): string | null {
  return remarks.match(FILING_DRAFT_TASK_RE)?.[1] || null;
}

export function parseFilingReviewTaskId(remarks: string): string | null {
  return remarks.match(FILING_REVIEW_TASK_RE)?.[1] || null;
}

export function parseFilingExhibitsTaskId(remarks: string): string | null {
  return remarks.match(FILING_EXHIBITS_TASK_RE)?.[1] || null;
}

export function parseFilingFilingTaskId(remarks: string): string | null {
  return remarks.match(FILING_FILING_TASK_RE)?.[1] || null;
}

export function parseFilingServeTaskId(remarks: string): string | null {
  return remarks.match(FILING_SERVE_TASK_RE)?.[1] || null;
}

export function parseFilingProofTaskId(remarks: string): string | null {
  return remarks.match(FILING_PROOF_TASK_RE)?.[1] || null;
}

export function hasFilingStageDraftingMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_DRAFTING);
}

export function hasFilingStageReviewMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_REVIEW);
}

export function hasFilingStageExhibitsMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_EXHIBITS);
}

export function hasFilingStageFilingMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_FILING);
}

export function hasFilingStageServingMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_SERVING);
}

export function hasFilingStageProofMarker(remarks: string): boolean {
  return String(remarks || "").toUpperCase().includes(FILING_STAGE_PROOF);
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

export function isFilingReviewStageTask(item: {
  source?: string;
  category?: string;
  remarks?: string;
}): boolean {
  if (item.source !== "Task") return false;
  const category = String(item.category || "").trim();
  if (category === FILING_REVIEW_TASK_TYPE || category === FILING_REVIEW_APPROVAL_TASK_TYPE) {
    return true;
  }
  return hasFilingStageReviewMarker(item.remarks || "");
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

export function isFilingFilingStageTask(item: {
  source?: string;
  category?: string;
  remarks?: string;
}): boolean {
  if (item.source !== "Task") return false;
  if (String(item.category || "").trim() === FILING_FILING_TASK_TYPE) {
    return hasFilingStageFilingMarker(item.remarks || "");
  }
  return hasFilingStageFilingMarker(item.remarks || "");
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

export function isFilingProofStageTask(item: {
  source?: string;
  category?: string;
  remarks?: string;
}): boolean {
  if (item.source !== "Task") return false;
  if (String(item.category || "").trim() === FILING_PROOF_TASK_TYPE) return true;
  return hasFilingStageProofMarker(item.remarks || "");
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
  if (isFilingReviewStageTask(item)) return "Review";
  if (isFilingExhibitsStageTask(item)) return "Exhibits";
  if (isFilingFilingStageTask(item)) return "File";
  if (isFilingServingStageTask(item)) return "Serving";
  if (isFilingProofStageTask(item)) return "Proof";
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
