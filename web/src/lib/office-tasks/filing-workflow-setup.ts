/**
 * Set up filing workflow for an existing deadline Event without changing its legal deadline.
 */

import "server-only";

import {
  appendRemarkMarkers,
  eventReminderMarker,
  linkedReminderTaskMarker,
  prepAssigneeMarker
} from "@/lib/office-tasks/event-item-links";
import { filingDraftUrlValidationError, normalizeFilingDraftUrl } from "@/lib/office-tasks/filing-draft-url";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import { hasFilingStageTaskMarkers } from "@/lib/office-tasks/filing-workflow-presence";
import {
  FILING_DRAFTING_TASK_TYPE,
  FILING_EXHIBITS_TASK_TYPE,
  FILING_FILING_TASK_TYPE,
  FILING_PROOF_TASK_TYPE,
  FILING_REVIEW_APPROVAL_TASK_TYPE,
  FILING_SERVING_TASK_TYPE,
  filingDraftTaskMarker,
  filingExhibitsTaskMarker,
  filingFilingTaskMarker,
  filingProofTaskMarker,
  filingReviewTaskMarker,
  filingServeTaskMarker,
  filingStageDraftingMarker,
  filingStageExhibitsMarker,
  filingStageFilingMarker,
  filingStageProofMarker,
  filingStageReviewMarker,
  filingStageServingMarker
} from "@/lib/office-tasks/filing-stage-links";
import {
  filingRouteOverrideMarker,
  replaceFilingDraftDoc,
  replaceFilingDraftNote,
  clearFilingDraftDocMarkers,
  replaceFilingWorkflowStage,
  stripStaleFilingWorkflowProgressMarkers
} from "@/lib/office-tasks/filing-workflow-links";
import {
  batchUpdateSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/office-tasks/sheets/client";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { columnIndexToLetter } from "@/lib/office-tasks/sheets/column-letter";
import { appendTask } from "@/lib/office-tasks/sheets/tasks";
import { EVENT_HEADERS, SHEETS } from "@/lib/tasks-config";
import type { FilingWorkflowSetupTaskDates } from "@/lib/office-tasks/filing-workflow-setup-shared";

export type { FilingWorkflowSetupTaskDates } from "@/lib/office-tasks/filing-workflow-setup-shared";
export { defaultInternalTaskDueDates } from "@/lib/office-tasks/filing-workflow-setup-shared";

export type FilingWorkflowSetupInput = {
  eventId: string;
  pleadingType?: string;
  filingMode?: string;
  draftDocUrl?: string;
  /** Free-text override when there is no URL (e.g. "Draft already sent via email"). */
  draftDocNote?: string;
  drafter: string;
  reviewer: string;
  filingStaff: string;
  serviceStaff: string;
  taskDueDates: FilingWorkflowSetupTaskDates;
  recommendedQueue: FilingQueueKind;
  confirmedQueue: FilingQueueKind;
  overrideReason?: string;
  generateTasks?: Partial<Record<keyof FilingWorkflowSetupTaskDates, boolean>>;
};

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Create linked prep tasks + Filing Queue stub for an existing Event.
 * Never changes the Event filing deadline.
 */
export async function setupFilingWorkflowForEvent(
  accessToken: string,
  input: FilingWorkflowSetupInput
): Promise<
  | {
      ok: true;
      eventId: string;
      originalDeadline: string;
      workflowStage: "drafting";
      taskIds: Record<string, string | null>;
      queueCreated: boolean;
      message: string;
    }
  | { ok: false; error: string }
> {
  const eventId = String(input.eventId || "").trim().toUpperCase();
  if (!eventId) return { ok: false, error: "Event ID is required." };

  const items = await collectAllItems(accessToken);
  const event = items.find((row) => row.source === "Event" && row.id === eventId);
  if (!event || event.rowNumber < 2) {
    return { ok: false, error: "Filing / deadline event not found." };
  }

  const originalDeadline = String(event.filingDeadline || event.date || "").trim();
  if (!originalDeadline) {
    return { ok: false, error: "This event has no filing deadline to preserve." };
  }

  if (hasFilingStageTaskMarkers(event.remarks || "")) {
    return {
      ok: false,
      error: "A filing workflow already exists for this Event ID. Use Open Workflow instead."
    };
  }

  if (input.confirmedQueue !== input.recommendedQueue && !String(input.overrideReason || "").trim()) {
    return {
      ok: false,
      error: "Override of the recommended filing method requires a reason (rule, order, or directive)."
    };
  }

  const draftUrl = String(input.draftDocUrl || "").trim();
  const draftNote = String(input.draftDocNote || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 400);
  if (draftUrl && draftNote) {
    return {
      ok: false,
      error: "Choose either a document URL or a draft note — not both."
    };
  }
  if (draftUrl) {
    const err = filingDraftUrlValidationError(draftUrl);
    if (err) return { ok: false, error: err };
  }

  for (const [key, value] of Object.entries(input.taskDueDates)) {
    if (!isYmd(value)) {
      return { ok: false, error: `Internal due date for ${key} must be YYYY-MM-DD.` };
    }
  }

  const gen = {
    drafting: input.generateTasks?.drafting !== false,
    review: input.generateTasks?.review !== false,
    exhibits: input.generateTasks?.exhibits !== false,
    filing: input.generateTasks?.filing !== false,
    serving: input.generateTasks?.serving !== false,
    proof: input.generateTasks?.proof !== false
  };

  const reminderMarker = eventReminderMarker(eventId);
  const pleading =
    String(input.pleadingType || event.pleadingType || event.category || "filing").trim() || "filing";
  const priority = event.priority || "High";
  const dates = input.taskDueDates;

  type Spec = {
    key: keyof FilingWorkflowSetupTaskDates;
    taskType: string;
    stageMarker: string;
    status: "In Progress" | "Waiting";
    description: string;
    nextAction: string;
    assignee: string;
    dueDate: string;
    enabled: boolean;
  };

  const specs: Spec[] = [
    {
      key: "drafting",
      taskType: FILING_DRAFTING_TASK_TYPE,
      stageMarker: filingStageDraftingMarker(),
      status: "In Progress",
      description: `Draft ${pleading} — legal deadline ${originalDeadline} (unchanged).`,
      nextAction: "Draft the pleading; attach Drive URL when ready.",
      assignee: input.drafter.trim(),
      dueDate: dates.drafting,
      enabled: gen.drafting
    },
    {
      key: "review",
      taskType: FILING_REVIEW_APPROVAL_TASK_TYPE,
      stageMarker: filingStageReviewMarker(),
      status: "In Progress",
      description: `Review & approve draft for ${pleading} before annexes and filing.`,
      nextAction: "Waiting on drafting — review when draft is ready.",
      assignee: input.reviewer.trim() || input.drafter.trim(),
      dueDate: dates.review,
      enabled: gen.review
    },
    {
      key: "exhibits",
      taskType: FILING_EXHIBITS_TASK_TYPE,
      stageMarker: filingStageExhibitsMarker(),
      status: "Waiting",
      description: `Exhibits & compile for ${pleading}.`,
      nextAction: "Waiting on review — prepare annexes when approved.",
      assignee: input.filingStaff.trim() || input.drafter.trim(),
      dueDate: dates.exhibits,
      enabled: gen.exhibits
    },
    {
      key: "filing",
      taskType: FILING_FILING_TASK_TYPE,
      stageMarker: filingStageFilingMarker(),
      status: "Waiting",
      description: `File ${pleading} by the legal deadline (${originalDeadline}).`,
      nextAction: "Waiting on exhibits — file when the package is ready.",
      assignee: input.filingStaff.trim(),
      dueDate: dates.filing,
      enabled: gen.filing
    },
    {
      key: "serving",
      taskType: FILING_SERVING_TASK_TYPE,
      stageMarker: filingStageServingMarker(),
      status: "Waiting",
      description: `Serve / furnish copies after ${pleading} is filed.`,
      nextAction: "Waiting until filed — then serve or furnish copies.",
      assignee: input.serviceStaff.trim() || input.filingStaff.trim(),
      dueDate: dates.serving,
      enabled: gen.serving
    },
    {
      key: "proof",
      taskType: FILING_PROOF_TASK_TYPE,
      stageMarker: filingStageProofMarker(),
      status: "Waiting",
      description: `Upload proof of filing/service for ${pleading}.`,
      nextAction: "Waiting on service — upload proof when available.",
      assignee: input.serviceStaff.trim() || input.filingStaff.trim(),
      dueDate: dates.proof,
      enabled: gen.proof
    }
  ];

  const enabledSpecs = specs.filter((s) => s.enabled && s.assignee);
  if (!enabledSpecs.length) {
    return { ok: false, error: "Select at least one preparation task and assignee." };
  }

  const created: Array<{ key: string; id: string; sheetRow: number }> = [];
  for (const spec of enabledSpecs) {
    const saved = await appendTask(accessToken, {
      clientCase: event.clientCase,
      assignedTo: spec.assignee,
      dueDate: spec.dueDate,
      priority,
      taskType: spec.taskType,
      description: spec.description,
      nextAction: spec.nextAction,
      remarks: appendRemarkMarkers("", [reminderMarker, spec.stageMarker]),
      status: spec.status,
      reminderDays: 1,
      calendarSync: false
    });
    created.push({ key: spec.key, id: saved.id, sheetRow: saved.sheetRow });
  }

  const byKey = Object.fromEntries(created.map((row) => [row.key, row])) as Record<
    string,
    { id: string; sheetRow: number }
  >;
  const draftingId = byKey.drafting?.id || null;
  const reviewId = byKey.review?.id || null;
  const exhibitsId = byKey.exhibits?.id || null;
  const filingId = byKey.filing?.id || null;
  const serveId = byKey.serving?.id || null;
  const proofId = byKey.proof?.id || null;

  async function patchTaskRemarks(sheetRow: number, markers: string[]) {
    if (sheetRow < 2) return;
    await updateSheetValues(accessToken, toA1Range(SHEETS.tasks, `N${sheetRow}`), [
      [appendRemarkMarkers("", markers.filter(Boolean))]
    ]);
  }

  if (byKey.drafting) {
    await patchTaskRemarks(byKey.drafting.sheetRow, [
      reminderMarker,
      filingStageDraftingMarker(),
      reviewId ? filingReviewTaskMarker(reviewId) : ""
    ]);
  }
  if (byKey.review) {
    await patchTaskRemarks(byKey.review.sheetRow, [
      reminderMarker,
      filingStageReviewMarker(),
      draftingId ? filingDraftTaskMarker(draftingId) : "",
      exhibitsId ? filingExhibitsTaskMarker(exhibitsId) : ""
    ]);
  }
  if (byKey.exhibits) {
    await patchTaskRemarks(byKey.exhibits.sheetRow, [
      reminderMarker,
      filingStageExhibitsMarker(),
      reviewId ? filingReviewTaskMarker(reviewId) : "",
      filingId ? filingFilingTaskMarker(filingId) : ""
    ]);
  }
  if (byKey.filing) {
    await patchTaskRemarks(byKey.filing.sheetRow, [
      reminderMarker,
      filingStageFilingMarker(),
      exhibitsId ? filingExhibitsTaskMarker(exhibitsId) : "",
      serveId ? filingServeTaskMarker(serveId) : ""
    ]);
  }
  if (byKey.serving) {
    await patchTaskRemarks(byKey.serving.sheetRow, [
      reminderMarker,
      filingStageServingMarker(),
      filingId ? filingFilingTaskMarker(filingId) : "",
      proofId ? filingProofTaskMarker(proofId) : ""
    ]);
  }
  if (byKey.proof) {
    await patchTaskRemarks(byKey.proof.sheetRow, [
      reminderMarker,
      filingStageProofMarker(),
      serveId ? filingServeTaskMarker(serveId) : ""
    ]);
  }

  const live = await getSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`));
  let remarks = stripStaleFilingWorkflowProgressMarkers(String(live[0]?.[0] ?? event.remarks ?? ""));
  remarks = appendRemarkMarkers(
    remarks,
    [
      exhibitsId ? linkedReminderTaskMarker(exhibitsId) : "",
      draftingId ? filingDraftTaskMarker(draftingId) : "",
      reviewId ? filingReviewTaskMarker(reviewId) : "",
      exhibitsId ? filingExhibitsTaskMarker(exhibitsId) : "",
      filingId ? filingFilingTaskMarker(filingId) : "",
      serveId ? filingServeTaskMarker(serveId) : "",
      proofId ? filingProofTaskMarker(proofId) : "",
      prepAssigneeMarker(
        [input.drafter, input.reviewer, input.filingStaff, input.serviceStaff].filter(Boolean).join(", ")
      )
    ].filter(Boolean)
  );
  remarks = replaceFilingWorkflowStage(remarks, "drafting");
  if (draftUrl) {
    const normalized = normalizeFilingDraftUrl(draftUrl);
    if (normalized) remarks = replaceFilingDraftDoc(remarks, normalized);
  } else if (draftNote) {
    remarks = replaceFilingDraftNote(remarks, draftNote);
  } else {
    remarks = clearFilingDraftDocMarkers(remarks);
  }
  if (input.confirmedQueue !== input.recommendedQueue && input.overrideReason) {
    remarks = appendRemarkMarkers(remarks, [filingRouteOverrideMarker(input.overrideReason)]);
  }
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);

  // Optional pleading type / filing mode — never touch Filing Deadline column.
  const pleadingCol = EVENT_HEADERS.indexOf("Pleading Type") + 1;
  const modeCol = EVENT_HEADERS.indexOf("Filing Mode") + 1;
  const columnUpdates: { range: string; values: string[][] }[] = [];
  if (input.pleadingType?.trim() && pleadingCol > 0) {
    columnUpdates.push({
        range: toA1Range(SHEETS.events, `${columnIndexToLetter(pleadingCol)}${event.rowNumber}`),
      values: [[input.pleadingType.trim()]]
    });
  }
  if (input.filingMode?.trim() && modeCol > 0) {
    columnUpdates.push({
        range: toA1Range(SHEETS.events, `${columnIndexToLetter(modeCol)}${event.rowNumber}`),
      values: [[input.filingMode.trim()]]
    });
  }
  if (columnUpdates.length) await batchUpdateSheetValues(accessToken, columnUpdates);

  // Filing Queue is created only when the workflow becomes Ready for Filing (review approve).
  // Do not stub a ledger row during Drafting / Review / Exhibits setup.
  const queueCreated = false;

  return {
    ok: true,
    eventId,
    originalDeadline,
    workflowStage: "drafting" as const,
    taskIds: {
      drafting: draftingId,
      review: reviewId,
      exhibits: exhibitsId,
      filing: filingId,
      serving: serveId,
      proof: proofId
    },
    queueCreated,
    message: `Filing workflow set up. Legal deadline ${originalDeadline} preserved. Filing Queue appears when Ready for Filing.`
  };
}
