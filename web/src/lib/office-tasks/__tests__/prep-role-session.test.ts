import { describe, expect, it } from "vitest";
import {
  prepRoleFromLoginEmail,
  resolvePrepRoleFromSession,
  resolvePrepWorkloadViewRole
} from "@/lib/office-tasks/prep-workload-view";

const ROSTER = [
  "Shiela (Secretary)",
  "Atty. Maria Hernandez",
  "Liaison Officer",
  "Atty. Carlos Hernandez"
];

const DIRECTORY = ROSTER.map((name, index) => ({
  name,
  email:
    index === 0
      ? "legal@hernandezlaw.info"
      : index === 1
        ? "janinerose@hernandezassociates.com"
        : index === 2
          ? "liaison@hernandezlaw.info"
          : "nikkigutz@hernandezassociates.com",
  role: "",
  active: true as const
}));

describe("resolvePrepRoleFromSession", () => {
  it("identifies secretary from login email even when staff name resolves to firm owner", () => {
    expect(prepRoleFromLoginEmail("legal@hernandezlaw.info")).toBe("prep");
    expect(
      resolvePrepRoleFromSession(
        { email: "legal@hernandezlaw.info", name: "Admin", displayName: "Admin" },
        DIRECTORY
      )
    ).toBe("prep");
  });

  it("identifies liaison and lawyers from login email", () => {
    expect(prepRoleFromLoginEmail("liaison@hernandezlaw.info")).toBe("prep");
    expect(prepRoleFromLoginEmail("janinerose@hernandezassociates.com")).toBe("lawyer");
    expect(resolvePrepRoleFromSession({ email: "janinerose@hernandezassociates.com" }, DIRECTORY)).toBe("lawyer");
  });

  it("still recognizes legacy prep-staff email patterns", () => {
    expect(prepRoleFromLoginEmail("ellyzaandrea@hernandezassociates.com")).toBe("prep");
    expect(prepRoleFromLoginEmail("farvjas53@hernandezassociates.com")).toBe("prep");
    expect(prepRoleFromLoginEmail("jasbriehappy@hernandezassociates.com")).toBe("prep");
  });

  it("falls back to roster staff names when email is unknown", () => {
    expect(resolvePrepRoleFromSession({ email: "unknown@hernandezassociates.com", name: "Shiela (Secretary)" }, DIRECTORY)).toBe(
      "prep"
    );
    expect(resolvePrepWorkloadViewRole("Shiela (Secretary)", ROSTER)).toBe("prep");
    expect(resolvePrepWorkloadViewRole("Liaison Officer", ROSTER)).toBe("prep");
  });

  it("works without employee directory loaded (email-only matter page)", () => {
    expect(resolvePrepRoleFromSession({ email: "legal@hernandezlaw.info" }, [])).toBe("prep");
    expect(resolvePrepRoleFromSession({ email: "janinerose@hernandezassociates.com" }, [])).toBe("lawyer");
  });
});
