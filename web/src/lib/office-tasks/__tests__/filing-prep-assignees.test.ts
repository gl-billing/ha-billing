import { describe, expect, it } from "vitest";
import {
  buildFilingPrepAssignees,
  defaultFilingPrepAssignees,
  resolveAndreaAssignee,
  resolveJasAssignee
} from "@/lib/office-tasks/task-assignees";

const ROSTER = ["Ellyza Andrea Aguanta (Secretary)", "James Bryan Hakola", "Atty. Maria Hernandez"];

describe("filing prep assignees", () => {
  it("defaults prep to Andrea only", () => {
    expect(defaultFilingPrepAssignees(ROSTER)).toBe("Ellyza Andrea Aguanta (Secretary)");
  });

  it("builds Andrea and Jas when both selected", () => {
    expect(buildFilingPrepAssignees({ andrea: true, jas: true }, ROSTER)).toBe(
      "Ellyza Andrea Aguanta (Secretary), James Bryan Hakola"
    );
  });

  it("builds Jas only when Andrea is unchecked", () => {
    expect(buildFilingPrepAssignees({ andrea: false, jas: true }, ROSTER)).toBe("James Bryan Hakola");
  });

  it("resolves Jas from roster", () => {
    expect(resolveJasAssignee(ROSTER)).toBe("James Bryan Hakola");
    expect(resolveAndreaAssignee(ROSTER)).toBe("Ellyza Andrea Aguanta (Secretary)");
  });
});
