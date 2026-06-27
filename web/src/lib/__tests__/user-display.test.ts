import { describe, expect, it } from "vitest";
import { formatStaffDisplayName } from "@/lib/user-display";

describe("formatStaffDisplayName", () => {
  it("greets the firm inbox as Admin", () => {
    expect(formatStaffDisplayName("GL", "legal@hernandezlaw.info")).toBe("Admin");
    expect(formatStaffDisplayName("Hernandez Law", "legal@hernandezlaw.info")).toBe("Admin");
    expect(formatStaffDisplayName(null, "legal@hernandezlaw.info")).toBe("Admin");
  });
});
