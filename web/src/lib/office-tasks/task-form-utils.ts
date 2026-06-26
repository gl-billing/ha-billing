/** Task create form helpers — client-safe. */

export const TASK_FORM_TYPES = [
  "Task",
  "Client Follow-up",
  "Court Follow-up",
  "Research",
  "Administrative",
  "Other"
] as const;

export const TASK_OFFICE_VENUE_PRESETS = [
  "Register of Deeds (ROD)",
  "BIR",
  "Land Registration Authority (LRA)",
  "SSS",
  "PhilHealth",
  "Pag-IBIG",
  "Prosecutor's Office",
  "PNP / Police",
  "DAR",
  "City Hall / LGU",
  "Other agency / office"
] as const;

export const COURT_FILING_PREP = [
  "All pleadings complete and paginated",
  "All signatures affixed on pleadings",
  "Number of copies checked",
  "Filing fee / OR / stamps ready",
  "Proof of service attached (if required)",
  "Envelopes / folders / fasteners ready"
] as const;

export const CLIENT_FOLLOWUP_PREP = [
  "Client contact number verified",
  "Documents to request listed",
  "Callback or meeting time agreed",
  "Demand letter / draft reviewed (if applicable)"
] as const;

export const ADMINISTRATIVE_PREP = [
  "Forms completely filled out",
  "Valid IDs / authorization letter ready",
  "Fees / payment ready",
  "Appointment slot or queue confirmed",
  "Return receipt / claim stub prepared"
] as const;

export const GENERAL_TASK_PREP = [
  "Instructions clear to assignee",
  "Documents gathered",
  "Contact person / window identified"
] as const;

/** Default three-item checklist when creating an interactive task checklist. */
export const STANDARD_TASK_CHECKLIST_ITEMS = GENERAL_TASK_PREP;

/** First N prep items for a task type — used as the standard checklist options on + Task. */
export function defaultTaskChecklistItems(taskType: string, limit = 3): string[] {
  return [...prepChecklistForTaskType(taskType)].slice(0, limit);
}

export function resolveTaskType(taskType: string, taskTypeOther?: string): string {
  const type = String(taskType || "Task").trim();
  if (type !== "Other") return type;
  const other = String(taskTypeOther || "").trim();
  return other ? `Other — ${other}` : "Other";
}

export function splitTaskType(taskType: string): { taskType: string; taskTypeOther: string } {
  const type = String(taskType || "").trim();
  if (type.startsWith("Other — ")) {
    return { taskType: "Other", taskTypeOther: type.slice("Other — ".length).trim() };
  }
  if ((TASK_FORM_TYPES as readonly string[]).includes(type)) {
    return { taskType: type, taskTypeOther: "" };
  }
  return { taskType: "Other", taskTypeOther: type };
}

export function prepChecklistForTaskType(taskType: string): readonly string[] {
  if (taskType === "Court Follow-up") return COURT_FILING_PREP;
  if (taskType === "Client Follow-up") return CLIENT_FOLLOWUP_PREP;
  if (taskType === "Administrative") return ADMINISTRATIVE_PREP;
  if (taskType === "Research") return GENERAL_TASK_PREP;
  return GENERAL_TASK_PREP;
}

export function mergeTaskWorkDetails(
  agenda: string,
  workNotes: string,
  prepItems: string[]
): string {
  const parts: string[] = [];
  const base = String(agenda || "").trim();
  const notes = String(workNotes || "").trim();
  const prep = prepItems.map((item) => item.trim()).filter(Boolean);

  if (base) parts.push(base);
  if (notes) parts.push(`Work notes: ${notes}`);
  if (prep.length) parts.push(`Prep checklist: ${prep.join("; ")}`);

  return parts.join("\n\n");
}

export function parseTaskWorkDetails(combined: string): {
  description: string;
  workNotes: string;
  prepItems: string[];
} {
  const text = String(combined || "").trim();
  if (!text) return { description: "", workNotes: "", prepItems: [] };

  const descriptionParts: string[] = [];
  let workNotes = "";
  let prepItems: string[] = [];

  for (const part of text.split(/\n\n+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("Work notes: ")) {
      workNotes = trimmed.slice("Work notes: ".length).trim();
    } else if (trimmed.startsWith("Prep checklist: ")) {
      prepItems = trimmed
        .slice("Prep checklist: ".length)
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      descriptionParts.push(trimmed);
    }
  }

  return {
    description: descriptionParts.join("\n\n"),
    workNotes,
    prepItems
  };
}

export function validateTaskFormInput(form: {
  clientCase?: string;
  assignedTo?: string;
  dueDate?: string;
  description?: string;
  taskType?: string;
  taskTypeOther?: string;
}): string | null {
  if (!form.clientCase?.trim()) return "Select or enter a client / case before saving.";
  if (!form.assignedTo?.trim()) return "Assigned person is required.";
  if (!form.dueDate?.trim()) return "Enter the task date.";
  if (!form.description?.trim()) return "Agenda / work description is required.";
  if (form.taskType === "Other" && !String(form.taskTypeOther || "").trim()) {
    return "Specify what kind of task this is when Other is selected.";
  }
  return null;
}
