import { describe, expect, it } from "vitest";
import {
  resolveActiveSpaceNav,
  spaceCreateAction,
  spaceCreateMenu,
  spaceNavItemsForUser,
  filterSpaceTasksSectionTabs,
  filterSpaceBillingSectionTabs,
  spaceCalendarViewTabs,
  spaceCalendarViewTarget,
  spaceTasksExtraHref
} from "@/lib/space-nav";

describe("space-nav (HA)", () => {
  it("maps Space concepts to HA routes for full billing users", () => {
    const { primary, footer, collaboration, topNav } = spaceNavItemsForUser({
      billingAccess: true,
      isAdmin: true,
      navProfile: "full"
    });
    const ids = [...primary, ...footer].map((i) => i.id);
    expect(ids).toContain("start");
    expect(ids).toContain("messenger");
    expect(ids).toContain("team");
    expect(ids).toContain("crm");
    expect(ids).toContain("accounts");
    expect(ids).toContain("booking");
    expect(ids).toContain("filing");
    expect(ids).toContain("drive");
    expect(ids).toContain("settings");
    expect(collaboration.map((i) => i.id)).toEqual(["start", "messenger", "team"]);
    expect(topNav.map((i) => i.id)).toContain("tasks");
    expect(ids).not.toContain("sites" as never);
    expect(ids.join(" ")).not.toMatch(/PayMongo/i);
  });

  it("hides billing-only items for tasks-only users", () => {
    const { primary } = spaceNavItemsForUser({
      billingAccess: false,
      isAdmin: false,
      navProfile: "tasks-only"
    });
    const ids = primary.map((i) => i.id);
    expect(ids).toContain("messenger");
    expect(ids).not.toContain("crm");
    expect(ids).not.toContain("accounts");
    expect(ids).not.toContain("booking");
  });

  it("resolves messenger/staff/notifications desks from query", () => {
    expect(resolveActiveSpaceNav("/app", "tab=today&space=messenger")).toBe("messenger");
    expect(resolveActiveSpaceNav("/app", "tab=tools&space=staff")).toBe("employees");
    expect(resolveActiveSpaceNav("/app", "tab=today&space=notifications")).toBe("notifications");
  });

  it("resolves billing pages to Space modules", () => {
    expect(resolveActiveSpaceNav("/billing", "page=clients")).toBe("crm");
    expect(resolveActiveSpaceNav("/billing", "page=walkIns")).toBe("booking");
    expect(resolveActiveSpaceNav("/billing", "page=billing")).toBe("accounts");
    expect(resolveActiveSpaceNav("/billing", "page=documents&space=drive")).toBe("drive");
    expect(resolveActiveSpaceNav("/billing", "page=reports")).toBe("reports");
    expect(resolveActiveSpaceNav("/billing", "")).toBe("accounts");
    expect(resolveActiveSpaceNav("/matter/ABC-1", "")).toBe("tasks");
    expect(resolveActiveSpaceNav("/app", "tab=correspondence&space=templates")).toBe("templates");
  });

  it("maps filing/reports create actions to the right desks", () => {
    expect(spaceCreateAction("filing", { billingAccess: true }).href).toContain("filing");
    expect(spaceCreateAction("reports", { billingAccess: true }).href).toContain("reports");
    expect(spaceCreateAction("notifications", { billingAccess: true }).href).toContain("space=notifications");
  });

  it("maps create actions to HA hrefs without trial opts", () => {
    const walkIn = spaceCreateAction("booking", { billingAccess: true });
    expect(walkIn.href).toContain("walkIns");
    const drive = spaceCreateAction("drive", { billingAccess: true });
    expect(drive.href).toContain("documents");
    const menu = spaceCreateMenu("crm", { billingAccess: true });
    expect(menu.some((item) => item.href.includes("clients"))).toBe(true);
    expect(menu.every((item) => !item.href.includes("deskClients"))).toBe(true);
    expect(menu.every((item) => !item.href.includes("officeDrive"))).toBe(true);
  });

  it("filters billing section tabs to HA pages only", () => {
    const tabs = [
      { id: "clients", label: "Clients" },
      { id: "retainers", label: "Retainers" },
      { id: "walkIns", label: "Walk-ins" },
      { id: "documents", label: "Documents" }
    ];
    const crm = filterSpaceBillingSectionTabs("crm", tabs);
    expect(crm.map((t) => t.id)).toEqual(["clients"]);
    const booking = filterSpaceBillingSectionTabs("booking", tabs);
    expect(booking.map((t) => t.id)).toEqual(["walkIns"]);
    const drive = filterSpaceBillingSectionTabs("drive", tabs);
    expect(drive.map((t) => t.id)).toEqual(["documents"]);
  });

  it("filters tasks section tabs and extras", () => {
    const tabs = [
      { id: "today", label: "Today" },
      { id: "desk-checklist", label: "Checklist" },
      { id: "all-items", label: "All" }
    ];
    const start = filterSpaceTasksSectionTabs("start", tabs);
    expect(start.map((t) => t.id)).toContain("office-hub");
    expect(start.map((t) => t.id)).toContain("desk-checklist");
    expect(spaceTasksExtraHref("office-hub")).toBe("/office-hub");
    expect(spaceTasksExtraHref("integrations")).toContain("panel=integrations");
  });

  it("maps calendar views", () => {
    expect(spaceCalendarViewTabs().map((t) => t.id)).toEqual(["day", "week", "month", "schedule"]);
    expect(spaceCalendarViewTarget("month")).toEqual({ tab: "calendar", cal: "month" });
    expect(spaceCalendarViewTarget("day")).toEqual({ tab: "week", cal: "day" });
  });
});
