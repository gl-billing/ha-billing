/** Sheet names and column maps — must match Apps Script LAW OFFICE TASK + CALENDAR V2 */

export const SHEETS = {
  tasks: "Master Tasks",
  events: "Hearings & Events",
  employees: "Employees"
} as const;

export const TASK_HEADERS = [
  "Task ID",
  "Date Assigned",
  "Due Date",
  "Priority",
  "Assigned To",
  "Client / Case",
  "Task Type",
  "Task Description",
  "Previous Action Taken",
  "Next Action To Take",
  "Status",
  "Done?",
  "Date Completed",
  "Remarks",
  "Reminder Days Before",
  "Calendar Sync?",
  "Calendar Event ID",
  "Last Updated",
  "Due Time",
  "Venue / Office"
] as const;

export const EVENT_HEADERS = [
  "Event ID",
  "Date Logged",
  "Event Date",
  "Start Time",
  "End Time",
  "Category",
  "Priority",
  "Responsible Person",
  "Client / Case",
  "Venue",
  "Details / Agenda",
  "Previous Action Taken",
  "Next Action To Take",
  "Status",
  "Done?",
  "Date Completed",
  "Submission / Filing Deadline",
  "Remarks",
  "Reminder Days Before",
  "Calendar Sync?",
  "Calendar Event ID",
  "Last Updated",
  "Platform",
  "Filing Mode",
  "Pleading Type",
  "Received Date",
  "Period to File (Days)",
  "Filing Date"
] as const;

export const FILING_MODES = [
  "Personal filing",
  "Registered mail / Private courier",
  "Electronic filing (eFiling)"
] as const;

export const PLEADING_TYPES = ["Initiatory pleading", "Responsive pleading"] as const;

export const PLEADING_CASE_NATURES = ["Civil/Administrative", "Criminal"] as const;

export const EVENT_PLATFORMS = [
  "In person",
  "Zoom",
  "Google Meet",
  "Microsoft Teams",
  "Phone",
  "Court AVR",
  "Other"
] as const;

export const PRIORITIES = ["Urgent", "High", "Medium", "Low"] as const;
export const TASK_TYPES = [
  "Task",
  "Deadline",
  "Submission",
  "Drafting",
  "Filing",
  "Filing prep",
  "Client Follow-up",
  "Court Follow-up",
  "Research",
  "Administrative",
  "Other"
] as const;
export const EVENT_CATEGORIES = [
  "Hearing",
  "Consultation",
  "Meeting",
  "Deadline",
  "Submission",
  "Court Filing",
  "Client Call",
  "Internal Meeting",
  "Other"
] as const;

export const TERMINAL_STATUSES = ["Done", "Cancelled", "Reset", "Submitted"];

export const TASK_STATUSES = ["Started", "Waiting", "In Progress", "Overdue", "Done", "Cancelled", "Reset"] as const;
export const EVENT_STATUSES = ["Scheduled", "Overdue", "Done", "Submitted", "Cancelled", "Reset"] as const;
export const TASK_CREATE_STATUSES = ["In Progress", "Started", "Waiting", "Cancelled", "Reset"] as const;
export const EVENT_CREATE_STATUSES = ["Scheduled", "Cancelled", "Reset"] as const;
