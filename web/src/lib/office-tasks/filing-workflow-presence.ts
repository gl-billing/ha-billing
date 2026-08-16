/**
 * Filing workflow presence — distinguishes no workflow vs incomplete setup vs linked stages.
 */

import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isOpenFilingEvent } from "@/lib/office-tasks/filing-confirmation";
import {
  parseFilingDraftTaskId,
  parseFilingExhibitsTaskId,
  parseFilingFilingTaskId,
  parseFilingProofTaskId,
  parseFilingReviewTaskId,
  parseFilingServeTaskId
} from "@/lib/office-tasks/filing-stage-links";
import { parseFilingWorkflowStage } from "@/lib/office-tasks/filing-workflow-links";
import { hasOpenEventLinkedTask } from "@/lib/office-tasks/event-follow-up-dedupe";
import { parsePrepChecklistState } from "@/lib/office-tasks/prep-checklist-storage";

export type FilingWorkflowPresence = "none" | "incomplete" | "linked";

export function hasFilingStageTaskMarkers(remarks: string): boolean {
  return Boolean(
    parseFilingDraftTaskId(remarks) ||
      parseFilingReviewTaskId(remarks) ||
      parseFilingExhibitsTaskId(remarks) ||
      parseFilingFilingTaskId(remarks) ||
      parseFilingServeTaskId(remarks) ||
      parseFilingProofTaskId(remarks)
  );
}

/**
 * Incomplete setup: legacy reminder / prep checklist / stage marker exists,
 * but FILING_*_TASK markers are not yet linked (Continue Setup, not Set Up).
 */
export function isFilingWorkflowSetupIncomplete(
  event: Pick<OfficeItem, "id" | "remarks">,
  allItems: OfficeItem[] = []
): boolean {
  const remarks = String(event.remarks || "");
  if (hasFilingStageTaskMarkers(remarks)) return false;

  if (parseFilingWorkflowStage(remarks)) return true;
  if (parsePrepChecklistState(remarks)) return true;
  if (hasOpenEventLinkedTask(allItems, String(event.id || "").trim().toUpperCase(), "reminder")) {
    return true;
  }

  const reminder = allItems.find(
    (row) =>
      row.source === "Task" &&
      !row.done &&
      row.remarks?.toUpperCase().includes(`EVENT_REMINDER:${String(event.id || "").toUpperCase()}`)
  );
  if (reminder && parsePrepChecklistState(reminder.remarks || "")) return true;

  return false;
}

export function resolveFilingWorkflowPresence(
  event: Pick<OfficeItem, "id" | "remarks">,
  allItems: OfficeItem[] = []
): FilingWorkflowPresence {
  const remarks = String(event.remarks || "");
  if (hasFilingStageTaskMarkers(remarks)) return "linked";
  if (isFilingWorkflowSetupIncomplete(event, allItems)) return "incomplete";
  return "none";
}

export function canOfferFilingWorkflowSetup(
  item: Pick<OfficeItem, "source" | "category" | "filingDeadline" | "status" | "done" | "id" | "remarks">,
  allItems: OfficeItem[] = []
): boolean {
  if (!isOpenFilingEvent(item)) return false;
  return resolveFilingWorkflowPresence(item, allItems) !== "linked";
}

export function filingWorkflowSetupActionLabel(
  item: Pick<OfficeItem, "id" | "remarks">,
  allItems: OfficeItem[] = []
): string {
  return resolveFilingWorkflowPresence(item, allItems) === "incomplete" ? "Continue Setup" : "Set Up Workflow";
}
