import { describe, expect, it } from "vitest";

/** Mirror of lastRowInPrimaryColumnABlock loop for unit tests. */
function lastRowInPrimaryColumnABlockFromColA(colA: string[][]): number {
  let lastRow = 1;
  let started = false;
  for (let index = 0; index < colA.length; index++) {
    const value = String(colA[index]?.[0] || "").trim();
    if (value) {
      started = true;
      lastRow = index + 2;
      continue;
    }
    if (started) break;
  }
  return lastRow;
}

describe("lastRowInPrimaryColumnABlock", () => {
  it("stops at the first blank after the main list", () => {
    const colA = Array.from({ length: 1027 }, () => [""]);
    colA[93] = ["JAN-EVT-0008"];
    colA[1026] = ["TAX-EVT-0005"];

    expect(lastRowInPrimaryColumnABlockFromColA(colA)).toBe(95);
  });

  it("returns header row when column A is empty", () => {
    expect(lastRowInPrimaryColumnABlockFromColA([["", ""], ["", ""]])).toBe(1);
  });
});
