import { describe, expect, it } from "vitest";
import {
  duplicateEventLinkedTasksToClose,
  hasOpenEventLinkedTask
} from "@/lib/office-tasks/event-follow-up-dedupe";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

describe("event follow-up dedupe", () => {
  it("detects an open task by EVENT_FOLLOWUP marker", () => {
    const items = [
      makeItem({
        id: "T-1",
        remarks: "EVENT_FOLLOWUP:E-1",
        done: false,
        status: "In Progress"
      })
    ];
    expect(hasOpenEventLinkedTask(items, "E-1", "followUp")).toBe(true);
  });

  it("detects an open task linked from event remarks", () => {
    const items = [
      makeItem({
        source: "Event",
        id: "E-1",
        remarks: "LINKED_FOLLOWUP_TASK:T-9"
      }),
      makeItem({ id: "T-9", done: false, status: "In Progress" })
    ];
    expect(hasOpenEventLinkedTask(items, "E-1", "followUp")).toBe(true);
  });

  it("ignores stale reverse prep links when the task is marked for another event", () => {
    const items = [
      makeItem({
        source: "Event",
        id: "E-new",
        remarks: "LINKED_REMINDER_TASK:T-prep"
      }),
      makeItem({
        id: "T-prep",
        remarks: "EVENT_REMINDER:E-old",
        done: false,
        status: "In Progress"
      })
    ];
    expect(hasOpenEventLinkedTask(items, "E-new", "reminder")).toBe(false);
    expect(hasOpenEventLinkedTask(items, "E-old", "reminder")).toBe(true);
  });

  it("closes duplicate open follow-ups and keeps the linked task", () => {
    const items = [
      makeItem({
        source: "Event",
        id: "E-1",
        remarks: "LINKED_FOLLOWUP_TASK:T-keep"
      }),
      makeItem({
        id: "T-keep",
        remarks: "EVENT_FOLLOWUP:E-1",
        lastUpdated: "2026-06-01"
      }),
      makeItem({
        id: "T-extra",
        remarks: "EVENT_FOLLOWUP:E-1",
        rowNumber: 3,
        lastUpdated: "2026-06-02"
      })
    ];

    const toClose = duplicateEventLinkedTasksToClose(items);
    expect(toClose.map((item) => item.id)).toEqual(["T-extra"]);
  });
});
