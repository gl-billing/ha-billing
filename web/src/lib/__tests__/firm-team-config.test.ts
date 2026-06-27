import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIRM_LAWYERS_ROSTER,
  DEFAULT_STAFF_PAYROLL_ROSTER,
  MANAGING_PARTNER,
  SECRETARY
} from "@/lib/firm-team-config";

describe("firm team config", () => {
  it("lists associate lawyers for fee sharing", () => {
    expect(DEFAULT_FIRM_LAWYERS_ROSTER.map((entry) => entry.displayName)).toEqual([
      "Atty. April Liz Parreno",
      "Atty. Jeff Pasagui"
    ]);
    expect(DEFAULT_FIRM_LAWYERS_ROSTER.every((entry) => entry.overseesTasks)).toBe(true);
  });

  it("links payroll staff to the managing partner", () => {
    expect(DEFAULT_STAFF_PAYROLL_ROSTER[0]?.displayName).toBe(SECRETARY.displayName);
    expect(DEFAULT_STAFF_PAYROLL_ROSTER[0]?.associatedLawyerName).toBe(MANAGING_PARTNER.displayName);
  });
});
