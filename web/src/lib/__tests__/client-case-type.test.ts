import { describe, expect, it } from "vitest";
import {
  formatClientCaseTypeLabel,
  isAnnulmentCaseType,
  normalizeClientCaseType,
  showPsychologistFields
} from "@/lib/client-case-type";

describe("client case type", () => {
  it("normalizes case type values", () => {
    expect(normalizeClientCaseType("Annulment")).toBe("annulment");
    expect(normalizeClientCaseType("Special civil action")).toBe("special_civil_action");
  });

  it("formats other with custom label", () => {
    expect(formatClientCaseTypeLabel("other", "Intellectual property")).toBe("Intellectual property");
    expect(formatClientCaseTypeLabel("other", "")).toBe("Others, please specify");
  });

  it("shows psychologist fields for annulment case type", () => {
    expect(isAnnulmentCaseType("annulment")).toBe(true);
    expect(showPsychologistFields({ caseType: "annulment", caseTitle: "Smith vs Smith" })).toBe(true);
    expect(showPsychologistFields({ caseType: "civil", caseTitle: "Collection" })).toBe(false);
  });

  it("still shows psychologist fields for legacy nullity case titles", () => {
    expect(
      showPsychologistFields({
        caseType: "",
        caseTitle: "Petition for Declaration of Nullity of Marriage"
      })
    ).toBe(true);
  });
});
