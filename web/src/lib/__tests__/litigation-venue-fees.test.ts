import { describe, expect, it } from "vitest";
import {
  isAnnulmentCase,
  isDeclarationOfNullityCase,
  isMarriageNullityOrAnnulmentCase
} from "@/lib/litigation-venue-fees";

describe("marriage nullity and annulment case detection", () => {
  it("detects declaration of nullity titles", () => {
    expect(isDeclarationOfNullityCase("Petition for Declaration of Nullity of Marriage")).toBe(true);
    expect(isDeclarationOfNullityCase("Nullity of Marriage")).toBe(true);
    expect(isDeclarationOfNullityCase("Collection")).toBe(false);
  });

  it("detects annulment titles", () => {
    expect(isAnnulmentCase("Annulment of Marriage")).toBe(true);
    expect(isAnnulmentCase("Annulment")).toBe(true);
    expect(isAnnulmentCase("Collection")).toBe(false);
  });

  it("groups nullity and annulment for psychologist fields", () => {
    expect(isMarriageNullityOrAnnulmentCase("Annulment of Marriage")).toBe(true);
    expect(isMarriageNullityOrAnnulmentCase("Petition for Declaration of Nullity of Marriage")).toBe(true);
    expect(isMarriageNullityOrAnnulmentCase("Qualified Theft")).toBe(false);
  });
});
