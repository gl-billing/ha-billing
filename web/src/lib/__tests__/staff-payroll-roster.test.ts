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
    expect(roster[0]?.displayName).toBe("James Bryan Hakola");
  });

  it("builds unique ids", () => {
    expect(ensureUniqueStaffPayrollId("Maria Santos", TEST_PAYROLL_ROSTER)).toBe("maria-santos");
    expect(ensureUniqueStaffPayrollId("James Bryan Hakola", TEST_PAYROLL_ROSTER)).toBe("james-bryan-hakola");
  });

  it("maps roster entries to salary profiles", () => {
    const profile = rosterEntryToProfile(TEST_PAYROLL_ROSTER[0]);
    expect(profile.email).toBe("hakola@example.com");
    expect(profile.associatedLawyerName).toBe("Atty. Maria Hernandez");
    expect(findStaffSalaryProfileInRoster(TEST_PAYROLL_ROSTER, "hakola")?.displayName).toBe(
      "James Bryan Hakola"
    );
  });
});
