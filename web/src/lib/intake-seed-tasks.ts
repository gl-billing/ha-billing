import { appendEvent, appendTask, type EventFormInput, type TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { defaultAndreaOperationsAssignee } from "@/lib/office-tasks/task-assignees";
import {
  engagementDocumentTaskDescription,
  INTAKE_CONFERENCE_TASK,
  normalizeIntakeFeeType,
  type IntakeChecklist
} from "@/lib/intake-checklist-config";

export type { IntakeChecklist } from "@/lib/intake-checklist-config";

export type IntakeSeedOptions = {
  clientCase: string;
  assignee?: string;
  courtPending?: string;
  checklist?: IntakeChecklist;
  extraTasks?: TaskFormInput[];
};

function defaultDueDate(daysAhead = 7): string {
  const due = new Date();
  due.setDate(due.getDate() + daysAhead);
  return due.toISOString().slice(0, 10);
}

function isEngagementDocumentTask(description: string): boolean {
  return (
    description.startsWith("Prepare and send retainership agreement") ||
    description.startsWith("Prepare and send contract of legal services")
  );
}

export function buildIntakeSeedTasks(options: IntakeSeedOptions): TaskFormInput[] {
  const assignee = options.assignee?.trim() || "Unassigned";
  const dueDefault = defaultDueDate();
  const checklist = options.checklist || {};
  const tasks: TaskFormInput[] = [];

  if (checklist.engagementLetter) {
    const documentType = checklist.documentType || "engagement";
    const feeType = normalizeIntakeFeeType(documentType, checklist.feeType);
    tasks.push({
      clientCase: options.clientCase,
      assignedTo: assignee,
      dueDate: dueDefault,
      description: engagementDocumentTaskDescription(documentType, feeType),
      taskType: "Administrative",
      priority: "Medium",
      status: "In Progress",
      reminderDays: 3
    });
  }
  if (checklist.scheduleInitialConference) {
    tasks.push({
      clientCase: options.clientCase,
      assignedTo: assignee,
      dueDate: dueDefault,
      description: INTAKE_CONFERENCE_TASK,
      taskType: "Client Follow-up",
      priority: "Medium",
      status: "Waiting",
      reminderDays: 3
    });
  }

  return [...tasks, ...(options.extraTasks || [])];
}

export async function createIntakeSeedTasks(
  accessToken: string,
  options: IntakeSeedOptions
): Promise<string[]> {
  const directory = await getEmployeeDirectory(accessToken);
  const roster = directory.map((employee) => employee.name).filter(Boolean);
  const andreaAssignee = defaultAndreaOperationsAssignee(roster, directory);
  const assignee = options.assignee?.trim() || "Unassigned";
  const dueDefault = defaultDueDate();
  const created: string[] = [];

  const seedTasks = buildIntakeSeedTasks(options).map((task) => {
    if (isEngagementDocumentTask(task.description)) {
      return { ...task, assignedTo: andreaAssignee };
    }
    return task;
  });

  for (const task of seedTasks) {
    const saved = await appendTask(accessToken, task);
    created.push(saved.id);
  }

  if (options.courtPending?.trim()) {
    const eventBody: EventFormInput = {
      clientCase: options.clientCase,
      responsible: assignee,
      details: `New matter intake — court: ${options.courtPending.trim()}`,
      category: "Hearing",
      priority: "High",
      status: "Scheduled",
      eventDate: dueDefault,
      venue: options.courtPending.trim(),
      nextAction: "Call court to confirm hearing schedule",
      reminderDays: 3,
      calendarSync: true
    };
    const saved = await appendEvent(accessToken, eventBody);
    created.push(saved.id);
  }

  return created;
}
