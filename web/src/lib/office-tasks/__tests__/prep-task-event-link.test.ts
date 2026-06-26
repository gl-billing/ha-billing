import { describe, expect, it } from "vitest";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";
import {
  parsePrepTaskDescription,
  resolveFilingEventForPrepTask,
  resolvePrepTaskForEvent
} from "@/lib/office-tasks/prep-task-event-link";

describe("prep task event link", () => {
  it("parses legacy prep task description", () => {
    const parsed = parsePrepTaskDescription(
      "Prep checklist for responsive pleading (civil/administrative case) due 2026-06-15 (this task is due 2 days before)."
    );
    expect(parsed.filingDeadline).toBe("2026-06-15");
    expect(parsed.pleadingType).toBe("Responsive pleading");
    expect(parsed.pleadingCaseNature).toBe("Civil/Administrative");
  });

  it("matches filing event by client case and deadline when task has no link markers", () => {
    const clientCase = "Melody Alimasag — Alimasag vs. Batilong";
    const task = makeItem({
      id: "ALI-TASK-0001",
      source: "Task",
      date: "2026-06-13",
      clientCase,
      details:
        "Prep checklist for responsive pleading (civil/administrative case) due 2026-06-15 (this task is due 2 days before)."
    });
    const event = makeItem({
      id: "ALI-EVT-0001",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-15",
      clientCase,
      pleadingType: "Responsive pleading",
      pleadingCaseNature: "Civil/Administrative"
    });

    const matched = resolveFilingEventForPrepTask(task, [task, event]);
    expect(matched?.id).toBe("ALI-EVT-0001");
  });

  it("prefers reverse link on event remarks", () => {
    const task = makeItem({ id: "ALI-TASK-0002", source: "Task", clientCase: "Sample case" });
    const otherEvent = makeItem({
      id: "ALI-EVT-0009",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-15",
      clientCase: "Sample case"
    });
    const linkedEvent = makeItem({
      id: "ALI-EVT-0010",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-20",
      clientCase: "Sample case",
      remarks: "LINKED_REMINDER_TASK:ALI-TASK-0002"
    });

    const matched = resolveFilingEventForPrepTask(task, [task, otherEvent, linkedEvent]);
    expect(matched?.id).toBe("ALI-EVT-0010");
  });

  it("matches the correct filing when the same client has multiple open deadlines", () => {
    const clientCase = "John Smith — Collection";
    const eventJune = makeItem({
      id: "JOH-EVT-0001",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-15",
      clientCase
    });
    const eventJuly = makeItem({
      id: "JOH-EVT-0002",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-07-20",
      clientCase
    });
    const prepJune = makeItem({
      id: "JOH-TASK-0001",
      source: "Task",
      date: "2026-06-12",
      clientCase,
      details:
        "Filing prep for initiatory pleading due 2026-06-15 (this task is due 3 days before)."
    });
    const prepJuly = makeItem({
      id: "JOH-TASK-0002",
      source: "Task",
      date: "2026-07-17",
      clientCase,
      details:
        "Filing prep for responsive pleading due 2026-07-20 (this task is due 3 days before)."
    });

    expect(resolveFilingEventForPrepTask(prepJune, [prepJune, prepJuly, eventJune, eventJuly])?.id).toBe(
      "JOH-EVT-0001"
    );
    expect(resolveFilingEventForPrepTask(prepJuly, [prepJune, prepJuly, eventJune, eventJuly])?.id).toBe(
      "JOH-EVT-0002"
    );
    expect(resolvePrepTaskForEvent(eventJune, [prepJune, prepJuly, eventJune, eventJuly])?.id).toBe(
      "JOH-TASK-0001"
    );
    expect(resolvePrepTaskForEvent(eventJuly, [prepJune, prepJuly, eventJune, eventJuly])?.id).toBe(
      "JOH-TASK-0002"
    );
  });

  it("does not fuzzy-match legacy prep tasks without a filing deadline in the description", () => {
    const clientCase = "John Smith — Collection";
    const events = [
      makeItem({
        id: "JOH-EVT-0001",
        source: "Event",
        category: "Court Filing",
        filingDeadline: "2026-06-15",
        clientCase
      }),
      makeItem({
        id: "JOH-EVT-0002",
        source: "Event",
        category: "Court Filing",
        filingDeadline: "2026-07-20",
        clientCase
      })
    ];
    const legacyPrep = makeItem({
      id: "JOH-TASK-0099",
      source: "Task",
      clientCase,
      details: "Filing prep for initiatory pleading (this task is due 3 days before)."
    });

    expect(resolveFilingEventForPrepTask(legacyPrep, [legacyPrep, ...events])).toBeNull();
    expect(resolvePrepTaskForEvent(events[0], [legacyPrep, ...events])).toBeNull();
    expect(resolvePrepTaskForEvent(events[1], [legacyPrep, ...events])).toBeNull();
  });

  it("does not attach one event's prep task to another event with a different deadline", () => {
    const clientCase = "John Smith — Collection";
    const eventJune = makeItem({
      id: "JOH-EVT-0001",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-15",
      clientCase
    });
    const eventJuly = makeItem({
      id: "JOH-EVT-0002",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-07-20",
      clientCase,
      remarks: "LINKED_REMINDER_TASK:JOH-TASK-0001"
    });
    const prepJune = makeItem({
      id: "JOH-TASK-0001",
      source: "Task",
      date: "2026-06-12",
      clientCase,
      remarks: "EVENT_REMINDER:JOH-EVT-0001",
      details:
        "Filing prep for initiatory pleading due 2026-06-15 (this task is due 3 days before)."
    });

    const items = [prepJune, eventJune, eventJuly];
    expect(resolvePrepTaskForEvent(eventJune, items)?.id).toBe("JOH-TASK-0001");
    expect(resolvePrepTaskForEvent(eventJuly, items)).toBeNull();
  });

  it("does not guess when the same client has multiple filings on the same deadline", () => {
    const clientCase = "John Smith — Collection";
    const eventA = makeItem({
      id: "JOH-EVT-0001",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-15",
      clientCase,
      pleadingType: "Initiatory pleading"
    });
    const eventB = makeItem({
      id: "JOH-EVT-0002",
      source: "Event",
      category: "Court Filing",
      filingDeadline: "2026-06-15",
      clientCase,
      pleadingType: "Responsive pleading"
    });
    const legacyPrep = makeItem({
      id: "JOH-TASK-0001",
      source: "Task",
      date: "2026-06-12",
      clientCase,
      details:
        "Filing prep for initiatory pleading due 2026-06-15 (this task is due 3 days before)."
    });

    const items = [legacyPrep, eventA, eventB];
    expect(resolveFilingEventForPrepTask(legacyPrep, items)).toBeNull();
    expect(resolvePrepTaskForEvent(eventA, items)).toBeNull();
    expect(resolvePrepTaskForEvent(eventB, items)).toBeNull();
  });
});
