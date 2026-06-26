import { describe, expect, it } from "vitest";
import {
  applyPrepChecklistMutation,
  applyPrepChecklistToggle,
  createPrepChecklistState,
  nextActionAfterPrepChecklistDelete,
  nextActionForPrepChecklist,
  parsePrepChecklistState,
  prepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";

describe("prep checklist storage", () => {
  it("stores and parses checklist state in remarks", () => {
    const remarks = `EVENT_REMINDER:EVT-1\n${prepChecklistMarker(createPrepChecklistState(["Fee", "Sign"]))}`;
    const state = parsePrepChecklistState(remarks);
    expect(state?.items).toEqual(["Fee", "Sign"]);
    expect(state?.done).toEqual([]);
  });

  it("toggles checklist items and updates next action", () => {
    const base = prepChecklistMarker(createPrepChecklistState(["Fee", "Sign", "File"]));
    const toggled = applyPrepChecklistToggle(base, 0, true);
    const state = parsePrepChecklistState(toggled || "");
    expect(state?.done).toEqual([0]);
    expect(nextActionForPrepChecklist(state!)).toBe("Complete prep: Sign");
  });

  it("adds, edits, and removes checklist items", () => {
    const base = prepChecklistMarker(createPrepChecklistState(["Fee", "Sign"]));
    const added = applyPrepChecklistMutation(base, { action: "add", label: "File" });
    expect(parsePrepChecklistState(added || "")?.items).toEqual(["Fee", "Sign", "File"]);

    const edited = applyPrepChecklistMutation(added || "", { action: "edit", itemIndex: 1, label: "Notarize" });
    expect(parsePrepChecklistState(edited || "")?.items).toEqual(["Fee", "Notarize", "File"]);

    const checked = applyPrepChecklistToggle(edited || "", 2, true);
    const removed = applyPrepChecklistMutation(checked || "", { action: "remove", itemIndex: 0 });
    const state = parsePrepChecklistState(removed || "");
    expect(state?.items).toEqual(["Notarize", "File"]);
    expect(state?.done).toEqual([1]);
  });

  it("deletes the entire checklist and clears prep next actions", () => {
    const base = `EVENT_REMINDER:EVT-1\n${prepChecklistMarker(createPrepChecklistState(["Fee", "Sign"]))}`;
    const deleted = applyPrepChecklistMutation(base, { action: "delete" });
    expect(parsePrepChecklistState(deleted || "")).toBeNull();
    expect(deleted).toBe("EVENT_REMINDER:EVT-1");

    expect(nextActionAfterPrepChecklistDelete("Complete prep: Sign")).toBe("");
    expect(nextActionAfterPrepChecklistDelete("Follow up with client")).toBe("Follow up with client");
  });
});
