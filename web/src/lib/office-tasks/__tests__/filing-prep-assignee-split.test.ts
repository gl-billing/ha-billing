import { describe, expect, it } from "vitest";
import {
  isFilingPrepOperationsStaff,
  responsibleIsFilingPrepStaff
} from "@/lib/office-tasks/prep-staff";
import { resolveFirmOwnerAssignee } from "@/lib/staff-assignee";
import { isAndreaOperationsItem, isFilingPrepItem } from "@/lib/office-tasks/firm-task-groups";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

const ROSTER = ["Ellyza Andrea Aguanta (Secretary)", "Atty. Maria Hernandez", "James Bryan Hakola"];

function task(partial: Partial<OfficeItem>): OfficeItem {
  return {
    source: "Task",
    id: "MAR-TASK-0001",
    rowNumber: 2,
    date: "2026-06-09",
    clientCase: "MAR — Chicken / Qualified Theft",
    category: "Filing prep",
    details: "Filing prep for responsive pleading due 2026-06-12",
    remarks: "EVENT_REMINDER:MAR-EVT-0001",
    assignedTo: "Ellyza Andrea Aguanta (Secretary)",
    status: "In Progress",
    done: false,
    priority: "Medium",
    venue: "",
    nextAction: "",
    previousAction: "",
    lastUpdated: "",
    ...partial
  } as OfficeItem;
}

describe("isFilingPrepItem", () => {
  it("treats filing prep tasks as Andrea operations", () => {
    expect(isFilingPrepItem(task({}))).toBe(true);
    expect(isAndreaOperationsItem(task({}))).toBe(true);
  });

  it("does not treat court filing events as filing prep", () => {
    const event = task({
      source: "Event",
      id: "MAR-EVT-0001",
      category: "Court Filing",
      assignedTo: "Atty. Maria Hernandez"
    });
    expect(isFilingPrepItem(event)).toBe(false);
  });
});

describe("filing prep staff detection", () => {
  it("recognizes Andrea and Jas as prep staff", () => {
    expect(isFilingPrepOperationsStaff("Ellyza Andrea Aguanta (Secretary)", ROSTER)).toBe(true);
    expect(isFilingPrepOperationsStaff("James Bryan Hakola", ROSTER)).toBe(true);
    expect(isFilingPrepOperationsStaff("Atty. Maria Hernandez", ROSTER)).toBe(false);
  });

  it("detects comma-separated prep staff", () => {
    expect(
      responsibleIsFilingPrepStaff("Ellyza Andrea Aguanta (Secretary), James Bryan Hakola", ROSTER)
    ).toBe(true);
    expect(responsibleIsFilingPrepStaff("Atty. Maria Hernandez", ROSTER)).toBe(false);
  });

  it("never treats the firm owner as prep staff", () => {
    const owner = resolveFirmOwnerAssignee(ROSTER);
    expect(owner).toBe("Atty. Maria Hernandez");
    expect(isFilingPrepOperationsStaff(owner!, ROSTER)).toBe(false);
  });
});
