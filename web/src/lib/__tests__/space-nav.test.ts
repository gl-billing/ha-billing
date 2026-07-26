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
    const { primary, footer, collaboration, workspace, topNav } = spaceNavItemsForUser({
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
    expect(ids).toContain("administration");
    expect(ids).toContain("settings");
    expect(ids).not.toContain("employees");
    expect(collaboration.map((i) => i.id)).toEqual(["start", "messenger", "team"]);
    expect(workspace.map((i) => i.id)).toContain("administration");
    expect(workspace.map((i) => i.id)).not.toContain("settings");
    expect(footer.map((i) => i.id)).toEqual(["settings"]);
    expect(topNav.map((i) => i.id)).toContain("tasks");
    expect(topNav.map((i) => i.id)).toContain("administration");
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
    expect(ids).not.toContain("mail");
    expect(ids).toContain("templates");
    expect(ids).not.toContain("communications");
    expect(ids).not.toContain("drive");
    expect(ids).toContain("administration");
  });

  it("shows Communications for associates without billing", () => {
    const { primary } = spaceNavItemsForUser({
      billingAccess: false,
      isAdmin: false,
      navProfile: "associate"
    });
    const ids = primary.map((i) => i.id);
    expect(ids).toContain("communications");
    expect(ids).not.toContain("crm");
  });

  it("resolves messenger/staff/notifications desks from query", () => {
    expect(resolveActiveSpaceNav("/app", "tab=today&space=messenger")).toBe("messenger");
    expect(resolveActiveSpaceNav("/app", "tab=tools&space=staff")).toBe("administration");
    expect(resolveActiveSpaceNav("/app", "tab=today&space=notifications")).toBe("notifications");
  });

  it("resolves billing pages to Space modules", () => {
    expect(resolveActiveSpaceNav("/billing", "page=clients")).toBe("crm");
    expect(resolveActiveSpaceNav("/billing", "page=walkIns")).toBe("booking");
    expect(resolveActiveSpaceNav("/billing", "page=newClient")).toBe("booking");
    expect(resolveActiveSpaceNav("/billing", "nav=matters&section=intake")).toBe("booking");
    expect(resolveActiveSpaceNav("/billing", "page=billing")).toBe("accounts");
    expect(resolveActiveSpaceNav("/billing", "page=documents&space=drive")).toBe("drive");
    expect(
      resolveActiveSpaceNav("/billing", "nav=documents&section=generate&page=documents&space=drive")
    ).toBe("drive");
    expect(resolveActiveSpaceNav("/billing", "nav=documents&section=generate&page=documents")).toBe(
      "accounts"
    );
    expect(resolveActiveSpaceNav("/billing", "page=documents")).toBe("accounts");
    expect(resolveActiveSpaceNav("/billing", "page=reports")).toBe("reports");
    expect(resolveActiveSpaceNav("/billing", "page=staffSalary")).toBe("administration");
    expect(resolveActiveSpaceNav("/billing", "")).toBe("accounts");
    expect(resolveActiveSpaceNav("/matter/ABC-1", "")).toBe("tasks");
    expect(resolveActiveSpaceNav("/app", "tab=templates")).toBe("templates");
    expect(resolveActiveSpaceNav("/app", "tab=today&space=templates")).toBe("templates");
    expect(resolveActiveSpaceNav("/app", "tab=correspondence&space=communications")).toBe("communications");
    expect(resolveActiveSpaceNav("/app", "tab=correspondence")).toBe("communications");
    expect(resolveActiveSpaceNav("/app", "tab=today&panel=client-messaging")).toBe("communications");
  });

  it("exposes Templates separately from Communications", () => {
    const { primary } = spaceNavItemsForUser({
      billingAccess: true,
      isAdmin: true,
      navProfile: "full"
    });
    expect(primary.map((i) => i.id)).toContain("communications");
    expect(primary.map((i) => i.id)).toContain("templates");
    expect(primary.map((i) => i.id)).not.toContain("mail" as never);
    const templateSections = filterSpaceTasksSectionTabs("templates", [
      { id: "templates", label: "Templates" },
      { id: "correspondence", label: "Correspondence" }
    ]);
    expect(templateSections.map((t) => t.id)).toEqual(["templates"]);
    const sections = filterSpaceTasksSectionTabs("communications", [
      { id: "correspondence", label: "Correspondence" }
    ]);
    expect(sections.map((t) => t.id)).toEqual(["correspondence", "client-messaging"]);
    expect(spaceTasksExtraHref("client-messaging")).toContain("panel=client-messaging");
    expect(spaceCreateMenu("communications", { billingAccess: true }).some((item) =>
      item.href.includes("client-messaging")
    )).toBe(true);
    expect(spaceCreateAction("templates", { billingAccess: true }).href).toContain("tab=templates");
  });

  it("maps filing/reports create actions to the right desks", () => {
    expect(spaceCreateAction("filing", { billingAccess: true }).href).toContain("filing");
    expect(spaceCreateAction("reports", { billingAccess: true }).href).toContain("reports");
    expect(spaceCreateAction("notifications", { billingAccess: true }).href).toContain("space=notifications");
  });

  it("maps create actions to HA hrefs without trial opts", () => {
    const intake = spaceCreateAction("booking", { billingAccess: true });
    expect(intake.href).toContain("newClient");
    expect(intake.label).toBe("Client intake");
    const drive = spaceCreateAction("drive", { billingAccess: true });
    expect(drive.href).toContain("documents");
    const menu = spaceCreateMenu("crm", { billingAccess: true });
    expect(menu.some((item) => item.href.includes("clients"))).toBe(true);
    expect(menu.every((item) => !item.href.includes("deskClients"))).toBe(true);
    expect(menu.every((item) => !item.href.includes("officeDrive"))).toBe(true);
    const bookingMenu = spaceCreateMenu("booking", { billingAccess: true });
    expect(bookingMenu.some((item) => item.href.includes("newClient"))).toBe(true);
    const accountsMenu = spaceCreateMenu("accounts", { billingAccess: true });
    expect(accountsMenu.every((item) => !item.href.includes("newClient"))).toBe(true);
  });

  it("filters billing section tabs to HA pages only", () => {
    const tabs = [
      { id: "clients", label: "Clients" },
      { id: "retainers", label: "Retainers" },
      { id: "walkIns", label: "Walk-ins" },
      { id: "newClient", label: "New client intake" },
      { id: "documents", label: "Documents" },
      { id: "billing", label: "Billing" },
      { id: "staffSalary", label: "Staff payroll" },
      { id: "reports", label: "Reports" }
    ];
    const crm = filterSpaceBillingSectionTabs("crm", tabs);
    expect(crm.map((t) => t.id)).toEqual(["clients"]);
    const booking = filterSpaceBillingSectionTabs("booking", tabs);
    expect(booking.map((t) => t.id)).toEqual(["newClient", "walkIns"]);
    expect(booking.find((t) => t.id === "newClient")?.label).toBe("Client intake");
    const accounts = filterSpaceBillingSectionTabs("accounts", tabs);
    expect(accounts.map((t) => t.id)).toEqual(["billing", "documents"]);
    expect(accounts.every((t) => t.id !== "newClient")).toBe(true);
    const drive = filterSpaceBillingSectionTabs("drive", tabs);
    expect(drive.map((t) => t.id)).toEqual(["documents"]);
    expect(drive.find((t) => t.id === "documents")?.label).toBe("Document vault");
    expect(accounts.find((t) => t.id === "documents")?.label).toBe("SOA & Receipts");
    const reports = filterSpaceBillingSectionTabs("reports", tabs);
    expect(reports.map((t) => t.id)).toEqual(["reports"]);
    expect(reports.every((t) => t.id !== "staffSalary")).toBe(true);
  });

  it("puts Administration in Workspace with Staff/Payroll/attendance section tabs; Settings in footer", () => {
    const { workspace, footer } = spaceNavItemsForUser({
      billingAccess: true,
      isAdmin: true,
      navProfile: "full"
    });
    expect(workspace.find((i) => i.id === "administration")?.label).toBe("Administration");
    expect(workspace.map((i) => i.id)).not.toContain("employees");
    expect(footer.find((i) => i.id === "settings")?.label).toBe("Settings");
    expect(footer.find((i) => i.id === "settings")?.href).toContain("panel=integrations");

    const adminSections = filterSpaceTasksSectionTabs(
      "administration",
      [
        { id: "tools", label: "Administration" },
        { id: "presence", label: "Staff attendance" },
        { id: "today", label: "My work" }
      ],
      { isAdmin: true }
    );
    expect(adminSections.map((t) => t.id)).toEqual(["tools", "staff", "presence", "payroll"]);
    expect(spaceTasksExtraHref("staff")).toContain("space=staff");
    expect(spaceTasksExtraHref("payroll")).toContain("staffSalary");

    const staffSections = filterSpaceTasksSectionTabs(
      "administration",
      [
        { id: "tools", label: "Administration" },
        { id: "today", label: "My work" }
      ],
      { isAdmin: false }
    );
    expect(staffSections.map((t) => t.id)).toEqual(["tools"]);

    const settingsSections = filterSpaceTasksSectionTabs("settings", [
      { id: "tools", label: "Administration" }
    ]);
    expect(settingsSections.map((t) => t.id)).toEqual(["integrations"]);

    expect(resolveActiveSpaceNav("/app", "tab=presence")).toBe("administration");
    expect(resolveActiveSpaceNav("/app", "tab=tools")).toBe("administration");
    expect(resolveActiveSpaceNav("/app", "tab=tools&panel=integrations")).toBe("settings");
    expect(resolveActiveSpaceNav("/billing", "page=staffSalary")).toBe("administration");
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
