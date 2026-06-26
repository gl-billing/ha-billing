import { describe, expect, it } from "vitest";
import {
  caseNumbersAlign,
  caseTitlesAlign,
  clientCaseIdentityMatchesBilling,
  labelCaseCaptionConflictsWithBilling,
  labelExpressesCaseCaption
} from "@/lib/office-tasks/client-case-identity";

describe("clientCaseIdentityMatchesBilling", () => {
  it("requires client name, case title, and case number when all are present", () => {
    const billing = {
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. NHA et al.",
      caseNumber: "CA-12345"
    };

    expect(clientCaseIdentityMatchesBilling(billing, "Heirs of Tionko — NHA et al.")).toBe(true);
    expect(
      clientCaseIdentityMatchesBilling(billing, "Heirs of Tionko — NHA et al. — Case No. CA-12345")
    ).toBe(true);
    expect(clientCaseIdentityMatchesBilling(billing, "Heirs of Tionko — HLURB")).toBe(false);
    expect(
      clientCaseIdentityMatchesBilling(billing, "Heirs of Tionko — NHA et al. — Case No. CA-99999")
    ).toBe(false);
  });
});

describe("caseTitlesAlign", () => {
  it("aligns short and full captions for the same matter", () => {
    expect(caseTitlesAlign("Heirs of Tionko vs. NHA et al.", "NHA et al.")).toBe(true);
    expect(caseTitlesAlign("Heirs of Tionko vs. NHA et al.", "HLURB")).toBe(false);
  });
});

describe("caseNumbersAlign", () => {
  it("ignores case number when the label does not mention one", () => {
    expect(caseNumbersAlign("CA-12345", "Heirs of Tionko — NHA et al.")).toBe(true);
  });

  it("rejects mismatched numbers when both sides include one", () => {
    expect(caseNumbersAlign("CA-12345", "Case No. CA-99999")).toBe(false);
  });
});

describe("labelExpressesCaseCaption", () => {
  it("detects vs captions and generic scheduling subtitles", () => {
    expect(labelExpressesCaseCaption("Heirs of Tionko vs. HLURB")).toBe(true);
    expect(labelExpressesCaseCaption("Heirs of Tionko — HLURB")).toBe(true);
    expect(labelExpressesCaseCaption("Chicken — Hearing Monday")).toBe(false);
  });
});

describe("labelCaseCaptionConflictsWithBilling", () => {
  it("flags a different opponent caption under the same client name", () => {
    expect(
      labelCaseCaptionConflictsWithBilling("Heirs of Tionko — HLURB", {
        caseTitle: "Heirs of Tionko vs. NHA et al."
      })
    ).toBe(true);
    expect(
      labelCaseCaptionConflictsWithBilling("Chicken — Hearing Monday", {
        caseTitle: "Qualified Theft"
      })
    ).toBe(false);
  });
});
