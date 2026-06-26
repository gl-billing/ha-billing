import { describe, expect, it } from "vitest";
import {
  billingClientMatchesMatterCode,
  pickBestClientRowForTaskCode,
  rowMatchesTaskCodeLookup
} from "@/lib/sheets/task-code-client-match";

const martin = { code: "TIONKO", name: "Martin Tionko", caseTitle: "Collection" };
const mark = { code: "MAR", name: "Mark Ang Angco", caseTitle: "Civil case" };
const heirsNha = {
  code: "HEI-NHA",
  name: "Heirs of Tionko",
  caseTitle: "Heirs of Tionko vs. NHA et al."
};
const heirsHlurb = {
  code: "HEI-HLURB",
  name: "Heirs of Tionko",
  caseTitle: "Heirs of Tionko vs. HLURB"
};

describe("task-code client match", () => {
  it("does not treat a longer URL code as matching a shorter billing code", () => {
    expect(rowMatchesTaskCodeLookup(mark, "MARTIN")).toBe(false);
    expect(rowMatchesTaskCodeLookup(martin, "MARTIN")).toBe(false);
  });

  it("matches shared task prefix MAR for both clients", () => {
    expect(rowMatchesTaskCodeLookup(martin, "MAR")).toBe(true);
    expect(rowMatchesTaskCodeLookup(mark, "MAR")).toBe(true);
  });

  it("returns null for ambiguous MAR without a case hint", () => {
    expect(pickBestClientRowForTaskCode([martin, mark], "MAR")).toBeNull();
  });

  it("disambiguates MAR with a Martin Tionko hint", () => {
    expect(pickBestClientRowForTaskCode([martin, mark], "MAR", "Martin Tionko")).toEqual(martin);
  });

  it("disambiguates MAR with a Mark Ang hint", () => {
    expect(pickBestClientRowForTaskCode([martin, mark], "MAR", "Mark Ang Angco")).toEqual(mark);
  });

  it("accepts exact billing code on the matter URL", () => {
    expect(billingClientMatchesMatterCode("TIONKO", martin)).toBe(true);
    expect(billingClientMatchesMatterCode("MARTIN", mark)).toBe(false);
  });

  it("accepts task prefix URLs for the matching billing row", () => {
    expect(billingClientMatchesMatterCode("MAR", martin)).toBe(true);
    expect(billingClientMatchesMatterCode("MAR", mark)).toBe(true);
  });

  it("disambiguates shared HEI prefix using client name and case title", () => {
    expect(pickBestClientRowForTaskCode([heirsNha, heirsHlurb], "HEI")).toBeNull();
    expect(
      pickBestClientRowForTaskCode([heirsNha, heirsHlurb], "HEI", "Heirs of Tionko — NHA et al.")
    ).toEqual(heirsNha);
    expect(
      pickBestClientRowForTaskCode([heirsNha, heirsHlurb], "HEI", "Heirs of Tionko — HLURB")
    ).toEqual(heirsHlurb);
  });
});
