import { describe, expect, it } from "vitest";
import {
  inferPrepLeadDaysBefore,
  prepTaskDueDateForFilingDeadline,
  resetPrepTaskRemarks,
  updatePrepTaskDescriptionForDeadline
} from "@/lib/office-tasks/filing-prep-reset";
import { prepChecklistMarker } from "@/lib/office-tasks/prep-checklist-storage";

describe("filing prep reset", () => {
  it("infers lead days from prep task description", () => {
    expect(
      inferPrepLeadDaysBefore(
        {
          date: "2026-06-12",
          details: "Filing prep for responsive pleading due 2026-06-15 (this task is due 3 days before)."
        },
        "2026-06-15"
      )
    ).toBe(3);
  });

  it("computes prep due date from filing deadline and lead days", () => {
    expect(
      prepTaskDueDateForFilingDeadline(
        {
          date: "2026-06-12",
          details: "Filing prep due 2026-06-15 (this task is due 3 days before)."
        },
        "2026-06-20"
      )
    ).toBe("2026-06-17");
  });

  it("updates deadline text in prep description", () => {
    expect(
      updatePrepTaskDescriptionForDeadline(
        "Filing prep for court filing due 2026-06-15 (this task is due 3 days before).",
        "2026-06-25"
      )
    ).toContain("due 2026-06-25");
  });

  it("clears checklist progress and prep-done notice on reset", () => {
    const marker = prepChecklistMarker({ items: ["Fee", "Sign"], done: [0] });
    const remarks = `EVENT_REMINDER:EVT-1\nPREP_DONE_NOTICE:Jas:2026-06-10\n${marker}`;
    const reset = resetPrepTaskRemarks(remarks);
    expect(reset.remarks).toContain("PREP_CHECKLIST:");
    expect(reset.remarks).not.toContain("PREP_DONE_NOTICE");
    expect(reset.nextAction).toBe("Complete prep: Fee");
  });
});
