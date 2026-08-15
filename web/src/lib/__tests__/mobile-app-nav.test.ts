import { describe, expect, it } from "vitest";
import {
  isMobilePrimaryTab,
  mobileAppBackHref,
  mobileBottomNavActive,
  mobileBottomNavItems
} from "@/lib/mobile-app-nav";

describe("mobile app navigation", () => {
  it("treats Home, Calendar, Tasks, and Clients as primary tabs", () => {
    expect(isMobilePrimaryTab("/app", "tab=desk-checklist")).toBe(true);
    expect(isMobilePrimaryTab("/app", "tab=week&cal=day")).toBe(true);
    expect(isMobilePrimaryTab("/app", "tab=calendar&cal=month")).toBe(true);
    expect(isMobilePrimaryTab("/app", "tab=all-items")).toBe(true);
    expect(isMobilePrimaryTab("/billing", "page=clients")).toBe(true);
    expect(isMobilePrimaryTab("/app", "tab=desk-checklist&mo=schedule")).toBe(false);
    expect(isMobilePrimaryTab("/app", "tab=add-task")).toBe(false);
    expect(isMobilePrimaryTab("/matter/PLAZA", "")).toBe(false);
  });

  it("highlights the matching bottom tab", () => {
    expect(mobileBottomNavActive("/app", "tab=desk-checklist")).toBe("home");
    expect(mobileBottomNavActive("/app", "tab=week")).toBe("calendar");
    expect(mobileBottomNavActive("/app", "tab=calendar&cal=month")).toBe("calendar");
    expect(mobileBottomNavActive("/app", "tab=all-items")).toBe("tasks");
    expect(mobileBottomNavActive("/billing", "page=clients")).toBe("clients");
    expect(mobileBottomNavActive("/matter/PLAZA", "")).toBe("clients");
    expect(mobileBottomNavActive("/app", "tab=today&space=notifications")).toBe("more");
    expect(mobileBottomNavActive("/billing", "page=documents")).toBe("more");
  });

  it("builds bottom nav destinations for HA routes", () => {
    const items = mobileBottomNavItems({ billingAccess: true });
    expect(items.map((item) => item.id)).toEqual(["home", "calendar", "tasks", "clients"]);
    expect(items.find((item) => item.id === "clients")?.href).toContain("page=clients");
    expect(items.find((item) => item.id === "clients")?.href).not.toContain("tab=week");
    expect(items.find((item) => item.id === "calendar")?.href).toContain("cal=day");
  });

  it("omits Clients when billing access is off", () => {
    expect(mobileBottomNavItems({ billingAccess: false }).map((item) => item.id)).toEqual([
      "home",
      "calendar",
      "tasks"
    ]);
  });

  it("returns from a matter page to Clients", () => {
    expect(mobileAppBackHref("/app?tab=desk-checklist", "/matter/PLAZA", "from=%2Fbilling%3Fpage%3Dclients")).toBe(
      "/billing?page=clients"
    );
    expect(mobileAppBackHref("/app?tab=desk-checklist", "/matter/PLAZA", "")).toBe("/billing?page=clients");
  });
});
