import { describe, expect, it } from "vitest";
import { resolveGenericTaskChecklistItems } from "@/lib/office-tasks/task-prep-checklist";
import {
  ADMINISTRATIVE_PREP,
  COURT_FILING_PREP,
  defaultTaskChecklistItems,
  GENERAL_TASK_PREP
} from "@/lib/office-tasks/task-form-utils";

describe("task prep checklist", () => {
  it("uses the first three type-specific prep items for Court Follow-up", () => {
    expect(resolveGenericTaskChecklistItems({ category: "Court Follow-up" })).toEqual([
      ...COURT_FILING_PREP.slice(0, 3)
    ]);
    expect(defaultTaskChecklistItems("Court Follow-up")).toEqual([...COURT_FILING_PREP.slice(0, 3)]);
  });

  it("uses administrative prep items for Administrative tasks", () => {
    expect(resolveGenericTaskChecklistItems({ category: "Administrative" })).toEqual([
      ...ADMINISTRATIVE_PREP.slice(0, 3)
    ]);
  });

  it("uses general prep items for plain Task rows", () => {
    expect(resolveGenericTaskChecklistItems({ category: "Task" })).toEqual([...GENERAL_TASK_PREP]);
  });
});
