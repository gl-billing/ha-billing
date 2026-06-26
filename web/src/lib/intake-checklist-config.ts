import type { EngagementDocumentType, EngagementLetterInput } from "@/lib/engagement-letter";

export type IntakeChecklist = {
  engagementLetter?: boolean;
  /** Retainership agreement vs contract of legal services — drives the prep task text. */
  documentType?: EngagementDocumentType;
  feeType?: EngagementLetterInput["feeType"];
  /** Whether to create a schedule-initial-conference task. */
  scheduleInitialConference?: boolean;
};

/** API / legacy payloads may still send `initialConference`. */
export type IntakeChecklistInput = IntakeChecklist & {
  initialConference?: boolean;
};

export function normalizeIntakeChecklistInput(
  checklist: IntakeChecklistInput | undefined
): IntakeChecklist | undefined {
  if (!checklist) return undefined;
  const { initialConference, ...rest } = checklist;
  return {
    ...rest,
    scheduleInitialConference: rest.scheduleInitialConference ?? initialConference ?? false
  };
}

export function feeTypeOptionsForDocument(
  documentType: EngagementDocumentType
): Array<{ value: EngagementLetterInput["feeType"]; label: string }> {
  if (documentType === "contract") {
    return [{ value: "acceptance", label: "Acceptance fee" }];
  }
  return [
    { value: "retainer", label: "Retainer" },
    { value: "hourly", label: "Hourly" },
    { value: "flat", label: "Flat rate" }
  ];
}

export function defaultFeeTypeForDocument(documentType: EngagementDocumentType): EngagementLetterInput["feeType"] {
  return documentType === "contract" ? "acceptance" : "retainer";
}

export function normalizeIntakeFeeType(
  documentType: EngagementDocumentType,
  feeType: EngagementLetterInput["feeType"] | undefined
): EngagementLetterInput["feeType"] {
  const options = feeTypeOptionsForDocument(documentType).map((row) => row.value);
  if (feeType && options.includes(feeType)) return feeType;
  return defaultFeeTypeForDocument(documentType);
}

function feeTypeLabel(feeType: EngagementLetterInput["feeType"]): string {
  if (feeType === "hourly") return "hourly";
  if (feeType === "flat") return "flat rate";
  if (feeType === "acceptance") return "acceptance fee";
  return "retainer";
}

/** Office Tasks description for the engagement / contract prep task. */
export function engagementDocumentTaskDescription(
  documentType: EngagementDocumentType,
  feeType: EngagementLetterInput["feeType"]
): string {
  if (documentType === "contract") {
    return "Prepare and send contract of legal services (acceptance fee)";
  }
  return `Prepare and send retainership agreement (${feeTypeLabel(feeType)})`;
}

export const INTAKE_CONFLICT_TASK = "Complete conflict check";
export const INTAKE_CONFERENCE_TASK = "Schedule initial client conference";

export function previewIntakeTasks(checklist: IntakeChecklist): string[] {
  const tasks: string[] = [];
  if (checklist.engagementLetter) {
    const documentType = checklist.documentType || "engagement";
    const feeType = normalizeIntakeFeeType(documentType, checklist.feeType);
    tasks.push(engagementDocumentTaskDescription(documentType, feeType));
  }
  if (checklist.scheduleInitialConference) tasks.push(INTAKE_CONFERENCE_TASK);
  return tasks;
}
