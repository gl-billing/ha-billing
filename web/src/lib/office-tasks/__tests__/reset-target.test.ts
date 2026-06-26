import { describe, expect, it } from "vitest";
import {
  resetTargetDate,
  shouldUpdateFilingDeadlineOnReset,
  usesFilingDeadlineForReset
} from "@/lib/office-tasks/reset-target";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

describe("reset target", () => {
  it("uses filing deadline for pleading events with a deadline", () => {
    const item = makeItem({
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-09",
      date: "2026-06-11",
      eventDate: "2026-06-11"
    });
    expect(usesFilingDeadlineForReset(item)).toBe(true);
    expect(resetTargetDate(item)).toBe("2026-06-09");
  });

  it("uses event date for hearings without a filing deadline", () => {
    const item = makeItem({
      source: "Event",
      category: "Hearing",
      date: "2026-06-20",
      filingDeadline: null
    });
    expect(usesFilingDeadlineForReset(item)).toBe(false);
    expect(resetTargetDate(item)).toBe("2026-06-20");
  });

  it("uses due date for tasks", () => {
    const item = makeItem({ source: "Task", date: "2026-06-18" });
    expect(usesFilingDeadlineForReset(item)).toBe(false);
    expect(resetTargetDate(item)).toBe("2026-06-18");
  });

  it("updates filing deadline columns for deadline-like events", () => {
    expect(shouldUpdateFilingDeadlineOnReset("Event", "Court Filing", false)).toBe(true);
    expect(shouldUpdateFilingDeadlineOnReset("Event", "Hearing", true)).toBe(true);
    expect(shouldUpdateFilingDeadlineOnReset("Event", "Hearing", false)).toBe(false);
    expect(shouldUpdateFilingDeadlineOnReset("Task", "Court Filing", true)).toBe(false);
  });
});
