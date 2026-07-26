import { describe, expect, it } from "vitest";
import {
  classifyDeskChecklistTypeGroup,
  deskChecklistCompactSummary,
  groupDeskChecklistItemsByType
} from "@/lib/office-tasks/desk-checklist";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

describe("desk checklist type groups", () => {
  it("classifies hearings, events, submissions, and tasks without duplicating tasks", () => {
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Event", category: "Hearing" }))
    ).toBe("hearings");
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Event", category: "Meeting" }))
    ).toBe("events");
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Event", category: "Consultation" }))
    ).toBe("events");
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Event", category: "Court Filing" }))
    ).toBe("submissions");
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Event", category: "Submission" }))
    ).toBe("submissions");
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Event", category: "Deadline" }))
    ).toBe("submissions");
    expect(
      classifyDeskChecklistTypeGroup(makeItem({ source: "Task", category: "Filing prep" }))
    ).toBe("submissions");
    expect(classifyDeskChecklistTypeGroup(makeItem({ source: "Task", category: "Drafting" }))).toBe(
      "tasks"
    );
    expect(classifyDeskChecklistTypeGroup(makeItem({ source: "Task", category: "Task" }))).toBe(
      "tasks"
    );
  });

  it("groups items in Hearings → Events → Submissions → Tasks order", () => {
    const groups = groupDeskChecklistItemsByType([
      makeItem({ id: "T-task", source: "Task", category: "Follow-up", clientCase: "A — Case" }),
      makeItem({ id: "E-file", source: "Event", category: "Court Filing", clientCase: "B — Case" }),
      makeItem({ id: "E-meet", source: "Event", category: "Meeting", clientCase: "C — Case" }),
      makeItem({ id: "E-hear", source: "Event", category: "Hearing", clientCase: "D — Case" }),
      makeItem({ id: "T-prep", source: "Task", category: "Filing prep", clientCase: "E — Case" })
    ]);

    expect(groups.map((g) => g.id)).toEqual(["hearings", "events", "submissions", "tasks"]);
    expect(groups.map((g) => g.title)).toEqual(["Hearings", "Events", "Submissions", "Tasks"]);
    expect(groups.find((g) => g.id === "hearings")?.items.map((i) => i.id)).toEqual(["E-hear"]);
    expect(groups.find((g) => g.id === "events")?.items.map((i) => i.id)).toEqual(["E-meet"]);
    expect(groups.find((g) => g.id === "submissions")?.items.map((i) => i.id)).toEqual([
      "E-file",
      "T-prep"
    ]);
    expect(groups.find((g) => g.id === "tasks")?.items.map((i) => i.id)).toEqual(["T-task"]);
  });

  it("omits empty type groups", () => {
    const groups = groupDeskChecklistItemsByType([
      makeItem({ id: "T-1", source: "Task", category: "Drafting" })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("tasks");
  });
});

describe("deskChecklistCompactSummary", () => {
  it("formats kind · client — case for split clientCase labels", () => {
    const item = makeItem({
      source: "Task",
      category: "Filing prep",
      clientCase: "Jimmy Santos — Santos vs. John Doe",
      remarks: "Filing prep for hearing"
    });
    expect(deskChecklistCompactSummary(item)).toBe(
      "Filing prep · Jimmy Santos — Santos vs. John Doe"
    );
  });

  it("falls back to kind · case when there is no separate client name", () => {
    const item = makeItem({
      source: "Event",
      category: "Hearing",
      clientCase: "ABC — Santos vs. John Doe"
    });
    expect(deskChecklistCompactSummary(item)).toBe("Hearing · Santos vs. John Doe");
  });
});
