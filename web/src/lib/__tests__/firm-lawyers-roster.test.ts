import { describe, expect, it } from "vitest";
import {
  ensureManagingPartnerOnRoster,
  isManagingPartnerRosterEntry,
  type FirmLawyerRosterEntry
} from "@/lib/firm-lawyers-roster";
import { DEFAULT_FIRM_LAWYERS_ROSTER, MANAGING_PARTNER } from "@/lib/firm-team-config";

const ASSOCIATES: FirmLawyerRosterEntry[] = DEFAULT_FIRM_LAWYERS_ROSTER.slice(1);

describe("firm lawyers roster", () => {
  it("lists managing partner first with founding designation", () => {
    const roster = ensureManagingPartnerOnRoster([...ASSOCIATES]);
    expect(roster[0]?.displayName).toBe(MANAGING_PARTNER.displayName);
    expect(roster[0]?.designation).toBe("Founding / Managing Partner");
    expect(roster.map((entry) => entry.displayName)).toEqual([
      MANAGING_PARTNER.displayName,
      "Atty. April Liz Parreno",
      "Atty. Jeff Pasagui"
    ]);
  });

  it("moves an existing Robert Hernandez entry to the top", () => {
    const roster = ensureManagingPartnerOnRoster([
      ASSOCIATES[0]!,
      {
        ...DEFAULT_FIRM_LAWYERS_ROSTER[0]!,
        designation: undefined
      }
    ]);
    expect(roster[0]?.displayName).toBe(MANAGING_PARTNER.displayName);
    expect(roster[0]?.designation).toBe("Founding / Managing Partner");
  });

  it("seeds the full default roster when empty", () => {
    expect(ensureManagingPartnerOnRoster([])).toEqual(DEFAULT_FIRM_LAWYERS_ROSTER);
  });

  it("detects the managing partner row", () => {
    expect(isManagingPartnerRosterEntry(DEFAULT_FIRM_LAWYERS_ROSTER[0]!)).toBe(true);
    expect(isManagingPartnerRosterEntry(ASSOCIATES[0]!)).toBe(false);
  });
});
