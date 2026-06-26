import { describe, expect, it } from "vitest";
import {
  clientCodeCheckBlocksCreate,
  clientCodeCheckCanProceed,
  type ClientCodeCheckResult
} from "@/lib/sheets/client-code-check";

describe("intake conflict gate rules", () => {
  it("blocks duplicate client codes before registration", () => {
    const result: ClientCodeCheckResult = {
      codeConflict: {
        code: "SMITH",
        name: "John Smith",
        caseTitle: "Case A",
        inMasterList: true,
        hasLedgerTab: true
      },
      taskPrefix: "SMI",
      clientCaseLabel: "John Smith — Case A",
      prefixMatches: [],
      similarMatches: []
    };
    expect(clientCodeCheckBlocksCreate(result)).toBe(true);
    expect(clientCodeCheckCanProceed(result, "different_case")).toBe(false);
  });

  it("requires review acknowledgement when similar profiles exist", () => {
    const result: ClientCodeCheckResult = {
      codeConflict: null,
      taskPrefix: "CRU",
      clientCaseLabel: "Maria Cruz — Annulment",
      prefixMatches: [
        {
          code: "CRUZ2024",
          name: "Maria Cruz",
          caseTitle: "Annulment",
          taskPrefix: "CRU",
          reasons: ["Same client name and case title — may duplicate an existing profile"],
          similarScore: 1
        }
      ],
      similarMatches: []
    };
    expect(clientCodeCheckCanProceed(result, null)).toBe(false);
    expect(clientCodeCheckCanProceed(result, "different_case")).toBe(true);
  });
});
