import { describe, expect, it, vi } from "vitest";
import {
  clientCodeCheckBlocksCreate,
  clientCodeCheckCanProceed,
  conflictReviewBlocksProceed,
  formatCodeConflictMessage,
  type ClientCodeCheckResult
} from "@/lib/sheets/client-code-check";
import { checkClientCodeForIntake } from "@/lib/sheets/client-code-check-server";
import type { ClientSummary } from "@/lib/gl-config";

vi.mock("@/lib/sheets/client", () => ({
  sheetExists: vi.fn(async ( _token: string, title: string) => title === "ORPHANTAB")
}));

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

describe("client code check", () => {
  it("blocks when code is already on Master List", async () => {
    const result = await checkClientCodeForIntake(
      "token",
      [client({ code: "SMITH", name: "John Smith", caseTitle: "Collection" })],
      { clientCode: "SMITH", clientName: "Jane Smith", caseTitle: "New case" }
    );

    expect(clientCodeCheckBlocksCreate(result)).toBe(true);
    expect(result.codeConflict?.inMasterList).toBe(true);
    expect(formatCodeConflictMessage(result.codeConflict!)).toContain("SMITH");
  });

  it("blocks when only a ledger tab exists", async () => {
    const result = await checkClientCodeForIntake("token", [], {
      clientCode: "ORPHANTAB",
      clientName: "Orphan",
      caseTitle: "Matter"
    });

    expect(clientCodeCheckBlocksCreate(result)).toBe(true);
    expect(result.codeConflict?.hasLedgerTab).toBe(true);
    expect(result.codeConflict?.inMasterList).toBe(false);
  });

  it("warns when name and case title duplicate an existing profile", async () => {
    const result = await checkClientCodeForIntake(
      "token",
      [client({ code: "GDCI", name: "Hernandez Corp", caseTitle: "Corporate Matters" })],
      { clientCode: "HERNANDEZ", clientName: "Hernandez Corp", caseTitle: "Corporate Matters" }
    );

    expect(clientCodeCheckBlocksCreate(result)).toBe(false);
    expect(result.prefixMatches.some((match) => match.code === "GDCI")).toBe(true);
    expect(result.prefixMatches.find((match) => match.code === "GDCI")?.reasons.length).toBeGreaterThan(0);
  });

  it("requires different_case acknowledgement before proceeding with warnings", () => {
    const result = {
      codeConflict: null,
      taskPrefix: "HER",
      clientCaseLabel: "Hernandez — New case",
      prefixMatches: [
        {
          code: "HER2024",
          name: "Old Corp",
          caseTitle: "Collection",
          taskPrefix: "HER",
          reasons: ["Similar client name"]
        }
      ],
      similarMatches: []
    } satisfies ClientCodeCheckResult;

    expect(clientCodeCheckCanProceed(result, null)).toBe(false);
    expect(clientCodeCheckCanProceed(result, "same_case")).toBe(false);
    expect(clientCodeCheckCanProceed(result, "different_case")).toBe(true);
    expect(conflictReviewBlocksProceed("same_case")?.toLowerCase()).toContain("same case");
    expect(conflictReviewBlocksProceed(null)).toContain("same case or a different case");
  });

  it("warns on prefix overlap without blocking a fresh code", async () => {
    const result = await checkClientCodeForIntake(
      "token",
      [client({ code: "HER2024", name: "Old Corp", caseTitle: "Collection" })],
      { clientCode: "HERNANDEZ", clientName: "Hernandez", caseTitle: "New case" }
    );

    expect(clientCodeCheckBlocksCreate(result)).toBe(false);
    expect(result.prefixMatches.some((match) => match.code === "HER2024")).toBe(true);
  });
});
