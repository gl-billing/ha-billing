import { describe, expect, it } from "vitest";
import {
  buildPrepReminderTaskCopy,
  formatPrepChecklist,
  prepChecklistItemsForEvent
} from "@/lib/office-tasks/event-prep-checklist";
import { parsePrepChecklistState } from "@/lib/office-tasks/prep-checklist-storage";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

function filingForm(overrides: Partial<EventFormInput> = {}): EventFormInput {
  return {
    clientCase: "SAMPLE001 · Alpha Test Client",
    category: "Court Filing",
    responsible: "Andrea",
    priority: "Medium",
    filingDeadline: "2026-06-15",
    details: "File motion for extension",
    pleadingType: "Initiatory pleading",
    pleadingCaseNature: "Civil/Administrative",
    ...overrides
  };
}

describe("event prep checklist", () => {
  it("builds initiatory civil/administrative checklist items", () => {
    const items = prepChecklistItemsForEvent(filingForm());
    expect(items[0]).toBe("OR / JEPS filing fee");
    expect(items.some((item) => item.includes("Notice of entry of appearance"))).toBe(true);
  });

  it("builds initiatory criminal checklist items", () => {
    const items = prepChecklistItemsForEvent(
      filingForm({ pleadingCaseNature: "Criminal", pleadingType: "Initiatory pleading" })
    );
    expect(items[0]).toBe("Green form");
    expect(items.some((item) => item.includes("OCP"))).toBe(true);
  });

  it("formats checklist lines with open checkboxes", () => {
    expect(formatPrepChecklist(["Gather exhibits", "Review draft"])).toBe(
      "☐ Gather exhibits\n☐ Review draft"
    );
  });

  it("builds prep reminder task copy without inline checklist text", () => {
    const copy = buildPrepReminderTaskCopy(filingForm(), "2026-06-15", 3);
    expect(copy.description).toContain("Filing prep for initiatory pleading");
    expect(copy.description).not.toContain("☐");
    expect(copy.checklistMarker).toContain("PREP_CHECKLIST:");
    expect(copy.nextAction).toContain("Complete prep:");
    const state = parsePrepChecklistState(copy.checklistMarker);
    expect(state?.items.length).toBeGreaterThan(5);
  });
});
