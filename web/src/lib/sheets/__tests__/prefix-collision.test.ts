import { describe, expect, it } from "vitest";
import { findPrefixCollisions } from "@/lib/sheets/prefix-collision";
import type { ClientSummary } from "@/lib/gl-config";

function client(partial: Partial<ClientSummary> & Pick<ClientSummary, "code" | "name">): ClientSummary {
  return {
    caseTitle: "",
    caseNumber: "",
    balance: 0,
    status: "Active",
    accountStatus: "",
    email: "",
    phone: "",
    address: "",
    assignedAttorney: "",
    retainerBalance: 0,
    lastBillingDate: "",
    soaSent: "",
    courtPending: "",
    caseRole: "",
    birthday: "",
    birthdayGreetingSent: "",
    ...partial
  };
}

describe("prefix collisions", () => {
  it("flags clients that share the same task prefix", () => {
    const result = findPrefixCollisions(
      [
        client({ code: "GDCI", name: "GDCI", caseTitle: "Small claims" }),
        client({ code: "OTHER", name: "Alpha", caseTitle: "Unrelated" })
      ],
      { clientCode: "HERNANDEZ", clientName: "Hernandez", caseTitle: "Corporate matter" }
    );

    expect(result.taskPrefix).toBe("HER");
    expect(result.matches.some((match) => match.code === "GDCI")).toBe(false);
  });

  it("flags GDCI when names and cases are similar", () => {
    const result = findPrefixCollisions(
      [client({ code: "GDCI", name: "GDCI", caseTitle: "GDCI small claims" })],
      { clientCode: "HERNANDEZ", clientName: "GDCI", caseTitle: "GDCI corporate" }
    );

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]?.code).toBe("GDCI");
  });

  it("flags billing codes that share a three-letter prefix", () => {
    const result = findPrefixCollisions(
      [client({ code: "HER2024", name: "Old Corp", caseTitle: "Collection" })],
      { clientCode: "HERNANDEZ", clientName: "Hernandez", caseTitle: "New case" }
    );

    expect(result.matches.some((match) => match.code === "HER2024")).toBe(true);
  });
});
