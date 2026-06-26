import { describe, expect, it } from "vitest";
import {
  buildEventPrepLinkNote,
  shouldHideItemFromStaffWorkload
} from "@/lib/office-tasks/event-prep-workload";
import { filterStaffWorkloadItems } from "@/lib/office-tasks/andrea-workload";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";
import {
  resolvePrepWorkloadViewRole,
  shouldShowPrepChecklistForViewer,
  shouldShowPrepLinkForViewer
} from "@/lib/office-tasks/prep-workload-view";

const ROSTER = [
  "Ellyza Andrea Aguanta (Secretary)",
  "Atty. Maria Hernandez",
  "James Bryan Hakola",
  "Atty. Carlos Hernandez"
];

describe("event prep workload split", () => {
  const linkedPair = [
    makeItem({
      source: "Event",
      id: "CHI-EVT-0010",
      rowNumber: 10,
      category: "Court Filing",
      clientCase: "Chicken — Qualified Theft",
      assignedTo: "Atty. Maria Hernandez",
      filingDeadline: "2026-06-15",
      remarks: "LINKED_REMINDER_TASK:CHI-TASK-0010 PREP_ASSIGNEE:Ellyza Andrea Aguanta (Secretary), James Bryan Hakola"
    }),
    makeItem({
      source: "Task",
      id: "CHI-TASK-0010",
      rowNumber: 11,
      category: "Filing prep",
      clientCase: "Chicken — Qualified Theft",
      assignedTo: "Ellyza Andrea Aguanta (Secretary), James Bryan Hakola",
      remarks: "EVENT_REMINDER:CHI-EVT-0010",
      details: "Filing prep for initiatory pleading due 2026-06-15 (this task is due 3 days before)."
    })
  ];

  it("expands linked pairs into each role's My Work queue", () => {
    expect(filterStaffWorkloadItems("Ellyza Andrea Aguanta (Secretary)", linkedPair, ROSTER).map((i) => i.id)).toEqual(
      expect.arrayContaining(["CHI-TASK-0010", "CHI-EVT-0010"])
    );
    expect(filterStaffWorkloadItems("Atty. Maria Hernandez", linkedPair, ROSTER).map((i) => i.id)).toEqual(
      expect.arrayContaining(["CHI-EVT-0010", "CHI-TASK-0010"])
    );
    expect(filterStaffWorkloadItems("Atty. Carlos Hernandez", linkedPair, ROSTER).map((i) => i.id)).toEqual([]);
  });

  it("does not hide linked filing items from anyone", () => {
    expect(shouldHideItemFromStaffWorkload(linkedPair[0], "Atty. Maria Hernandez", linkedPair, ROSTER)).toBe(
      false
    );
    expect(
      shouldHideItemFromStaffWorkload(linkedPair[1], "Ellyza Andrea Aguanta (Secretary)", linkedPair, ROSTER)
    ).toBe(false);
  });

  it("shows checklist on prep tasks for Andrea and on events for Janine", () => {
    expect(resolvePrepWorkloadViewRole("Ellyza Andrea Aguanta (Secretary)", ROSTER)).toBe("prep");
    expect(resolvePrepWorkloadViewRole("Atty. Maria Hernandez", ROSTER)).toBe("lawyer");
    expect(resolvePrepWorkloadViewRole("Atty. Carlos Hernandez", ROSTER)).toBe("lawyer");

    expect(shouldShowPrepChecklistForViewer(linkedPair[1], linkedPair, "prep")).toBe(true);
    expect(shouldShowPrepChecklistForViewer(linkedPair[0], linkedPair, "prep")).toBe(false);
    expect(shouldShowPrepChecklistForViewer(linkedPair[0], linkedPair, "lawyer")).toBe(true);
    expect(shouldShowPrepChecklistForViewer(linkedPair[1], linkedPair, "lawyer")).toBe(false);
  });

  it("shows cross-links on the opposite card for each role", () => {
    expect(shouldShowPrepLinkForViewer(linkedPair[0], linkedPair, "prep")).toBe(true);
    expect(shouldShowPrepLinkForViewer(linkedPair[1], linkedPair, "prep")).toBe(false);
    expect(shouldShowPrepLinkForViewer(linkedPair[1], linkedPair, "lawyer")).toBe(true);
    expect(shouldShowPrepLinkForViewer(linkedPair[0], linkedPair, "lawyer")).toBe(false);

    const prepEventNote = buildEventPrepLinkNote(linkedPair[0], linkedPair, "prep");
    expect(prepEventNote?.linkLabel).toBe("View prep task");

    const lawyerTaskNote = buildEventPrepLinkNote(linkedPair[1], linkedPair, "lawyer");
    expect(lawyerTaskNote?.linkLabel).toBe("View court filing");
  });
});
