import { describe, expect, it } from "vitest";
import { formatStaffDisplayName } from "@/lib/user-display";

describe("formatStaffDisplayName", () => {
  it("uses firm greeting names for known staff emails", () => {
    expect(formatStaffDisplayName(null, "atty.rahernandez@gmail.com")).toBe("Atty. Robert");
    expect(formatStaffDisplayName(null, "rahernandez@gmail.com")).toBe("Atty. Robert");
    expect(formatStaffDisplayName(null, "jlppasagui@gmail.com")).toBe("Atty. Jeff");
    expect(formatStaffDisplayName("GL", "legal@hernandezlaw.info")).toBe("Shiela");
    expect(formatStaffDisplayName(null, "lizparreno595@gmail.com")).toBe("Atty. April");
    expect(formatStaffDisplayName(null, "rahernandez555@gmail.com")).toBe("Hiedee");
    expect(formatStaffDisplayName(null, "rbr083080@gmail.com")).toBe("Raquel");
  });

  it("falls back to first name from profile when email is unknown", () => {
    expect(formatStaffDisplayName("James Bryan Hakola", "unknown@example.com")).toBe("James");
  });
});
