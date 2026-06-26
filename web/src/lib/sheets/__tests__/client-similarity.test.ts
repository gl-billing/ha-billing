import { describe, expect, it } from "vitest";
import { findSimilarClients } from "@/lib/sheets/client-similarity";
import type { ClientSummary } from "@/lib/gl-config";

const clients: ClientSummary[] = [
  {
    code: "CHICKEN",
    name: "Chicken",
    caseTitle: "Qualified Theft",
    caseNumber: "",
    courtPending: "",
    totalDue: 0,
    lastInvoiceDate: "",
    assignedAttorney: ""
  },
  {
    code: "PEO",
    name: "Janezza Santos",
    caseTitle: "People vs Santos",
    caseNumber: "",
    courtPending: "",
    totalDue: 0,
    lastInvoiceDate: "",
    assignedAttorney: ""
  }
];

describe("findSimilarClients", () => {
  it("does not suggest profiles that only share a case title", () => {
    const matches = findSimilarClients(clients, { caseTitle: "Qualified Theft" });
    expect(matches).toHaveLength(0);
  });

  it("does not merge two unrelated clients with the same crime name", () => {
    const sameCrimeClients: ClientSummary[] = [
      ...clients,
      {
        code: "BACO",
        name: "Baco",
        caseTitle: "Qualified Theft",
        caseNumber: "",
        courtPending: "",
        balance: 0,
        status: "Active",
        accountStatus: "Active",
        email: ""
      }
    ];
    const matches = findSimilarClients(sameCrimeClients, {
      clientName: "Baco",
      caseTitle: "Qualified Theft"
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.code).toBe("BACO");
  });

  it("still matches on client name", () => {
    const matches = findSimilarClients(clients, { clientName: "Chicken", caseTitle: "Qualified Theft" });
    expect(matches[0]?.code).toBe("CHICKEN");
  });
});
