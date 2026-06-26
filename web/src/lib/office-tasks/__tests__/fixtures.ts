import type { OfficeItem } from "@/lib/office-tasks/item-types";

const BASE: OfficeItem = {
  source: "Task",
  sheetName: "Tasks",
  rowNumber: 2,
  id: "T-001",
  date: "2026-06-11",
  eventDate: null,
  filingDeadline: null,
  startTime: null,
  endTime: null,
  category: "Task",
  priority: "Medium",
  assignedTo: "Test",
  clientCase: "ABC — Sample case",
  venue: "",
  details: "Details",
  previousAction: "",
  nextAction: "",
  status: "In Progress",
  done: false,
  completedDate: null,
  remarks: "",
  reminderDays: 3,
  calendarSync: false,
  calendarEventId: "",
  lastUpdated: null,
  platform: "",
  filingMode: "",
  pleadingType: "",
  pleadingCaseNature: "",
  receivedDate: null,
  periodToFileDays: 0,
  filingDate: null
};

export function makeItem(overrides: Partial<OfficeItem> = {}): OfficeItem {
  return { ...BASE, ...overrides };
}
