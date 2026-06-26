import { describe, expect, it } from "vitest";
import { buildFirmNotifications } from "@/lib/office-tasks/firm-notifications";
import { prepDoneNoticeMarker } from "@/lib/office-tasks/prep-completion-core";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

function event(partial: Partial<OfficeItem>): OfficeItem {
  return {
    source: "Event",
    sheetName: "Events",
    rowNumber: 2,
    id: "E-1",
    date: "2026-06-14",
    eventDate: "2026-06-14",
    filingDeadline: null,
    startTime: "09:00",
    endTime: null,
    category: "Hearing",
    priority: "High",
    assignedTo: "Janine",
    clientCase: "Client — Case",
    venue: "RTC Branch 1",
    details: "Main hearing",
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

describe("firm notifications", () => {
  it("includes filing due today and hearing today notices", () => {
    const items = [
      event({ id: "E-hearing", category: "Hearing", eventDate: "2026-06-14", date: "2026-06-14", startTime: "10:30" }),
      event({
        id: "E-filing",
        category: "Court Filing",
        filingDeadline: "2026-06-14",
        date: "2026-06-14",
        eventDate: null
      })
    ];

    const notices = buildFirmNotifications({ items, today: "2026-06-14" });
    expect(notices.some((row) => row.kind === "hearing-today")).toBe(true);
    expect(notices.some((row) => row.kind === "filing-due")).toBe(true);
    expect(notices.some((row) => row.subtitle.includes("confirm if this has already been submitted"))).toBe(true);
    expect(
      buildFirmNotifications({ items, today: "2026-06-14", includeMarkFiledActions: true }).find(
        (row) => row.kind === "filing-due"
      )?.markFiledAction
    ).toEqual({
      source: "Event",
      rowNumber: 2,
      itemId: "E-filing",
      clientCase: "Client — Case"
    });
  });

  it("shows prep-ready notices to admin only", () => {
    const items = [
      event({
        id: "E-prep",
        category: "Court Filing",
        filingDeadline: "2026-06-20",
        date: "2026-06-20",
        remarks: prepDoneNoticeMarker("Andrea", "2026-06-14")
      })
    ];

    expect(buildFirmNotifications({ items, today: "2026-06-14" }).some((row) => row.kind === "prep-ready")).toBe(
      false
    );
    expect(
      buildFirmNotifications({ items, today: "2026-06-14", includeAdminNotices: true }).some(
        (row) => row.kind === "prep-ready" && row.subtitle.includes("Andrea")
      )
    ).toBe(true);
  });
});
