import { describe, expect, it } from "vitest";
import { formatStaffDisplayName } from "@/lib/user-display";

describe("formatStaffDisplayName", () => {
  it("greets the firm inbox as Admin", () => {
    expect(formatStaffDisplayName("GL", "info@hernandezassociates.com")).toBe("Admin");
    expect(formatStaffDisplayName("Hernandez & Associates", "info@hernandezassociates.com")).toBe("Admin");
    expect(formatStaffDisplayName(null, "info@hernandezassociates.com")).toBe("Admin");
  });
});
