/**
 * Filing workflow remark markers — stable links across Event, stage tasks, and Filing tab.
 * filing_workflow_id === event_id (reuse Event ID; do not invent a parallel ID).
 * Pleading identity today = event_id + pleadingType (no separate pleading sheet yet).
 */

const FILING_WORKFLOW_STAGE_RE = /FILING_WORKFLOW_STAGE:([a-z0-9_-]+)/i;
const FILING_DRAFT_DOC_RE = /FILING_DRAFT_DOC:(\S+)/i;
const FILING_DRAFT_NOTE_RE = /FILING_DRAFT_NOTE:([^\n]+)/i;
const FILING_APPROVED_DOC_RE = /FILING_APPROVED_DOC:(\S+)/i;
const FILING_REVIEW_OUTCOME_RE = /FILING_REVIEW_OUTCOME:(approved|changes_requested)/i;
const FILING_REVIEWER_RE = /FILING_REVIEWER:([^\n]+)/i;
const FILING_APPROVED_AT_RE = /FILING_APPROVED_AT:(\S+)/i;
const FILING_REVISION_NOTE_RE = /FILING_REVISION_NOTE:([^\n]+)/i;
const FILING_COMPLETION_RE = /FILING_COMPLETION:([^|\n]+)/i;
const FILING_NOTIFY_DRAFTER_RE = /FILING_NOTIFY_DRAFTER:([^\n]+)/i;
const FILING_NOTIFY_FILER_RE = /FILING_NOTIFY_FILER:([^\n]+)/i;
const FILING_ROUTE_OVERRIDE_RE = /FILING_ROUTE_OVERRIDE:([^\n]+)/i;

export const FILING_WORKFLOW_STAGES = [
  "drafting",
  "awaiting_review",
  "revision_required",
  "documents_exhibits",
  "ready_for_filing",
  "filing_in_progress",
  "filed_service_pending",
  "filed_e_copy_pending",
  "filed_proof_pending",
  "completed",
  "setup_needed"
] as const;

export type FilingWorkflowStage = (typeof FILING_WORKFLOW_STAGES)[number];

export function filingWorkflowStageMarker(stage: FilingWorkflowStage): string {
  return `FILING_WORKFLOW_STAGE:${stage}`;
}

export function parseFilingWorkflowStage(remarks: string): FilingWorkflowStage | null {
  // Latest marker wins — event remarks accumulate history across setup / reopen cycles.
  const re = /FILING_WORKFLOW_STAGE:([a-z0-9_-]+)/gi;
  let match: RegExpExecArray | null;
  let raw = "";
  while ((match = re.exec(remarks)) !== null) {
    raw = match[1]?.toLowerCase() || "";
  }
  return (FILING_WORKFLOW_STAGES as readonly string[]).includes(raw)
    ? (raw as FilingWorkflowStage)
    : null;
}

/**
 * Remove stale workflow progress markers before a fresh setup or stage-task generation.
 * Preserves task ID links and draft doc URLs; strips outcomes and completion stamps.
 */
export function stripStaleFilingWorkflowProgressMarkers(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?FILING_REVIEW_OUTCOME:\S+/gi, "")
    .replace(/\n?FILING_REVIEWER:[^\n]+/gi, "")
    .replace(/\n?FILING_APPROVED_AT:\S+/gi, "")
    .replace(/\n?FILING_APPROVED_DOC:\S+/gi, "")
    .replace(/\n?FILING_REVISION_NOTE:[^\n]+/gi, "")
    .replace(/\n?FILING_STAGE_COMPLETED:(drafting|review|exhibits|filing|serving|proof):[^\n]+/gi, "")
    .replace(/\n?FILING_STAGE_RETURNED:(drafting|review|exhibits|filing|serving|proof):[^\n]+/gi, "")
    .replace(/\n?FILING_EXHIBITS_COMPLETED:[^\n]+/gi, "")
    .replace(/\n?FILING_EXHIBITS_SKIPPED:[^\n]+/gi, "")
    .replace(/\n?FILING_COMPLETION:[^|\n]+/gi, "")
    .trim();
}

export function replaceFilingWorkflowStage(remarks: string, stage: FilingWorkflowStage): string {
  const cleaned = String(remarks || "")
    .replace(/\n?FILING_WORKFLOW_STAGE:[a-z0-9_-]+/gi, "")
    .trim();
  return cleaned ? `${cleaned}\n${filingWorkflowStageMarker(stage)}` : filingWorkflowStageMarker(stage);
}

export function filingDraftDocMarker(url: string): string {
  const value = String(url || "").trim();
  return value ? `FILING_DRAFT_DOC:${value}` : "";
}

export function parseFilingDraftDocUrl(remarks: string): string | null {
  const match = remarks.match(FILING_DRAFT_DOC_RE)?.[1]?.trim();
  return match || null;
}

export function replaceFilingDraftDoc(remarks: string, url: string): string {
  const cleaned = String(remarks || "")
    .replace(/\n?FILING_DRAFT_DOC:\S+/gi, "")
    .replace(/\n?FILING_DRAFT_NOTE:[^\n]+/gi, "")
    .trim();
  const marker = filingDraftDocMarker(url);
  if (!marker) return cleaned;
  return cleaned ? `${cleaned}\n${marker}` : marker;
}

export function filingDraftNoteMarker(note: string): string {
  const value = String(note || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 400);
  return value ? `FILING_DRAFT_NOTE:${value}` : "";
}

export function parseFilingDraftNote(remarks: string): string | null {
  return remarks.match(FILING_DRAFT_NOTE_RE)?.[1]?.trim() || null;
}

/** Clear URL and/or store a free-text draft note (e.g. "Draft already sent via email"). */
export function replaceFilingDraftNote(remarks: string, note: string): string {
  const cleaned = String(remarks || "")
    .replace(/\n?FILING_DRAFT_DOC:\S+/gi, "")
    .replace(/\n?FILING_DRAFT_NOTE:[^\n]+/gi, "")
    .trim();
  const marker = filingDraftNoteMarker(note);
  if (!marker) return cleaned;
  return cleaned ? `${cleaned}\n${marker}` : marker;
}

/** Remove both draft URL and note markers (no link / no note). */
export function clearFilingDraftDocMarkers(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?FILING_DRAFT_DOC:\S+/gi, "")
    .replace(/\n?FILING_DRAFT_NOTE:[^\n]+/gi, "")
    .trim();
}

export function filingApprovedDocMarker(url: string): string {
  const value = String(url || "").trim();
  return value ? `FILING_APPROVED_DOC:${value}` : "";
}

export function parseFilingApprovedDocUrl(remarks: string): string | null {
  return remarks.match(FILING_APPROVED_DOC_RE)?.[1]?.trim() || null;
}

export function filingReviewOutcomeMarker(outcome: "approved" | "changes_requested"): string {
  return `FILING_REVIEW_OUTCOME:${outcome}`;
}

export function parseFilingReviewOutcome(
  remarks: string
): "approved" | "changes_requested" | null {
  const raw = remarks.match(FILING_REVIEW_OUTCOME_RE)?.[1]?.toLowerCase();
  if (raw === "approved" || raw === "changes_requested") return raw;
  return null;
}

export function filingReviewerMarker(name: string): string {
  const value = String(name || "").trim();
  return value ? `FILING_REVIEWER:${value}` : "";
}

export function filingApprovedAtMarker(isoOrYmd: string): string {
  const value = String(isoOrYmd || "").trim();
  return value ? `FILING_APPROVED_AT:${value}` : "";
}

export function filingRevisionNoteMarker(note: string): string {
  const value = String(note || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 400);
  return value ? `FILING_REVISION_NOTE:${value}` : "";
}

export function parseFilingRevisionNote(remarks: string): string | null {
  return remarks.match(FILING_REVISION_NOTE_RE)?.[1]?.trim() || null;
}

/** Strip and re-apply review outcome / approval metadata (keep draft doc versions). */
export function applyFilingReviewApprovalMarkers(
  remarks: string,
  input: { reviewer: string; approvedAt: string; approvedDocUrl?: string | null }
): string {
  let next = String(remarks || "")
    .replace(/\n?FILING_REVIEW_OUTCOME:\S+/gi, "")
    .replace(/\n?FILING_REVIEWER:[^\n]+/gi, "")
    .replace(/\n?FILING_APPROVED_AT:\S+/gi, "")
    .replace(/\n?FILING_APPROVED_DOC:\S+/gi, "")
    .trim();
  const markers = [
    filingReviewOutcomeMarker("approved"),
    filingReviewerMarker(input.reviewer),
    filingApprovedAtMarker(input.approvedAt),
    filingApprovedDocMarker(input.approvedDocUrl || "")
  ].filter(Boolean);
  for (const marker of markers) {
    next = next ? `${next}\n${marker}` : marker;
  }
  return next;
}

export function applyFilingRevisionRequestedMarkers(
  remarks: string,
  input: { reviewer: string; note: string }
): string {
  let next = String(remarks || "")
    .replace(/\n?FILING_REVIEW_OUTCOME:\S+/gi, "")
    .replace(/\n?FILING_REVISION_NOTE:[^\n]+/gi, "")
    .trim();
  const markers = [
    filingReviewOutcomeMarker("changes_requested"),
    filingReviewerMarker(input.reviewer),
    filingRevisionNoteMarker(input.note)
  ].filter(Boolean);
  for (const marker of markers) {
    next = next ? `${next}\n${marker}` : marker;
  }
  return next;
}

export type FilingCompletionConfirm = {
  filing: boolean;
  service: boolean;
  electronicTransmission: boolean;
  proofs: boolean;
};

export function filingCompletionMarker(confirm: FilingCompletionConfirm): string {
  const parts = [
    confirm.filing ? "filing" : "",
    confirm.service ? "service" : "",
    confirm.electronicTransmission ? "etrans" : "",
    confirm.proofs ? "proof" : ""
  ].filter(Boolean);
  return `FILING_COMPLETION:${parts.join(",") || "none"}`;
}

export function parseFilingCompletionConfirm(remarks: string): FilingCompletionConfirm {
  const raw = remarks.match(FILING_COMPLETION_RE)?.[1]?.toLowerCase() || "";
  const set = new Set(raw.split(/[|,]/).map((p) => p.trim()).filter(Boolean));
  return {
    filing: set.has("filing"),
    service: set.has("service"),
    electronicTransmission: set.has("etrans") || set.has("electronic"),
    proofs: set.has("proof") || set.has("proofs")
  };
}

export function isFilingCompletionFullyConfirmed(remarks: string): boolean {
  const c = parseFilingCompletionConfirm(remarks);
  return c.filing && c.service && c.electronicTransmission && c.proofs;
}

export function replaceFilingCompletionConfirm(
  remarks: string,
  confirm: FilingCompletionConfirm
): string {
  const cleaned = String(remarks || "")
    .replace(/\n?FILING_COMPLETION:[^|\n]+/gi, "")
    .trim();
  const marker = filingCompletionMarker(confirm);
  return cleaned ? `${cleaned}\n${marker}` : marker;
}

export function filingNotifyDrafterMarker(note: string): string {
  const value = String(note || "").trim().replace(/\s+/g, " ").slice(0, 200);
  return value ? `FILING_NOTIFY_DRAFTER:${value}` : "";
}

export function filingNotifyFilerMarker(note: string): string {
  const value = String(note || "").trim().replace(/\s+/g, " ").slice(0, 200);
  return value ? `FILING_NOTIFY_FILER:${value}` : "";
}

export function parseFilingNotifyDrafter(remarks: string): string | null {
  return remarks.match(FILING_NOTIFY_DRAFTER_RE)?.[1]?.trim() || null;
}

export function parseFilingNotifyFiler(remarks: string): string | null {
  return remarks.match(FILING_NOTIFY_FILER_RE)?.[1]?.trim() || null;
}

export function filingRouteOverrideMarker(reason: string): string {
  const value = String(reason || "").trim().replace(/\s+/g, " ").slice(0, 300);
  return value ? `FILING_ROUTE_OVERRIDE:${value}` : "";
}

export function parseFilingRouteOverride(remarks: string): string | null {
  return remarks.match(FILING_ROUTE_OVERRIDE_RE)?.[1]?.trim() || null;
}

/** True when an approved draft URL is locked and must not be silently replaced. */
export function isApprovedDraftLocked(remarks: string): boolean {
  return (
    parseFilingReviewOutcome(remarks) === "approved" && Boolean(parseFilingApprovedDocUrl(remarks))
  );
}
