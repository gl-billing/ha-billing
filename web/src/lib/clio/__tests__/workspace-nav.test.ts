import { describe, expect, it } from "vitest";
import {
  HA_CLIO_NAV,
  clioPrimariesForUser,
  clioSectionsForUser,
  parseCalendarModeParam,
  resolveClioFromBillingPage,
  resolveClioFromTasksTab
} from "@/lib/clio/workspace-nav";
import type { SavedBillingPage, SavedTasksTab } from "@/lib/staff-prefs";

const ALL_BILLING: SavedBillingPage[] = [
  "home",
  "billing",
  "clients",
  "walkIns",
  "spotBilling",
  "notarizations",
  "fieldDispatch",
  "newClient",
  "documents",
  "history",
  "reports",
  "firmFinances",
  "staffSalary"
];

const ALL_TASKS: SavedTasksTab[] = [
  "today",
  "calendar",
  "week",
  "team",
  "history",
  "add-task",
  "add-event",
  "all-items",
  "correspondence",
  "tools",
  "liaison",
  "presence"
];

describe("HA_CLIO_NAV inventory", () => {
  it("covers every billing page and tasks tab", () => {
    const billing = new Set<SavedBillingPage>();
    const tasks = new Set<SavedTasksTab>();
    for (const primary of HA_CLIO_NAV) {
      for (const section of primary.sections) {
        if (section.billingPage) billing.add(section.billingPage);
        if (section.tasksTab) tasks.add(section.tasksTab);
      }
    }
    for (const page of ALL_BILLING) {
      expect(billing.has(page), `missing billing page ${page}`).toBe(true);
    }
    for (const tab of ALL_TASKS) {
      expect(tasks.has(tab), `missing tasks tab ${tab}`).toBe(true);
    }
  });

  it("exposes full primary set for admin with liaison + presence", () => {
    const primaries = clioPrimariesForUser({
      billingAccess: true,
      navProfile: "full",
      isAdmin: true,
      canViewLiaisonTab: true,
      canViewPresenceTab: true
    });
    expect(primaries.map((p) => p.id)).toEqual([
      "checklist",
      "calendar",
      "matters",
      "contacts",
      "activities",
      "billing",
      "documents",
      "communications",
      "reports",
      "dashboard",
      "settings"
    ]);
  });

  it("hides admin / liaison / presence sections for secretaries", () => {
    const billing = clioSectionsForUser(
      HA_CLIO_NAV.find((item) => item.id === "billing")!,
      { billingAccess: true, navProfile: "secretary", isAdmin: false }
    );
    expect(billing.map((s) => s.id)).not.toContain("finances");
    expect(billing.map((s) => s.id)).not.toContain("salary");

    const reports = clioSectionsForUser(
      HA_CLIO_NAV.find((item) => item.id === "reports")!,
      { billingAccess: true, navProfile: "secretary", isAdmin: false, canViewLiaisonTab: false }
    );
    expect(reports.map((s) => s.id)).not.toContain("liaison");
    expect(reports.map((s) => s.id)).not.toContain("team");
  });

  it("resolves billing pages and tasks tabs to Clio coords", () => {
    expect(resolveClioFromBillingPage("walkIns")).toEqual({ nav: "matters", section: "walkIns" });
    expect(resolveClioFromBillingPage("spotBilling")).toEqual({ nav: "billing", section: "spotBilling" });
    expect(resolveClioFromTasksTab("liaison")).toEqual({ nav: "reports", section: "liaison" });
    expect(resolveClioFromTasksTab("presence")).toEqual({ nav: "settings", section: "presence" });
    expect(resolveClioFromTasksTab("today")).toEqual({ nav: "checklist", section: "today" });
    expect(resolveClioFromTasksTab("week")).toEqual({ nav: "calendar", section: "week" });
    expect(resolveClioFromTasksTab("week", "day")).toEqual({ nav: "calendar", section: "day" });
    // Leftover day mode must not steal My work highlighting.
    expect(resolveClioFromTasksTab("today", "day")).toEqual({ nav: "checklist", section: "today" });
    expect(resolveClioFromTasksTab("calendar")).toEqual({ nav: "calendar", section: "month" });
  });

  it("maps Calendar Day section to week tab with day mode (hourly schedule)", () => {
    const calendar = HA_CLIO_NAV.find((item) => item.id === "calendar")!;
    const day = calendar.sections.find((s) => s.id === "day")!;
    expect(day.tasksTab).toBe("week");
    expect(day.calendarMode).toBe("day");
    expect(resolveClioFromTasksTab("week", "day")).toEqual({ nav: "calendar", section: "day" });
    expect(resolveClioFromTasksTab("week", "week")).toEqual({ nav: "calendar", section: "week" });
  });

  it("parseCalendarModeParam reads cal and calendar section from URL", () => {
    expect(parseCalendarModeParam("cal=day&nav=calendar&section=day&tab=week")).toBe("day");
    expect(parseCalendarModeParam("nav=calendar&section=day&tab=week")).toBe("day");
    expect(parseCalendarModeParam("nav=calendar&section=week&tab=week")).toBe("week");
    expect(parseCalendarModeParam("nav=checklist&section=today")).toBe(null);
  });
});
