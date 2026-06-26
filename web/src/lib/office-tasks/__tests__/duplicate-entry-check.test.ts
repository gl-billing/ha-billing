import { describe, expect, it } from "vitest";
import {
  findDuplicateEvent,
  findDuplicateTask,
  normalizeEntryTime
} from "@/lib/office-tasks/duplicate-entry-check";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

function taskItem(partial: Partial<OfficeItem>): OfficeItem {
  return {
    source: "Task",
    sheetName: "Master Tasks",
    rowNumber: 2,
    id: "SMITH-TASK-0001",
    date: "2026-06-17",
    eventDate: null,
    filingDeadline: null,
    startTime: "09:00",
    endTime: null,
    category: "Court Follow-up",
    priority: "Medium",
    assignedTo: "Jas",
    clientCase: "SMITH — John Smith — Smith v. Doe",
    venue: "",
    details: "File motion",
    previousAction: "",
    nextAction: "",
    status: "Waiting",
    done: false,
    completedDate: null,
    remarks: "HA_CREATED_BY:Andrea Santos",
    reminderDays: 1,
    calendarSync: false,
    calendarEventId: "",
    lastUpdated: null,
    platform: "",
    filingMode: "",
    pleadingType: "",
    pleadingCaseNature: "",
    receivedDate: null,
    periodToFileDays: 0,
    filingDate: null,
    ...partial
  };
}

function eventItem(partial: Partial<OfficeItem>): OfficeItem {
  return {
    source: "Event",
    sheetName: "Hearings & Events",
    rowNumber: 3,
    id: "SMITH-EVT-0001",
    date: "2026-06-20",
    eventDate: "2026-06-20",
    filingDeadline: null,
    startTime: "14:00",
    endTime: null,
    category: "Hearing",
    priority: "High",
    assignedTo: "Atty. Maria Hernandez",
    clientCase: "SMITH — John Smith",
    venue: "RTC Branch 12",
    details: "Pre-trial",
    previousAction: "",
    nextAction: "",
    status: "Scheduled",
    done: false,
    completedDate: null,
    remarks: "",
    reminderDays: 1,
    calendarSync: false,
    calendarEventId: "",
    lastUpdated: null,
    platform: "Court",
    filingMode: "",
    pleadingType: "",
    pleadingCaseNature: "",
    receivedDate: null,
    periodToFileDays: 0,
    filingDate: null,
    ...partial
  };
}

describe("duplicate entry check", () => {
  it("normalizes common time formats", () => {
    expect(normalizeEntryTime("9:00 AM")).toBe("09:00");
    expect(normalizeEntryTime("09:00")).toBe("09:00");
    expect(normalizeEntryTime("")).toBe("");
  });

  it("finds duplicate tasks by client name, type, date, and time", () => {
    const items = [taskItem({})];
    const match = findDuplicateTask(items, {
      clientCase: "SMITH — John Smith — Another caption",
      taskType: "Court Follow-up",
      dueDate: "2026-06-17",
      dueTime: "09:00"
    });
    expect(match?.id).toBe("SMITH-TASK-0001");
    expect(match?.registeredBy).toBe("Andrea Santos");
  });

  it("ignores tasks with different time or type", () => {
    const items = [taskItem({})];
    expect(
      findDuplicateTask(items, {
        clientCase: "SMITH — John Smith",
        taskType: "Court Follow-up",
        dueDate: "2026-06-17",
        dueTime: "10:00"
      })
    ).toBeNull();
    expect(
      findDuplicateTask(items, {
        clientCase: "SMITH — John Smith",
        taskType: "Administrative",
        dueDate: "2026-06-17",
        dueTime: "09:00"
      })
    ).toBeNull();
  });

  it("finds duplicate events by client name, category, date, and time", () => {
    const items = [eventItem({})];
    const match = findDuplicateEvent(items, {
      clientCase: "SMITH — John Smith — Smith v. Doe",
      category: "Hearing",
      eventDate: "2026-06-20",
      startTime: "14:00"
    });
    expect(match?.id).toBe("SMITH-EVT-0001");
    expect(match?.registeredBy).toBe("Atty. Maria Hernandez");
  });
});
