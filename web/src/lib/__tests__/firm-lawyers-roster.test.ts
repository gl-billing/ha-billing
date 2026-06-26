import { describe, expect, it } from "vitest";
import {
  ensureUniqueFirmLawyerId,
  findFirmLawyerByEmail,
  lawyerFeeShareAmount,
  normalizeFirmLawyerDisplayName,
  parseFirmLawyersRoster
} from "@/lib/firm-lawyers-roster";

describe("firm lawyers roster", () => {
  it("normalizes display names with Atty. prefix", () => {
    expect(normalizeFirmLawyerDisplayName("Maria Hernandez")).toBe("Atty. Maria Hernandez");
    expect(normalizeFirmLawyerDisplayName("Atty. Carlos Hernandez")).toBe("Atty. Carlos Hernandez");
  });

  it("parses roster JSON", () => {
    const roster = parseFirmLawyersRoster(
      JSON.stringify([
        {
          id: "atty-maria",
          displayName: "Maria Hernandez",
          email: "maria@example.com",
          feeSharePercent: 60,
          overseesTasks: true,
          active: true
        }
      ])
    );
    expect(roster).toHaveLength(1);
    expect(roster[0]?.displayName).toBe("Atty. Maria Hernandez");
    expect(roster[0]?.feeSharePercent).toBe(60);
  });

  it("finds lawyer by email and computes fee share", () => {
    const roster = parseFirmLawyersRoster(
      JSON.stringify([
        {
          displayName: "Atty. Maria Hernandez",
          email: "maria@example.com",
          feeSharePercent: 50,
          overseesTasks: true
        }
      ])
    );
    expect(findFirmLawyerByEmail(roster, "maria@example.com")?.displayName).toContain("Maria");
    expect(lawyerFeeShareAmount(10000, 50)).toBe(5000);
    expect(ensureUniqueFirmLawyerId("Atty. Carlos Hernandez", roster)).toBe("atty-carlos-hernandez");
  });
});
