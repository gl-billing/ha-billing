/**
 * Client-safe filing workflow setup helpers (no server-only imports).
 */

import { addDaysYmd } from "@/lib/office-tasks/date-only";
import { todayYmd } from "@/lib/office-tasks/schedule";

export type FilingWorkflowSetupTaskDates = {
  drafting: string;
  review: string;
  exhibits: string;
  filing: string;
  serving: string;
  proof: string;
};

/** Default internal due dates — when overdue, anchor to today (never rewrite the legal deadline). */
export function defaultInternalTaskDueDates(
  originalDeadline: string,
  today = todayYmd()
): FilingWorkflowSetupTaskDates {
  const overdue = Boolean(originalDeadline && originalDeadline < today);
  if (overdue) {
    return {
      drafting: today,
      review: addDaysYmd(today, 1),
      exhibits: addDaysYmd(today, 2),
      filing: addDaysYmd(today, 3),
      serving: addDaysYmd(today, 4),
      proof: addDaysYmd(today, 5)
    };
  }
  const base = originalDeadline || today;
  return {
    drafting: addDaysYmd(base, -5),
    review: addDaysYmd(base, -4),
    exhibits: addDaysYmd(base, -3),
    filing: addDaysYmd(base, -2),
    serving: addDaysYmd(base, -1),
    proof: base
  };
}

export function filingWorkflowStageLabel(stage: string): string {
  switch (stage) {
    case "drafting":
      return "Drafting";
    case "awaiting_review":
      return "Awaiting review";
    case "revision_required":
      return "Revision required";
    case "documents_exhibits":
      return "Documents and exhibits";
    case "ready_for_filing":
      return "Ready for filing";
    case "filing_in_progress":
      return "Filing in progress";
    case "filed_service_pending":
      return "Filed — service pending";
    case "filed_e_copy_pending":
      return "Filed — e-copy pending";
    case "filed_proof_pending":
      return "Filed — proof pending";
    case "completed":
      return "Completed";
    case "setup_needed":
      return "Setup needed";
    default:
      return stage || "Drafting";
  }
}
