import { describe, expect, it } from "vitest";
import { defaultEventResponsiblePerson } from "@/lib/office-tasks/event-form-utils";

const ROSTER = ["Ellyza Andrea Aguanta (Secretary)", "Atty. Maria Hernandez", "James Bryan Hakola"];

describe("defaultEventResponsiblePerson", () => {
  it("defaults filing events to the case attorney", () => {
    expect(defaultEventResponsiblePerson("Court Filing", { assignedAttorney: "Atty. Maria Hernandez" }, ROSTER)).toBe(
      "Atty. Maria Hernandez"
    );
  });

  it("defaults appearance events to the case attorney", () => {
    expect(defaultEventResponsiblePerson("Hearing", { assignedAttorney: "Atty. Maria Hernandez" }, ROSTER)).toBe(
      "Atty. Maria Hernandez"
    );
  });
});
