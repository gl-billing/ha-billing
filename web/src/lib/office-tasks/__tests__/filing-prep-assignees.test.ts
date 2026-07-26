import { describe, expect, it } from "vitest";
import {
  buildFilingPrepAssignees,
  defaultFilingPrepAssignees,
  resolveAndreaAssignee,
  resolveJasAssignee
} from "@/lib/office-tasks/task-assignees";

const ROSTER = ["Shiela (Secretary)", "Liaison Officer", "Atty. Maria Hernandez"];

describe("filing prep assignees", () => {
  it("defaults prep to secretary only", () => {
    expect(defaultFilingPrepAssignees(ROSTER)).toBe("Shiela (Secretary)");
  });

  it("builds secretary and liaison when both selected", () => {
    expect(buildFilingPrepAssignees({ andrea: true, jas: true }, ROSTER)).toBe(
      "Shiela (Secretary), Liaison Officer"
    );
  });

  it("builds liaison only when secretary is unchecked", () => {
    expect(buildFilingPrepAssignees({ andrea: false, jas: true }, ROSTER)).toBe("Liaison Officer");
  });

  it("resolves liaison from roster", () => {
    expect(resolveJasAssignee(ROSTER)).toBe("Liaison Officer");
    expect(resolveAndreaAssignee(ROSTER)).toBe("Shiela (Secretary)");
  });
});
