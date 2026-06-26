import { describe, expect, it } from "vitest";
import { parseHearingPrepItemsFromDetails } from "@/lib/office-tasks/event-form-utils";
import {
  attachHearingPrepChecklistToRemarks,
  buildHearingPrepChecklistMarker,
  hearingPrepChecklistItemsForEvent
} from "@/lib/office-tasks/hearing-prep-checklist";
import { parsePrepChecklistState } from "@/lib/office-tasks/prep-checklist-storage";

describe("hearing prep checklist", () => {
  it("parses selected hearing prep items from details", () => {
    const items = parseHearingPrepItemsFromDetails(
      "Main hearing\n\nHearing prep: Confirm hearing date & time with court; Review pleadings & exhibits"
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Confirm hearing date");
  });

  it("defaults to full hearing prep list when none selected", () => {
    expect(hearingPrepChecklistItemsForEvent("Regular hearing")).toHaveLength(6);
  });

  it("stores interactive checklist marker on event remarks", () => {
    const remarks = attachHearingPrepChecklistToRemarks("", "Hearing prep: Confirm hearing date & time with court");
    expect(parsePrepChecklistState(remarks)?.items).toHaveLength(1);
    expect(buildHearingPrepChecklistMarker("")).toContain("PREP_CHECKLIST:");
  });
});
