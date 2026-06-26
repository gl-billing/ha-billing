import { describe, expect, it } from "vitest";
import {
  mergeFilingPrepIntoDetails,
  mergeIncidentIntoSessionNotes,
  parseFilingPrepItemsFromDetails,
  resolveEventPlatform,
  resolveHearingIncident
} from "@/lib/office-tasks/event-form-utils";
import {
  attachFilingPrepChecklistToRemarks,
  buildFilingPrepChecklistMarker
} from "@/lib/office-tasks/filing-prep-checklist-core";
import { parsePrepChecklistState } from "@/lib/office-tasks/prep-checklist-storage";

describe("filing prep checklist", () => {
  it("parses selected filing prep items from details", () => {
    const items = parseFilingPrepItemsFromDetails(
      "Motion to dismiss\n\nFiling prep: OR / JEPS filing fee; Pleading — all pages printed properly and paginated"
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("OR / JEPS");
  });

  it("merges filing prep into details without duplicating", () => {
    const merged = mergeFilingPrepIntoDetails("Draft answer", ["Review received pleading"]);
    expect(merged).toContain("Filing prep: Review received pleading");
    expect(mergeFilingPrepIntoDetails(merged, ["Review received pleading"])).toBe(merged);
  });

  it("stores interactive filing prep marker on event remarks", () => {
    const details = "Filing prep: Confirm filing deadline, court, and filing mode (e-filing / personal / registered mail)";
    const marker = buildFilingPrepChecklistMarker(details, {
      category: "Court Filing",
      pleadingType: "Initiatory pleading",
      pleadingCaseNature: "Civil/Administrative"
    });
    expect(marker).toContain("PREP_CHECKLIST:");
    const remarks = attachFilingPrepChecklistToRemarks("", details, {
      category: "Court Filing",
      pleadingType: "Initiatory pleading",
      pleadingCaseNature: "Civil/Administrative"
    });
    expect(parsePrepChecklistState(remarks)?.items.length).toBeGreaterThan(0);
  });
});

describe("hearing incident", () => {
  it("resolves Other with custom label", () => {
    expect(resolveHearingIncident("Other", "Status conference")).toBe("Other — Status conference");
    expect(resolveHearingIncident("Mediation")).toBe("Mediation");
  });

  it("merges incident into session notes", () => {
    expect(mergeIncidentIntoSessionNotes("Branch 45", "Arraignment")).toBe(
      "Incident: Arraignment\nBranch 45"
    );
  });
});

describe("hearing platform", () => {
  it("resolves hearing platform Other with custom label", () => {
    expect(resolveEventPlatform("Other", "Microsoft Teams")).toBe("Other — Microsoft Teams");
    expect(resolveEventPlatform("Court")).toBe("Court");
    expect(resolveEventPlatform("Video conference")).toBe("Video conference");
  });
});
