import { describe, expect, it } from "vitest";
import { summarizeCalendarSync } from "@/lib/calendar-sync-status";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

function item(partial: Partial<OfficeItem>): OfficeItem {
  return {
    id: "T-1",
    source: "Task",
    sheetName: "Tasks",
    rowNumber: 2,
    clientCase: "SMITH — Smith vs Smith",
    category: "Task",
    status: "Open",
    priority: "Medium",
    date: "2026-06-17",
    done: false,
    calendarSync: false,
    calendarEventId: "",
    ...partial
  } as OfficeItem;
}

describe("summarizeCalendarSync", () => {
  it("reports muted when nothing is flagged", () => {
    const summary = summarizeCalendarSync([item({ calendarSync: false })]);
    expect(summary.tone).toBe("muted");
    expect(summary.flaggedOpen).toBe(0);
  });

  it("reports ok when all flagged items have event ids", () => {
    const summary = summarizeCalendarSync([
      item({ calendarSync: true, calendarEventId: "abc123" }),
      item({ id: "T-2", calendarSync: true, calendarEventId: "def456" })
    ]);
    expect(summary.tone).toBe("ok");
    expect(summary.syncedOpen).toBe(2);
    expect(summary.needsAttention).toBe(0);
  });

  it("warns when sync is on but event id is missing", () => {
    const summary = summarizeCalendarSync([
      item({ calendarSync: true, calendarEventId: "abc123" }),
      item({ id: "T-2", calendarSync: true, calendarEventId: "" })
    ]);
    expect(summary.tone).toBe("warn");
    expect(summary.needsAttention).toBe(1);
  });
});
