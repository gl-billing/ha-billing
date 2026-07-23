import type { IntakeMatterPath } from "@/lib/intake-matter-path";
import { nextRetainerDueDateYmd } from "@/lib/intake-matter-path";
import type { EventFormInput, TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import { computeResponsiveFilingDate } from "@/lib/office-tasks/event-form-utils";
import { createPrepChecklistState, prepChecklistMarker } from "@/lib/office-tasks/prep-checklist-storage";

export type ResponsivePleadingChoice = "yes" | "no" | "not_sure";

export type RetainerBillingCycle = "monthly" | "quarterly" | "annual";

export type NewCaseIntakeDetails = {
  casePrepAssignees: string[];
};

export type PendingCaseIntakeDetails = {
  currentCaseStage?: string;
  nextHearingOrDeadline?: string;
  previousCounsel?: string;
  responsiveRequired?: ResponsivePleadingChoice;
  pleadingType?: string;
  receivedDate?: string;
  periodToFileDays?: number;
  deadlineDate?: string;
  modeOfService?: string;
  assignedPerson?: string;
  documentsNeeded?: string;
};

export type RetainerIntakeDetails = {
  clientOrCompany?: string;
  retainerFee?: string | number;
  billingCycle?: RetainerBillingCycle;
  dueDay?: number | string;
  contactPerson?: string;
  contactEmail?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  renewalReminder?: boolean;
  autoSoaOnDueDate?: boolean;
  autoMonthlyBilling?: boolean;
  /** Premium package rules (notarials, meetings, coverage copy). */
  package?: {
    freeConsultations?: boolean;
    freeSimpleNotarials?: boolean;
    deedOfSaleRule?: "free" | "fixed" | "charge";
    deedOfSaleFee?: number | string;
    meetingsRule?: "included" | "case_by_case" | "always_charged";
    packageNotes?: string;
  };
};

export type IntakePathDetails = {
  path: IntakeMatterPath;
  newCase?: NewCaseIntakeDetails;
  pendingCase?: PendingCaseIntakeDetails;
  retainer?: RetainerIntakeDetails;
};

export const MAX_CASE_PREP_ASSIGNEES = 3;

export function normalizeCasePrepAssignees(assignees: string[] | undefined, max = MAX_CASE_PREP_ASSIGNEES): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of assignees || []) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export function formatCasePrepAssignees(assignees: string[] | undefined): string {
  return normalizeCasePrepAssignees(assignees).join(", ");
}

export function casePrepAssigneesValidationError(assignees: string[] | undefined): string | null {
  if (!normalizeCasePrepAssignees(assignees).length) {
    return "Assign at least one person to the case preparation checklist.";
  }
  return null;
}

export const NEW_CASE_PREP_CHECKLIST_ITEMS = [
  "Draft pleading",
  "Gather supporting documents",
  "Prepare verification/certification",
  "Prepare affidavits",
  "Calculate filing fees",
  "Final review",
  "File case",
  "Electronic filing of the case"
] as const;

export const PENDING_RESPONSIVE_PREP_ITEMS = [
  "Request documents from client",
  "Prepare draft pleading",
  "File and serve",
  "Electronic filing"
] as const;

export const RESPONSIVE_REVIEW_TASK = "Review whether responsive pleading/compliance is required";

function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const base = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(base.getTime())) return ymd;
  base.setDate(base.getDate() + days);
  return formatLocalYmd(base);
}

export function earlierYmd(a: string, b: string): string {
  return a.localeCompare(b) <= 0 ? a : b;
}

export function nextRetainerBillingDateYmd(
  cycle: RetainerBillingCycle,
  dueDay: number,
  from = new Date()
): string {
  if (cycle === "monthly") return nextRetainerDueDateYmd(dueDay, from);
  const day = Math.min(28, Math.max(1, Math.floor(dueDay) || 1));
  const year = from.getFullYear();
  const month = from.getMonth();
  const monthsAhead = cycle === "quarterly" ? 3 : 12;
  const candidate = new Date(year, month, day);
  const start = new Date(year, month, from.getDate());
  if (candidate >= start) return formatLocalYmd(candidate);
  const next = new Date(year, month + monthsAhead, day);
  return formatLocalYmd(next);
}

export function normalizeResponsivePleadingChoice(value: unknown): ResponsivePleadingChoice | "" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes" || raw === "y" || raw === "true") return "yes";
  if (raw === "no" || raw === "n" || raw === "false") return "no";
  if (raw === "not_sure" || raw === "not sure" || raw === "for review" || raw === "review") return "not_sure";
  return "";
}

export function normalizeRetainerBillingCycle(value: unknown): RetainerBillingCycle {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "quarterly") return "quarterly";
  if (raw === "annual" || raw === "yearly") return "annual";
  return "monthly";
}

export function resolveResponsiveDeadline(details: PendingCaseIntakeDetails): string {
  if (details.deadlineDate?.trim()) return details.deadlineDate.trim();
  if (details.receivedDate?.trim() && Number(details.periodToFileDays) > 0) {
    return computeResponsiveFilingDate(details.receivedDate, Number(details.periodToFileDays)) || "";
  }
  return "";
}

export function pendingCaseValidationError(details?: PendingCaseIntakeDetails): string | null {
  if (!details) return null;
  const choice = normalizeResponsivePleadingChoice(details.responsiveRequired);
  if (choice !== "yes") return null;
  if (!details.pleadingType?.trim()) return "Enter the type of pleading required.";
  if (!details.receivedDate?.trim()) return "Enter the date the pleading was received.";
  if (!Number(details.periodToFileDays) || Number(details.periodToFileDays) < 1) {
    return "Enter the number of days to file.";
  }
  if (!details.modeOfService?.trim()) return "Enter the mode of service.";
  if (!details.assignedPerson?.trim()) return "Assign a person for the responsive pleading prep.";
  return null;
}

export function retainerIntakeValidationError(details?: RetainerIntakeDetails): string | null {
  if (!details) return "Enter retainer billing details.";
  if (!details.clientOrCompany?.trim()) return "Enter the client or company name.";
  if (!details.retainerFee || Number(details.retainerFee) <= 0) return "Enter the retainer fee amount.";
  if (!details.contactPerson?.trim()) return "Enter the billing contact person.";
  if (!details.contactEmail?.trim()) return "Enter the billing contact email.";
  if (!details.contractStartDate?.trim()) return "Enter the contract start date.";
  return null;
}

function baseTask(
  clientCase: string,
  assignedTo: string,
  dueDate: string,
  description: string,
  taskType = "Administrative"
): TaskFormInput {
  return {
    clientCase,
    assignedTo: assignedTo.trim() || "Unassigned",
    dueDate,
    description,
    taskType,
    priority: "Medium",
    status: "In Progress",
    reminderDays: 3
  };
}

export function buildNewCasePrepTask(
  clientCase: string,
  assignees: string | string[],
  loggedDate: string
): TaskFormInput {
  const names = normalizeCasePrepAssignees(Array.isArray(assignees) ? assignees : [assignees]);
  const assigneeLabel = formatCasePrepAssignees(names) || "Unassigned";
  const checklist = createPrepChecklistState(NEW_CASE_PREP_CHECKLIST_ITEMS);
  return {
    ...baseTask(clientCase, assigneeLabel, addDaysYmd(loggedDate, 14), "Case preparation checklist", "Administrative"),
    priority: "High",
    interactiveChecklist: true,
    interactiveChecklistItems: [...NEW_CASE_PREP_CHECKLIST_ITEMS],
    remarks: `${prepChecklistMarker(checklist)}\nLogged ${loggedDate}. Assigned: ${assigneeLabel}.`,
    nextAction: "Complete prep: Draft pleading"
  };
}

export function buildPendingResponsivePrepTasks(
  clientCase: string,
  assignee: string,
  loggedDate: string,
  details: PendingCaseIntakeDetails
): TaskFormInput[] {
  const deadline = resolveResponsiveDeadline(details);
  const responsible = details.assignedPerson?.trim() || assignee;
  const dueRequest = deadline ? earlierYmd(addDaysYmd(loggedDate, 3), addDaysYmd(deadline, -7)) : addDaysYmd(loggedDate, 3);
  const dueDraft = deadline ? addDaysYmd(deadline, -5) : addDaysYmd(loggedDate, 7);
  const dueFile = deadline || addDaysYmd(loggedDate, 14);
  const pleading = details.pleadingType?.trim() || "Responsive pleading";
  const docs = details.documentsNeeded?.trim();

  return [
    {
      ...baseTask(clientCase, responsible, dueRequest, `Request documents from client — ${pleading}`, "Client Follow-up"),
      remarks: docs ? `Documents needed: ${docs}` : `Logged ${loggedDate}.`
    },
    {
      ...baseTask(clientCase, responsible, dueDraft, `Prepare draft — ${pleading}`),
      remarks: `Logged ${loggedDate}.${deadline ? ` Filing deadline ${deadline}.` : ""}`
    },
    {
      ...baseTask(clientCase, responsible, dueFile, `File and serve — ${pleading}`, "Court Filing"),
      priority: "High",
      remarks: [
        `Logged ${loggedDate}.`,
        details.modeOfService?.trim() ? `Mode of service: ${details.modeOfService.trim()}.` : "",
        deadline ? `Deadline: ${deadline}.` : ""
      ]
        .filter(Boolean)
        .join(" ")
    },
    {
      ...baseTask(clientCase, responsible, dueFile, `Electronic filing — ${pleading}`, "Court Filing"),
      priority: "High",
      remarks: deadline ? `Filing deadline ${deadline}.` : `Logged ${loggedDate}.`
    }
  ];
}

export function buildPendingResponsiveReviewTask(
  clientCase: string,
  assignee: string,
  loggedDate: string
): TaskFormInput {
  return {
    ...baseTask(clientCase, assignee, addDaysYmd(loggedDate, 3), RESPONSIVE_REVIEW_TASK, "Administrative"),
    priority: "High",
    remarks: `Logged ${loggedDate}. Review court papers and confirm if responsive pleading/compliance is required.`
  };
}

export function buildRetainerBillingTasks(
  clientCase: string,
  assignee: string,
  loggedDate: string,
  details: RetainerIntakeDetails
): TaskFormInput[] {
  const cycle = normalizeRetainerBillingCycle(details.billingCycle);
  const dueDay = Math.min(28, Math.max(1, Number(details.dueDay) || 1));
  const nextBillingDate = nextRetainerBillingDateYmd(cycle, dueDay);
  const tasks: TaskFormInput[] = [];

  if (details.autoMonthlyBilling !== false) {
    tasks.push({
      ...baseTask(
        clientCase,
        assignee,
        nextBillingDate,
        `Post retainer billing (${cycle})`,
        "Billing"
      ),
      priority: "High",
      remarks: `Logged ${loggedDate}. Retainer fee ${details.retainerFee ?? ""}. Next billing ${nextBillingDate}.`
    });
  }

  if (details.autoSoaOnDueDate !== false) {
    tasks.push({
      ...baseTask(clientCase, assignee, nextBillingDate, "Send SOA — retainer billing", "Billing"),
      remarks: `Auto SOA on due date (${nextBillingDate}). Contact: ${details.contactPerson ?? ""}.`
    });
  }

  if (details.renewalReminder && details.contractEndDate?.trim()) {
    tasks.push({
      ...baseTask(
        clientCase,
        assignee,
        earlierYmd(addDaysYmd(details.contractEndDate, -30), addDaysYmd(loggedDate, 7)),
        "Retainer contract renewal reminder",
        "Client Follow-up"
      ),
      remarks: `Contract ends ${details.contractEndDate.trim()}.`
    });
  }

  return tasks;
}

export function buildResponsiveFilingEvent(
  clientCase: string,
  assignee: string,
  details: PendingCaseIntakeDetails
): EventFormInput | null {
  const deadline = resolveResponsiveDeadline(details);
  if (!deadline || !details.receivedDate?.trim()) return null;
  return {
    clientCase,
    responsible: details.assignedPerson?.trim() || assignee,
    details: details.documentsNeeded?.trim()
      ? `Responsive pleading — ${details.documentsNeeded.trim()}`
      : "Responsive pleading — new matter intake",
    category: "Court Filing",
    priority: "High",
    status: "Scheduled",
    filingDeadline: deadline,
    receivedDate: details.receivedDate,
    periodToFileDays: Number(details.periodToFileDays) || 15,
    pleadingType: details.pleadingType?.trim() || "Responsive pleading",
    nextAction: "Prepare and file responsive pleading",
    reminderDays: 3,
    calendarSync: true,
    remarks: details.modeOfService?.trim() ? `Mode of service: ${details.modeOfService.trim()}` : undefined
  };
}

export function buildIntakePathWorkflowTasks(
  clientCase: string,
  assignee: string,
  pathDetails: IntakePathDetails | undefined,
  loggedDate: string
): TaskFormInput[] {
  if (!pathDetails) return [];
  if (pathDetails.path === "new_case") {
    const prepAssignees = normalizeCasePrepAssignees(pathDetails.newCase?.casePrepAssignees);
    const fallback = assignee.trim() ? [assignee.trim()] : [];
    return [buildNewCasePrepTask(clientCase, prepAssignees.length ? prepAssignees : fallback, loggedDate)];
  }
  if (pathDetails.path === "pending_case") {
    const pending = pathDetails.pendingCase || {};
    const choice = normalizeResponsivePleadingChoice(pending.responsiveRequired);
    if (choice === "yes") {
      return buildPendingResponsivePrepTasks(clientCase, assignee, loggedDate, pending);
    }
    if (choice === "not_sure") {
      return [buildPendingResponsiveReviewTask(clientCase, assignee, loggedDate)];
    }
    return [];
  }
  if (pathDetails.path === "retainer") {
    return buildRetainerBillingTasks(clientCase, assignee, loggedDate, pathDetails.retainer || {});
  }
  return [];
}

export function previewIntakePathWorkflowTasks(pathDetails?: IntakePathDetails): string[] {
  if (!pathDetails) return [];
  if (pathDetails.path === "new_case") {
    const assignees = formatCasePrepAssignees(pathDetails.newCase?.casePrepAssignees);
    const tasks = ["Case preparation checklist"];
    if (assignees) tasks.push(`Assigned: ${assignees}`);
    tasks.push(...NEW_CASE_PREP_CHECKLIST_ITEMS.map((item) => `  · ${item}`));
    return tasks;
  }
  if (pathDetails.path === "pending_case") {
    const pending = pathDetails.pendingCase || {};
    const tasks: string[] = [];
    if (pending.currentCaseStage?.trim()) tasks.push(`Case stage: ${pending.currentCaseStage.trim()}`);
    if (pending.nextHearingOrDeadline?.trim()) {
      tasks.push(`Next hearing/deadline (on matter profile): ${pending.nextHearingOrDeadline.trim()}`);
    }
    const choice = normalizeResponsivePleadingChoice(pending.responsiveRequired);
    if (choice === "yes") {
      const deadline = resolveResponsiveDeadline(pending);
      if (deadline) tasks.push(`Responsive pleading deadline: ${deadline}`);
      tasks.push(...PENDING_RESPONSIVE_PREP_ITEMS);
    } else if (choice === "not_sure") {
      tasks.push(RESPONSIVE_REVIEW_TASK);
    }
    return tasks;
  }
  if (pathDetails.path === "retainer") {
    const retainer = pathDetails.retainer || {};
    const cycle = normalizeRetainerBillingCycle(retainer.billingCycle);
    const dueDay = Math.min(28, Math.max(1, Number(retainer.dueDay) || 1));
    const nextDate = nextRetainerBillingDateYmd(cycle, dueDay);
    const tasks: string[] = [];
    if (retainer.autoMonthlyBilling !== false) tasks.push(`Post retainer billing (${cycle}) — due ${nextDate}`);
    if (retainer.autoSoaOnDueDate !== false) tasks.push(`Send SOA — due ${nextDate}`);
    if (retainer.renewalReminder && retainer.contractEndDate?.trim()) {
      tasks.push(`Contract renewal reminder — ends ${retainer.contractEndDate.trim()}`);
    }
    return tasks;
  }
  return [];
}

export function serializeIntakePathDetails(details?: IntakePathDetails): string {
  if (!details) return "";
  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}

export function parseIntakePathDetails(raw: unknown): IntakePathDetails | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "path" in raw) {
    return raw as IntakePathDetails;
  }
  const text = String(raw).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as IntakePathDetails;
    if (!parsed?.path) return null;
    return parsed;
  } catch {
    return null;
  }
}
