import { describe, expect, it } from "vitest";
import { sectionForPrimarySwitch } from "@/lib/clio/section-for-primary";

describe("sectionForPrimarySwitch", () => {
  const visibility = {
    billingAccess: true,
    navProfile: "full" as const,
    isAdmin: true,
    email: "staff@example.com",
    canManageTeamRoster: true,
    canViewLiaisonTab: true,
    canViewPresenceTab: true
  };

  it("keeps the active section when switching within the same primary", () => {
    const section = sectionForPrimarySwitch("checklist", "checklist", "today", visibility);
    expect(section.id).toBe("today");
  });

  it("falls back to default when switching to a different primary", () => {
    const section = sectionForPrimarySwitch("billing", "checklist", "today", visibility);
    expect(section.id).not.toBe("today");
  });
});
