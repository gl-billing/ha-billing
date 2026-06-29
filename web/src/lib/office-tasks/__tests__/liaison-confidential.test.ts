import { describe, expect, it } from "vitest";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";
import {
  excludeLiaisonConfidentialItems,
  filterLiaisonConfidentialItems,
  filterVisibleOfficeItems,
  isLiaisonConfidentialItem,
  liaisonConfidentialItemsForViewer,
  markLiaisonConfidentialRemarks
} from "@/lib/office-tasks/liaison-confidential";

describe("liaison-confidential", () => {
  it("detects and marks confidential liaison tasks", () => {
    const marked = markLiaisonConfidentialRemarks("Admin note");
    const item = makeItem({ remarks: marked, source: "Task" });
    expect(isLiaisonConfidentialItem(item)).toBe(true);
  });

  it("hides confidential tasks from general views for other staff", () => {
    const open = makeItem({ id: "T-open" });
    const secret = makeItem({
      id: "T-secret",
      remarks: markLiaisonConfidentialRemarks(""),
      assignedTo: "James Bryan Hakola"
    });
    const items = [open, secret];

    expect(filterVisibleOfficeItems(items, { canViewLiaisonConfidential: false })).toEqual([open]);
    expect(excludeLiaisonConfidentialItems(items)).toEqual([open]);
    expect(filterLiaisonConfidentialItems(items).map((row) => row.id)).toEqual(["T-secret"]);
  });

  it("shows liaison only their confidential assignments", () => {
    const mine = makeItem({
      id: "T-mine",
      remarks: markLiaisonConfidentialRemarks(""),
      assignedTo: "James Bryan Hakola"
    });
    const other = makeItem({
      id: "T-other",
      remarks: markLiaisonConfidentialRemarks(""),
      assignedTo: "James Bryan Hakola, Atty. Maria Hernandez"
    });
    const roster = ["James Bryan Hakola", "Atty. Maria Hernandez"];

    const liaisonView = liaisonConfidentialItemsForViewer([mine, other], {
      isAdmin: false,
      staffName: "James Bryan Hakola",
      roster
    });
    expect(liaisonView.map((row) => row.id).sort()).toEqual(["T-mine", "T-other"]);

    const adminView = liaisonConfidentialItemsForViewer([mine, other], { isAdmin: true });
    expect(adminView).toHaveLength(2);
  });
});
