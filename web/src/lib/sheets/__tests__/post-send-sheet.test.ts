import { describe, expect, it } from "vitest";
import { withPostSendSheetWarning } from "@/lib/sheets/post-send-sheet";

describe("withPostSendSheetWarning", () => {
  it("returns the base message when there are no warnings", () => {
    expect(withPostSendSheetWarning("SOA sent to a@b.com.", [])).toBe("SOA sent to a@b.com.");
  });

  it("appends the first sheet warning after a successful send", () => {
    const message = withPostSendSheetWarning("SOA sent to a@b.com.", [
      "Document Log: protected range"
    ]);
    expect(message).toContain("SOA sent to a@b.com.");
    expect(message).toContain("Spreadsheet follow-up incomplete");
    expect(message).toContain("Document Log: protected range");
  });
});
