import { describe, expect, it } from "vitest";
import {
  formatMatterCaseCaption,
  formatMatterDirectoryCaseLabel,
  resolveClientMatterType
} from "@/lib/client-matter-type";

describe("client matter type", () => {
  it("infers case from a non-empty case title", () => {
    expect(resolveClientMatterType({ caseTitle: "Annulment of Marriage" })).toBe("case");
  });

  it("infers retainer when there is no case title but retainer balance", () => {
    expect(resolveClientMatterType({ caseTitle: "", retainerBalance: 5000 })).toBe("retainer");
  });

  it("infers general when there is no case and no retainer", () => {
    expect(resolveClientMatterType({ caseTitle: "" })).toBe("general");
  });

  it("formats active case captions with Re:", () => {
    expect(formatMatterCaseCaption({ matterType: "case", caseTitle: "Annulment of Marriage" })).toBe(
      "Re: Annulment of Marriage"
    );
  });

  it("shows retainer and general labels without Re:", () => {
    expect(formatMatterCaseCaption({ matterType: "retainer" })).toBe("Retainer client");
    expect(formatMatterCaseCaption({ matterType: "general" })).toBe("No active case");
  });

  it("formats directory labels for non-case clients", () => {
    expect(formatMatterDirectoryCaseLabel({ matterType: "retainer", caseTitle: "" })).toBe("Retainer client");
    expect(formatMatterDirectoryCaseLabel({ matterType: "general", caseTitle: "" })).toBe("No active case");
  });
});
