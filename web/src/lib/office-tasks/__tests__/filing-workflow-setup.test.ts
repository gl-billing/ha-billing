import { describe, expect, it } from "vitest";
import { defaultInternalTaskDueDates } from "@/lib/office-tasks/filing-workflow-setup-shared";
import {
  canOfferFilingWorkflowSetup,
  hasFilingStageTaskMarkers,
  resolveFilingWorkflowPresence
} from "@/lib/office-tasks/filing-workflow-presence";
import { filingDraftTaskMarker } from "@/lib/office-tasks/filing-stage-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

function filingEvent(overrides: Partial<OfficeItem> = {}): OfficeItem {
  return {
    source: "Event",
    sheetName: "Hearings & Events",
    rowNumber: 2,
    id: "EVT-1",
    date: "2026-09-01",
    eventDate: "2026-09-01",
    filingDeadline: "2026-09-01",
    startTime: null,
    endTime: null,
    category: "Court Filing",
    priority: "High",
    assignedTo: "Atty",
    clientCase: "AB-1 Client",
    venue: "",
    details: "",
    previousAction: "",
    nextAction: "",
    status: "Upcoming",
    done: false,
    completedDate: null,
    remarks: "",
    reminderDays: 1,
    calendarSync: false,
    calendarEventId: "",
    lastUpdated: null,
    platform: "",
    filingMode: "Electronic filing (eFiling)",
    pleadingType: "Initiatory pleading",
    pleadingCaseNature: "Civil/Administrative",
    receivedDate: null,
    periodToFileDays: 0,
    filingDate: null,
    ...overrides
  };
}

describe("filing workflow setup dates", () => {
  it("anchors overdue deadlines to today", () => {
    const dates = defaultInternalTaskDueDates("2020-01-01", "2026-08-16");
    expect(dates.drafting).toBe("2026-08-16");
    expect(dates.proof).toBe("2026-08-21");
  });

  it("counts back from a future legal deadline", () => {
    const dates = defaultInternalTaskDueDates("2026-09-10", "2026-08-16");
    expect(dates.drafting).toBe("2026-09-05");
    expect(dates.proof).toBe("2026-09-10");
  });
});

describe("filing workflow presence", () => {
  it("offers Set Up Workflow on an open filing event without stage tasks", () => {
    const event = filingEvent();
    expect(hasFilingStageTaskMarkers(event.remarks)).toBe(false);
    expect(resolveFilingWorkflowPresence(event)).toBe("none");
    expect(canOfferFilingWorkflowSetup(event)).toBe(true);
  });

  it("does not offer setup once stage tasks are linked", () => {
    const event = filingEvent({ remarks: filingDraftTaskMarker("TASK-9") });
    expect(hasFilingStageTaskMarkers(event.remarks)).toBe(true);
    expect(resolveFilingWorkflowPresence(event)).toBe("linked");
    expect(canOfferFilingWorkflowSetup(event)).toBe(false);
  });
});
