import { describe, expect, it } from "vitest";
import { formatMyWorkListText } from "@/lib/my-work-share-list";
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
    details: "File motion",
    done: false,
    calendarSync: false,
    ...partial
  } as OfficeItem;
}

describe("formatMyWorkListText", () => {
  it("includes sections and item lines", () => {
    const text = formatMyWorkListText({
      today: "2026-06-17",
      scopeLabel: "Assigned to Jas",
      lists: {
        overdue: [item({ id: "T-2", details: "Follow up payment" })],
        eventsToday: [],
        deadlinesToday: [],
        tasksDueToday: [item({ details: "Draft pleading" })],
        dueThisWeek: [],
        waitingAndStarted: [],
        doneToday: []
      }
    });

    expect(text).toContain("HA Office — My work");
    expect(text).toContain("Assigned to Jas");
    expect(text).toContain("Overdue");
    expect(text).toContain("Follow up payment");
    expect(text).toContain("Due now — tasks");
    expect(text).toContain("Draft pleading");
    expect(text).toContain("Open items: 2");
  });
});
