import { describe, expect, it } from "vitest";
import {
  ensureUniqueStaffPayrollId,
  findStaffSalaryProfileInRoster,
  parseStaffPayrollRoster,
  rosterEntryToProfile
} from "@/lib/staff-payroll-roster";
import { TEST_PAYROLL_ROSTER } from "@/lib/__tests__/fixtures/staff-payroll-roster";

describe("staff payroll roster", () => {
  it("parses roster JSON from settings", () => {
    const roster = parseStaffPayrollRoster(JSON.stringify(TEST_PAYROLL_ROSTER));
    expect(roster).toHaveLength(2);
    expect(roster[0]?.displayName).toBe("Liaison Officer");
  });

  it("builds unique ids", () => {
    expect(ensureUniqueStaffPayrollId("Maria Santos", TEST_PAYROLL_ROSTER)).toBe("maria-santos");
    expect(ensureUniqueStaffPayrollId("Liaison Officer", TEST_PAYROLL_ROSTER)).toBe("liaison-officer");
  });

  it("maps roster entries to salary profiles", () => {
    const profile = rosterEntryToProfile(TEST_PAYROLL_ROSTER[0]);
    expect(profile.email).toBe("liaison@example.com");
    expect(profile.associatedLawyerName).toBe("Atty. Robert Hernandez");
    expect(findStaffSalaryProfileInRoster(TEST_PAYROLL_ROSTER, "liaison")?.displayName).toBe(
      "Liaison Officer"
    );
  });
});
