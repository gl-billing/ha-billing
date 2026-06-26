import type { EngagementDocumentType, EngagementLetterInput } from "@/lib/engagement-letter";
import {
  engagementDocumentTaskDescription,
  INTAKE_CONFLICT_TASK,
  INTAKE_CONFERENCE_TASK
} from "@/lib/intake-checklist-config";

export { INTAKE_CONFLICT_TASK, INTAKE_CONFERENCE_TASK };

export function isIntakeEngagementDocumentTask(description: string): boolean {
  const text = description.trim();
  return (
    text.startsWith("Prepare and send retainership agreement") ||
    text.startsWith("Prepare and send contract of legal services")
  );
}

export function isIntakeConflictCheckTask(description: string): boolean {
  return description.trim() === INTAKE_CONFLICT_TASK;
}

export function parseEngagementDocumentFromTask(description: string): {
  documentType: EngagementDocumentType;
  feeType: EngagementLetterInput["feeType"];
} | null {
  const text = description.trim();
  if (text.startsWith("Prepare and send contract of legal services")) {
    return { documentType: "contract", feeType: "acceptance" };
  }

  const match = text.match(/^Prepare and send retainership agreement \((.+)\)$/i);
  if (!match) return null;

  const label = match[1].trim().toLowerCase();
  if (label.includes("hourly")) return { documentType: "engagement", feeType: "hourly" };
  if (label.includes("flat")) return { documentType: "engagement", feeType: "flat" };
  if (label.includes("acceptance")) return { documentType: "engagement", feeType: "acceptance" };
  return { documentType: "engagement", feeType: "retainer" };
}

export function isIntakeConferenceTask(description: string): boolean {
  return description.trim() === INTAKE_CONFERENCE_TASK;
}

export function intakeAdminTaskActionLabel(description: string): string | null {
  if (isIntakeConflictCheckTask(description)) return "Review conflicts";
  if (isIntakeConferenceTask(description)) return "Schedule conference";
  if (!isIntakeEngagementDocumentTask(description)) return null;
  const parsed = parseEngagementDocumentFromTask(description);
  return parsed?.documentType === "contract" ? "Send contract" : "Send agreement";
}

export function intakeAdminTaskHint(description: string): string | null {
  if (isIntakeConflictCheckTask(description)) {
    return "Open conflict review, confirm same or different case, then mark the task done.";
  }
  if (isIntakeConferenceTask(description)) {
    return "Schedule the initial client conference, send confirmation if needed, then mark done.";
  }
  if (isIntakeEngagementDocumentTask(description)) {
    const parsed = parseEngagementDocumentFromTask(description);
    if (parsed?.documentType === "contract") {
      return "Preview the contract PDF, email it to the client, then mark done.";
    }
    return "Preview the retainership PDF, email it to the client, then mark done.";
  }
  return null;
}

/** Stable description strings for tests and seed tasks. */
export { engagementDocumentTaskDescription };
