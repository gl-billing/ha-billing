/**
 * Client-safe success summaries for Event creation and Filing Workflow setup.
 */

import { formatDisplayDate, normalizeOfficeStatus } from "@/lib/office-tasks/date-only";
import { isPleadingCategory } from "@/lib/office-tasks/event-form-utils";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  resolveFilingWorkflowPresence,
  type FilingWorkflowPresence
} from "@/lib/office-tasks/filing-workflow-presence";
import { filingWorkflowStageLabel } from "@/lib/office-tasks/filing-workflow-setup-shared";
import { parseFilingWorkflowStage } from "@/lib/office-tasks/filing-workflow-links";

export type WorkflowSetupStatusLabel =
  | "Not set up"
  | "Incomplete"
  | "Complete"
  | "Setup still required";

export type EventCreatedSuccessView = {
  title: string;
  eventId: string;
  eventType: string;
  clientCase: string;
  legalDeadline: string;
  legalDeadlineDisplay: string;
  responsible: string;
  calendarStatus: string;
  eventStatus: string;
  workflowSetupStatus: WorkflowSetupStatusLabel;
  workflowStageLabel: string | null;
  nextActionLabel: string | null;
  prepTasksRequested: boolean;
};

export type FilingWorkflowSetupCompleteView = {
  eventId: string;
  clientCase: string;
  legalDeadline: string;
  stages: Array<{ key: string; label: string; taskId: string | null; assignee: string }>;
  nextActionLabel: string;
  nextActionKey: string;
  workflowStageLabel: string;
  taskIds: Record<string, string | null>;
};

export type FilingWorkflowSetupSavedPayload = {
  eventId: string;
  message?: string;
  workflowStage?: string;
  taskIds?: Record<string, string | null>;
};

const STAGE_ROW_LABELS: Record<string, string> = {
  drafting: "Drafting",
  review: "Review & Approval",
  exhibits: "Documents and Exhibits",
  filing: "Filing",
  serving: "Service",
  proof: "Proof"
};

export function workflowSetupStatusLabel(presence: FilingWorkflowPresence): WorkflowSetupStatusLabel {
  if (presence === "linked") return "Complete";
  if (presence === "incomplete") return "Incomplete";
  return "Not set up";
}

export function buildEventCreatedSuccessView(input: {
  eventId: string;
  category: string;
  clientCase: string;
  filingDeadline?: string;
  eventDate?: string;
  responsible: string;
  calendarSync?: boolean;
  calendarSynced?: boolean;
  prepTasksRequested?: boolean;
  allItems?: OfficeItem[];
}): EventCreatedSuccessView {
  const legalDeadline = String(input.filingDeadline || input.eventDate || "").trim();
  const allItems = input.allItems || [];
  const event = allItems.find((row) => row.source === "Event" && row.id === input.eventId) || null;
  const presence = event ? resolveFilingWorkflowPresence(event, allItems) : "none";
  let workflowSetupStatus: WorkflowSetupStatusLabel = workflowSetupStatusLabel(presence);
  if (input.prepTasksRequested && presence === "none") {
    workflowSetupStatus = "Setup still required";
  }

  const stage = event ? parseFilingWorkflowStage(event.remarks || "") : null;
  const eventStatus = event
    ? normalizeOfficeStatus(event.status) || (event.done ? "Done" : "Upcoming")
    : isPleadingCategory(input.category)
      ? "Upcoming"
      : "Scheduled";

  let calendarStatus = input.calendarSync ? "Queued for sync" : "Not synced";
  if (input.calendarSynced) calendarStatus = "Synced to Google Calendar";
  if (input.calendarSync === false) calendarStatus = "Not synced";

  const nextActionLabel =
    presence === "linked" ? "Open workflow tasks" : presence === "incomplete" ? "Continue setup" : "Set Up Workflow";

  return {
    title: "Event Created Successfully",
    eventId: input.eventId,
    eventType: input.category,
    clientCase: input.clientCase,
    legalDeadline,
    legalDeadlineDisplay: legalDeadline ? formatDisplayDate(legalDeadline, "long") : "—",
    responsible: input.responsible || event?.assignedTo?.trim() || "—",
    calendarStatus,
    eventStatus,
    workflowSetupStatus,
    workflowStageLabel: stage ? filingWorkflowStageLabel(stage) : null,
    nextActionLabel,
    prepTasksRequested: Boolean(input.prepTasksRequested)
  };
}

export function buildFilingWorkflowSetupCompleteView(input: {
  eventId: string;
  allItems: OfficeItem[];
  taskIds?: Record<string, string | null>;
}): FilingWorkflowSetupCompleteView | null {
  const event = input.allItems.find((row) => row.source === "Event" && row.id === input.eventId);
  if (!event) return null;

  const taskIds = input.taskIds || {};
  const stages = Object.keys(STAGE_ROW_LABELS).map((key) => {
    const taskId = taskIds[key] || null;
    const task = taskId ? input.allItems.find((row) => row.source === "Task" && row.id === taskId) : null;
    return {
      key,
      label: STAGE_ROW_LABELS[key],
      taskId,
      assignee: task?.assignedTo || "—"
    };
  });

  return {
    eventId: event.id,
    clientCase: event.clientCase || "—",
    legalDeadline: event.filingDeadline || event.date || "—",
    stages,
    nextActionLabel: "Start Drafting",
    nextActionKey: "start-drafting",
    workflowStageLabel: filingWorkflowStageLabel(parseFilingWorkflowStage(event.remarks || "") || "drafting"),
    taskIds
  };
}
