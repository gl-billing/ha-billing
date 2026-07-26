import { describe, expect, it } from "vitest";
import { filterItemsForMyWork } from "@/lib/office-tasks/my-work-filter";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

const ROSTER = ["Atty. Maria Hernandez", "Liaison Officer", "Atty. Carlos Hernandez"];

describe("filterItemsForMyWork", () => {
  it("keeps items assigned to the staff member", () => {
    const items = [
      makeItem({ id: "T-1", assignedTo: "Liaison Officer" }),
      makeItem({ id: "T-2", assignedTo: "Atty. Carlos Hernandez" }),
      makeItem({ id: "T-3", assignedTo: "Unassigned" })
    ];

    const mine = filterItemsForMyWork(items, "Liaison Officer", ROSTER);
    expect(mine.map((item) => item.id)).toEqual(["T-1"]);
  });

  it("matches any assignee in a comma-separated list", () => {
    const items = [makeItem({ id: "T-1", assignedTo: "Nikki, Liaison Officer" })];
    const mine = filterItemsForMyWork(items, "Liaison Officer", ROSTER);
    expect(mine.map((item) => item.id)).toEqual(["T-1"]);
  });

  it("maps owner/admin alias to the firm owner on the roster", () => {
    const items = [makeItem({ id: "T-1", assignedTo: "Owner/Admin" })];
    const mine = filterItemsForMyWork(items, "Atty. Maria Hernandez", ROSTER);
    expect(mine.map((item) => item.id)).toEqual(["T-1"]);
  });

  it("includes pending court-confirmation hearings in secretary my work", () => {
    const roster = [...ROSTER, "Shiela (Secretary)"];
    const items = [
      makeItem({
        source: "Event",
        id: "CHI-EVT-0009",
        category: "Hearing",
        clientCase: "Qualified Theft — Hearing Monday",
        assignedTo: "Atty. Maria Hernandez",
        status: "Scheduled",
        date: "2026-06-12",
        eventDate: "2026-06-12"
      })
    ];

    const mine = filterItemsForMyWork(items, "Shiela (Secretary)", roster);
    expect(mine.map((item) => item.id)).toEqual(["CHI-EVT-0009"]);
  });
});
