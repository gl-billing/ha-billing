import { describe, expect, it } from "vitest";
import {
  prepRoleFromLoginEmail,
  resolvePrepRoleFromSession,
  resolvePrepWorkloadViewRole
} from "@/lib/office-tasks/prep-workload-view";

const ROSTER = [
  "Ellyza Andrea Aguanta (Secretary)",
  "Atty. Maria Hernandez",
  "James Bryan Hakola",
  "Atty. Carlos Hernandez"
];

const DIRECTORY = ROSTER.map((name, index) => ({
  name,
  email:
    index === 0
      ? "ellyzaandrea@hernandezassociates.com"
      : index === 1
        ? "janinerose@hernandezassociates.com"
        : index === 2
          ? "farvjas53@hernandezassociates.com"
          : "nikkigutz@hernandezassociates.com",
  role: "",
  active: true as const
}));

describe("resolvePrepRoleFromSession", () => {
  it("identifies Andrea from login email even when staff name resolves to firm owner", () => {
    expect(prepRoleFromLoginEmail("ellyzaandrea@hernandezassociates.com")).toBe("prep");
    expect(
      resolvePrepRoleFromSession(
        { email: "ellyzaandrea@hernandezassociates.com", name: "Admin", displayName: "Admin" },
        DIRECTORY
      )
    ).toBe("prep");
  });

  it("identifies Jas and Janine from login email", () => {
    expect(prepRoleFromLoginEmail("farvjas53@hernandezassociates.com")).toBe("prep");
    expect(prepRoleFromLoginEmail("jasbriehappy@hernandezassociates.com")).toBe("prep");
    expect(prepRoleFromLoginEmail("janinerose@hernandezassociates.com")).toBe("lawyer");
    expect(resolvePrepRoleFromSession({ email: "janinerose@hernandezassociates.com" }, DIRECTORY)).toBe("lawyer");
  });

  it("falls back to roster staff names when email is unknown", () => {
    expect(resolvePrepRoleFromSession({ email: "unknown@hernandezassociates.com", name: "Ellyza Andrea Aguanta (Secretary)" }, DIRECTORY)).toBe(
      "prep"
    );
    expect(resolvePrepWorkloadViewRole("Ellyza Andrea Aguanta (Secretary)", ROSTER)).toBe("prep");
  });

  it("works without employee directory loaded (email-only matter page)", () => {
    expect(resolvePrepRoleFromSession({ email: "ellyzaandrea@hernandezassociates.com" }, [])).toBe("prep");
    expect(resolvePrepRoleFromSession({ email: "janinerose@hernandezassociates.com" }, [])).toBe("lawyer");
  });
});
