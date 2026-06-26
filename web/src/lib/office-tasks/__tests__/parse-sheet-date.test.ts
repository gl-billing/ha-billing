import { describe, expect, it } from "vitest";
import { parseSheetDateOnly, sheetDateCellValue, sheetsSerialToYmd } from "@/lib/office-tasks/date-only";

describe("parseSheetDateOnly", () => {
  it("parses ISO text and apostrophe-prefixed sheet dates", () => {
    expect(parseSheetDateOnly("2026-06-07")).toBe("2026-06-07");
    expect(parseSheetDateOnly("'2026-06-07")).toBe("2026-06-07");
  });

  it("parses Google Sheets serial numbers", () => {
    expect(parseSheetDateOnly(45815)).toBe(sheetsSerialToYmd(45815));
  });

  it("prefers D/M/Y for ambiguous slash dates (Philippines)", () => {
    expect(parseSheetDateOnly("7/6/2026")).toBe("2026-06-07");
    expect(parseSheetDateOnly("6/7/2026")).toBe("2026-07-06");
    expect(parseSheetDateOnly("12/3/2026")).toBe("2026-03-12");
    expect(parseSheetDateOnly("3/12/2026")).toBe("2026-12-03");
  });
});

describe("sheetDateCellValue", () => {
  it("prefixes ISO dates for reliable Sheets text storage", () => {
    expect(sheetDateCellValue("2026-06-07")).toBe("'2026-06-07");
    expect(sheetDateCellValue("")).toBe("");
  });
});
