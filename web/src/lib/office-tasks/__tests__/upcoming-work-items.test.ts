import { describe, expect, it } from "vitest";
import { filterUpcomingWorkItems } from "@/lib/office-tasks/today-lists";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

describe("filterUpcomingWorkItems", () => {
  it("includes open items due after today within the horizon", () => {
    const items = [
      makeItem({ id: "E-1", source: "Event", date: "2026-06-20", assignedTo: "Andrea" }),
      makeItem({ id: "T-1", date: "2026-06-07", assignedTo: "Andrea" }),
      makeItem({ id: "T-2", date: "2026-12-01", assignedTo: "Andrea" })
    ];

    const upcoming = filterUpcomingWorkItems(items, "2026-06-07", 90);
    expect(upcoming.map((item) => item.id)).toEqual(["E-1"]);
  });
});
