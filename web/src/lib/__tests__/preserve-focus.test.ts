import { describe, expect, it } from "vitest";
import { isEditableField } from "@/lib/preserve-focus";

describe("preserve-focus helpers", () => {
  it("treats null as non-editable", () => {
    expect(isEditableField(null)).toBe(false);
  });
});
