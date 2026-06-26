import { describe, expect, it } from "vitest";
import { formatConsolidateSummary } from "@/lib/office-tasks/sheets/consolidate-sheet-rows";

describe("formatConsolidateSummary", () => {
  it("describes moved tasks and events", () => {
    const message = formatConsolidateSummary({
      events: { moved: 6, primaryEnd: 95, newEnd: 101, cleared: 6 },
      tasks: { moved: 2, primaryEnd: 62, newEnd: 64, cleared: 2 }
    });
    expect(message).toContain("6 hearings/events now rows 96–101");
    expect(message).toContain("2 tasks now rows 63–64");
  });

  it("reports when nothing needs moving", () => {
    const message = formatConsolidateSummary({
      events: { moved: 0, primaryEnd: 95, newEnd: 95, cleared: 0 },
      tasks: { moved: 0, primaryEnd: 62, newEnd: 62, cleared: 0 }
    });
    expect(message).toContain("already contiguous");
  });
});
