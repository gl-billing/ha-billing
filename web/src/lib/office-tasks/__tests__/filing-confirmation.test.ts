import { describe, expect, it } from "vitest";
import {
  filingDeadlineUrgency,
  isFilingDeadlineEvent,
  isOpenFilingEvent,
  listFilingDeadlineAlerts,
  needsFilingConfirmation
} from "@/lib/office-tasks/filing-confirmation";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

const TODAY = "2026-06-11";

function filingEvent(overrides: Parameters<typeof makeItem>[0] = {}) {
  return makeItem({
    source: "Event",
    category: "Court Filing",
    filingDeadline: "2026-06-15",
    date: "2026-06-15",
    status: "Scheduled",
    reminderDays: 3,
    ...overrides
  });
}

describe("filing urgency", () => {
  it("detects filing deadline events", () => {
    expect(
      isFilingDeadlineEvent({
        source: "Event",
        category: "Court Filing",
        filingDeadline: "2026-06-15"
      })
    ).toBe(true);
    expect(
      isFilingDeadlineEvent({
        source: "Event",
        category: "Hearing",
        filingDeadline: "2026-06-15"
      })
    ).toBe(false);
    expect(
      isFilingDeadlineEvent({
        source: "Task",
        category: "Court Filing",
        filingDeadline: "2026-06-15"
      })
    ).toBe(false);
  });

  it("classifies overdue filings", () => {
    const item = filingEvent({ filingDeadline: "2026-06-09", date: "2026-06-09" });
    expect(filingDeadlineUrgency(item, TODAY)).toBe("overdue");
    expect(needsFilingConfirmation(item, TODAY)).toBe(true);
  });

  it("classifies due-today filings", () => {
    const item = filingEvent({ filingDeadline: TODAY, date: TODAY });
    expect(filingDeadlineUrgency(item, TODAY)).toBe("due-today");
  });

  it("classifies confirm-soon within reminder lead days", () => {
    const item = filingEvent({ filingDeadline: "2026-06-14", date: "2026-06-14", reminderDays: 5 });
    expect(filingDeadlineUrgency(item, TODAY)).toBe("confirm-soon");
    expect(needsFilingConfirmation(item, TODAY)).toBe(true);
  });

  it("classifies due-soon within 21-day horizon but outside confirm window", () => {
    const item = filingEvent({ filingDeadline: "2026-06-25", date: "2026-06-25", reminderDays: 2 });
    expect(filingDeadlineUrgency(item, TODAY)).toBe("due-soon");
    expect(needsFilingConfirmation(item, TODAY)).toBe(false);
  });

  it("returns null for submitted or done filings", () => {
    expect(filingDeadlineUrgency(filingEvent({ status: "Submitted", done: true }), TODAY)).toBeNull();
    expect(isOpenFilingEvent(filingEvent({ done: true }))).toBe(false);
  });

  it("sorts alerts overdue first, then by deadline", () => {
    const alerts = listFilingDeadlineAlerts(
      [
        filingEvent({ id: "E-1", filingDeadline: "2026-06-20", date: "2026-06-20", reminderDays: 1 }),
        filingEvent({ id: "E-2", filingDeadline: "2026-06-09", date: "2026-06-09" }),
        filingEvent({ id: "E-3", filingDeadline: TODAY, date: TODAY })
      ],
      TODAY
    );
    expect(alerts.map((a) => a.urgency)).toEqual(["overdue", "due-today", "due-soon"]);
  });
});
