import { describe, expect, it } from "vitest";
import { filterStaffWorkloadItems } from "@/lib/office-tasks/andrea-workload";
import { getTeamEmployeeView } from "@/lib/office-tasks/schedule";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

const ROSTER = [
  "Ellyza Andrea Aguanta (Secretary)",
  "Atty. Maria Hernandez",
  "James Bryan Hakola"
];

describe("filterStaffWorkloadItems", () => {
  it("adds pending court-confirmation hearings to Andrea even when assigned to the attorney", () => {
    const items = [
      makeItem({
        source: "Event",
        id: "CHI-EVT-0001",
        rowNumber: 3,
        category: "Hearing",
        clientCase: "Qualified Theft — Hearing Monday",
        assignedTo: "Atty. Maria Hernandez",
        status: "Scheduled",
        date: "2026-06-12",
        eventDate: "2026-06-12",
        venue: "RTC Branch 1"
      })
    ];

    const janine = filterStaffWorkloadItems("Atty. Maria Hernandez", items, ROSTER);
    expect(janine.map((item) => item.id)).toEqual(["CHI-EVT-0001"]);

    const andrea = filterStaffWorkloadItems("Ellyza Andrea Aguanta (Secretary)", items, ROSTER);
    expect(andrea.map((item) => item.id)).toEqual(["CHI-EVT-0001"]);
  });

  it("does not duplicate hearings already assigned to Andrea", () => {
    const items = [
      makeItem({
        source: "Event",
        id: "CHI-EVT-0002",
        rowNumber: 4,
        category: "Hearing",
        clientCase: "Chicken — Qualified Theft",
        assignedTo: "Ellyza Andrea Aguanta (Secretary)",
        status: "Scheduled",
        date: "2026-06-13",
        eventDate: "2026-06-13"
      })
    ];

    const andrea = filterStaffWorkloadItems("Ellyza Andrea Aguanta (Secretary)", items, ROSTER);
    expect(andrea).toHaveLength(1);
  });
});
