import { describe, expect, it } from "vitest";
import {
  buildMobileOfficeLists,
  mobileOfficeAfterTaskHref,
  mobileOfficeBackHref,
  mobileOfficeCardHref,
  mobileHomeTaskRows,
  mobileOfficeEmptyCopy,
  parseMobileOfficeView,
  withSearchParams
} from "@/lib/mobile-office-views";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

function item(partial: Partial<OfficeItem> & Pick<OfficeItem, "id" | "source">): OfficeItem {
  return {
    sheetName: "Tasks",
    rowNumber: 1,
    date: null,
    eventDate: null,
    filingDeadline: null,
    startTime: null,
    endTime: null,
    category: "",
    priority: "",
    assignedTo: "",
    clientCase: "",
    venue: "",
    details: "",
    previousAction: "",
    nextAction: "",
    status: "To Do",
    done: false,
    completedDate: null,
    remarks: "",
    reminderDays: 0,
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

describe("mobile-office-views", () => {
  it("parses category views and ignores unknown values", () => {
    expect(parseMobileOfficeView("schedule")).toBe("schedule");
    expect(parseMobileOfficeView("tasks")).toBe("tasks");
    expect(parseMobileOfficeView("week")).toBeNull();
    expect(parseMobileOfficeView(null)).toBeNull();
  });

  it("keeps existing query params when opening a category", () => {
    expect(withSearchParams("/app?tab=desk-checklist&ha-layout=mobile", { mo: "schedule" })).toBe(
      "/app?tab=desk-checklist&ha-layout=mobile&mo=schedule"
    );
  });

  it("splits today’s office cards into schedule, tasks, filing, and meetings", () => {
    const today = "2026-08-16";
    const lists = buildMobileOfficeLists(
      [
        item({
          id: "ev-1",
          source: "Event",
          date: today,
          category: "Hearing",
          clientCase: "Plaza vs. Magnifico",
          startTime: "09:00"
        }),
        item({
          id: "task-1",
          source: "Task",
          date: today,
          details: "Draft motion"
        }),
        item({
          id: "file-1",
          source: "Event",
          date: today,
          category: "Court Filing",
          filingDeadline: today
        }),
        item({
          id: "meet-1",
          source: "Event",
          date: today,
          category: "Meeting",
          clientCase: "Retainer consult"
        })
      ],
      today,
      today
    );
    expect(lists.schedule.map((row) => row.id)).toEqual(["ev-1", "meet-1"]);
    expect(lists.tasksDue.map((row) => row.id)).toEqual(["task-1"]);
    expect(lists.filing.map((row) => row.id)).toEqual(["file-1"]);
    expect(lists.meeting.map((row) => row.id)).toEqual(["meet-1"]);
  });

  it("opens a single record directly and a list when there are several", () => {
    const home = "/app?tab=desk-checklist";
    expect(mobileOfficeCardHref(home, "schedule", [], null)).toBe("/app?tab=desk-checklist&mo=schedule");
    expect(mobileOfficeCardHref(home, "tasks", [item({ id: "task-1", source: "Task" })], null)).toBe(
      "/app?tab=desk-checklist&mo=tasks&moItem=task-1&moFrom=card"
    );
    expect(
      mobileOfficeCardHref(
        home,
        "filing",
        [item({ id: "a", source: "Event" }), item({ id: "b", source: "Event" })],
        "2026-08-16"
      )
    ).toBe("/app?tab=desk-checklist&mo=filing&day=2026-08-16");
  });

  it("returns from a list item to the list, and from a card-opened item to home", () => {
    const home = "/app?tab=desk-checklist";
    expect(mobileOfficeBackHref(home, "tab=desk-checklist&mo=tasks&moItem=task-1&moFrom=list")).toBe(
      "/app?tab=desk-checklist&mo=tasks"
    );
    expect(mobileOfficeBackHref(home, "tab=desk-checklist&mo=tasks&moItem=task-1&moFrom=card")).toBe(
      "/app?tab=desk-checklist"
    );
    expect(mobileOfficeBackHref(home, "tab=add-task&day=2026-08-16")).toBe(
      "/app?tab=desk-checklist&day=2026-08-16"
    );
  });

  it("opens the new task after save when it is due on the selected day", () => {
    const home = "/app?tab=desk-checklist";
    expect(mobileOfficeAfterTaskHref(home, "2026-08-16", "2026-08-16", "TASK-9")).toBe(
      "/app?tab=desk-checklist&mo=tasks&moItem=TASK-9&moFrom=card&day=2026-08-16"
    );
    expect(mobileOfficeAfterTaskHref(home, "2026-08-16", "2026-08-20", "TASK-9")).toBe(
      "/app?tab=desk-checklist&day=2026-08-16"
    );
  });

  it("uses the specified empty-state copy", () => {
    expect(mobileOfficeEmptyCopy("schedule", true)).toBe("No events scheduled for today.");
    expect(mobileOfficeEmptyCopy("tasks", true)).toBe("No tasks due today.");
  });

  it("includes overdue tasks on the home Tasks stack for today", () => {
    const today = "2026-08-16";
    const lists = buildMobileOfficeLists(
      [
        item({ id: "due", source: "Task", date: today, details: "Due today" }),
        item({ id: "late", source: "Task", date: "2026-08-10", details: "Overdue" })
      ],
      today,
      today
    );
    expect(mobileHomeTaskRows(lists, true).map((row) => row.id)).toEqual(["due", "late"]);
    expect(mobileHomeTaskRows(lists, false).map((row) => row.id)).toEqual(["due"]);
  });
});
