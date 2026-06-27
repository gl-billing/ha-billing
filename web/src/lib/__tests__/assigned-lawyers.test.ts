import { describe, expect, it } from "vitest";
import {
  buildFirmLawyerDropdownOptions,
  distinctMatterLawyers,
  formatClientAssignedLawyers,
  matterHasSoleAssignedLawyer,
  resolveAcceptanceFeeAssociateFromClient
} from "@/lib/assigned-lawyers";
import { MANAGING_PARTNER } from "@/lib/firm-team-config";
import type { FirmLawyerRosterEntry } from "@/lib/firm-lawyers-roster";

const ROSTER: FirmLawyerRosterEntry[] = [
  {
    id: "atty-robert-hernandez",
    displayName: MANAGING_PARTNER.displayName,
    designation: "Founding / Managing Partner",
    email: MANAGING_PARTNER.emails[0],
    feeSharePercent: 100,
    overseesTasks: true,
    active: true
  },
  {
    id: "atty-april-liz-parreno",
    displayName: "Atty. April Liz Parreno",
    email: "lizparreno595@gmail.com",
    feeSharePercent: 50,
    overseesTasks: true,
    active: true
  },
  {
    id: "atty-jeff-pasagui",
    displayName: "Atty. Jeff Pasagui",
    email: "jlppasagui@gmail.com",
    feeSharePercent: 50,
    overseesTasks: true,
    active: true
  }
];

describe("assigned lawyers", () => {
  it("builds dropdown options from payroll lawyers with managing partner first", () => {
    expect(buildFirmLawyerDropdownOptions(ROSTER)).toEqual([
      MANAGING_PARTNER.displayName,
      "Atty. April Liz Parreno",
      "Atty. Jeff Pasagui"
    ]);
  });

  it("formats one or two assigned lawyers for display", () => {
    expect(formatClientAssignedLawyers(MANAGING_PARTNER.displayName, "Atty. Jeff Pasagui")).toBe(
      `${MANAGING_PARTNER.displayName} · Atty. Jeff Pasagui`
    );
    expect(formatClientAssignedLawyers(MANAGING_PARTNER.displayName)).toBe(MANAGING_PARTNER.displayName);
  });

  it("resolves the associate for acceptance fee sharing", () => {
    expect(
      resolveAcceptanceFeeAssociateFromClient(MANAGING_PARTNER.displayName, "Atty. April Liz Parreno")
    ).toBe("Atty. April Liz Parreno");
  });

  it("detects sole vs dual lawyers on a matter", () => {
    expect(distinctMatterLawyers(MANAGING_PARTNER.displayName)).toEqual([MANAGING_PARTNER.displayName]);
    expect(
      distinctMatterLawyers(MANAGING_PARTNER.displayName, "Atty. Jeff Pasagui")
    ).toEqual([MANAGING_PARTNER.displayName, "Atty. Jeff Pasagui"]);
    expect(matterHasSoleAssignedLawyer(MANAGING_PARTNER.displayName)).toBe(true);
    expect(matterHasSoleAssignedLawyer(MANAGING_PARTNER.displayName, "Atty. Jeff Pasagui")).toBe(false);
  });
});
