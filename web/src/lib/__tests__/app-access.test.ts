import { afterEach, describe, expect, it } from "vitest";
import {
  canAccessBilling,
  canAccessOfficeHub,
  canEditDeskBilling,
  isBillingApiPath,
  isSecretaryNavUser,
  isStaffEmail,
  isTasksOnlyEmail,
  resolvePostLoginPath,
  resolveStaffSignIn
} from "@/lib/app-access";
import { canDeleteNotarizations, canManageTeamRoster, isAdminEmail } from "@/lib/admin";
import {
  billingNavTabsForUser,
  isAllowedBillingPage,
  isAllowedTasksTab,
  tasksNavTabsForUser
} from "@/lib/workspace-labels";

const ORIGINAL_TASKS_ONLY = process.env.TASKS_ONLY_EMAILS;
const ORIGINAL_SECRETARY_NAV = process.env.SECRETARY_NAV_EMAILS;
const ORIGINAL_DESK_BILLING_EDITORS = process.env.DESK_BILLING_EDITOR_EMAILS;
const ORIGINAL_ALLOWED_EMAILS = process.env.ALLOWED_EMAILS;
const ORIGINAL_ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;
const ORIGINAL_TEAM_ROSTER_ADMIN = process.env.TEAM_ROSTER_ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL_TASKS_ONLY === undefined) delete process.env.TASKS_ONLY_EMAILS;
  else process.env.TASKS_ONLY_EMAILS = ORIGINAL_TASKS_ONLY;
  if (ORIGINAL_SECRETARY_NAV === undefined) delete process.env.SECRETARY_NAV_EMAILS;
  else process.env.SECRETARY_NAV_EMAILS = ORIGINAL_SECRETARY_NAV;
  if (ORIGINAL_DESK_BILLING_EDITORS === undefined) delete process.env.DESK_BILLING_EDITOR_EMAILS;
  else process.env.DESK_BILLING_EDITOR_EMAILS = ORIGINAL_DESK_BILLING_EDITORS;
  if (ORIGINAL_ALLOWED_EMAILS === undefined) delete process.env.ALLOWED_EMAILS;
  else process.env.ALLOWED_EMAILS = ORIGINAL_ALLOWED_EMAILS;
  if (ORIGINAL_ALLOWED_DOMAIN === undefined) delete process.env.ALLOWED_EMAIL_DOMAIN;
  else process.env.ALLOWED_EMAIL_DOMAIN = ORIGINAL_ALLOWED_DOMAIN;
  if (ORIGINAL_TEAM_ROSTER_ADMIN === undefined) delete process.env.TEAM_ROSTER_ADMIN_EMAILS;
  else process.env.TEAM_ROSTER_ADMIN_EMAILS = ORIGINAL_TEAM_ROSTER_ADMIN;
});

describe("app-access", () => {
  it("treats tasks-only staff when listed in env", () => {
    process.env.TASKS_ONLY_EMAILS = "tasksonly@example.com";
    process.env.ALLOWED_EMAILS = "tasksonly@example.com,billing@example.com";
    expect(isTasksOnlyEmail("tasksonly@example.com")).toBe(true);
    expect(canAccessBilling("tasksonly@example.com")).toBe(false);
    expect(canAccessBilling("billing@example.com")).toBe(true);
  });

  it("requires firm staff to use Google sign-in", () => {
    process.env.ALLOWED_EMAILS = "staff@example.com";
    expect(resolveStaffSignIn("staff@example.com", "google")).toBe(true);
    expect(resolveStaffSignIn("guest@gmail.com", "google")).toBe(false);
  });

  it("blocks billing API paths at middleware layer", () => {
    expect(isBillingApiPath("/api/clients/ABC")).toBe(true);
    expect(isBillingApiPath("/api/tasks/items")).toBe(false);
  });

  it("treats allowlisted staff differently from unknown emails", () => {
    process.env.ALLOWED_EMAILS = "staff@example.com,partner@example.com";
    process.env.ALLOWED_EMAIL_DOMAIN = "hernandezassociates.com";

    expect(isStaffEmail("staff@example.com")).toBe(true);
    expect(isStaffEmail("partner@hernandezassociates.com")).toBe(true);
    expect(isStaffEmail("guest@gmail.com")).toBe(false);
    expect(canAccessOfficeHub("guest@gmail.com")).toBe(false);
    expect(resolvePostLoginPath("guest@gmail.com")).toBe("/login?error=AccessDenied");
    expect(resolvePostLoginPath("staff@example.com")).toBe("/office-hub");
  });

  it("always allows the firm owner email even outside ALLOWED_EMAIL_DOMAIN", () => {
    process.env.ALLOWED_EMAILS = "staff@example.com";
    process.env.ALLOWED_EMAIL_DOMAIN = "hernandezlaw.info";

    expect(isStaffEmail("janinerose1191@gmail.com")).toBe(true);
    expect(canAccessOfficeHub("janinerose1191@gmail.com")).toBe(true);
    expect(canAccessBilling("janinerose1191@gmail.com")).toBe(true);
    expect(resolvePostLoginPath("janinerose1191@gmail.com")).toBe("/office-hub");
  });

  it("treats the firm owner as full admin with all billing tabs", () => {
    delete process.env.ADMIN_EMAILS;

    expect(isAdminEmail("janinerose1191@gmail.com")).toBe(true);
    expect(canEditDeskBilling("janinerose1191@gmail.com")).toBe(true);
    expect(canDeleteNotarizations("janinerose1191@gmail.com")).toBe(true);

    const tabs = billingNavTabsForUser(true, "full").map((tab) => tab.id);
    expect(tabs).toContain("staffSalary");
    expect(tabs).toContain("firmFinances");
    expect(tabs).toContain("reports");
    expect(isAllowedBillingPage("staffSalary", true, "full", "janinerose1191@gmail.com")).toBe(true);
    expect(isAllowedBillingPage("firmFinances", true, "full", "janinerose1191@gmail.com")).toBe(true);

    const tasksTabs = tasksNavTabsForUser(true, "full").map((tab) => tab.id);
    expect(tasksTabs).toContain("tools");
  });

  it("lets the firm owner manage associate lawyers and payroll staff", () => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.TEAM_ROSTER_ADMIN_EMAILS;

    expect(canManageTeamRoster("janinerose1191@gmail.com")).toBe(true);

    const rosterAdminTabs = billingNavTabsForUser(false, "full", true).map((tab) => tab.id);
    expect(rosterAdminTabs).toContain("staffSalary");
    expect(rosterAdminTabs).not.toContain("firmFinances");
    expect(isAllowedBillingPage("staffSalary", false, "full", "janinerose1191@gmail.com", true)).toBe(true);
  });
});

describe("tasks nav for tasks-only staff", () => {
  it("shows field-staff nav when billing is disabled", () => {
    const tabs = tasksNavTabsForUser(false, "tasks-only");
    expect(tabs.map((tab) => tab.id)).toEqual(["today", "add-task", "add-event", "calendar"]);
    expect(isAllowedTasksTab("week", false, "tasks-only")).toBe(false);
  });
});

describe("secretary desk nav", () => {
  it("defaults to the firm inbox for secretary nav", () => {
    delete process.env.SECRETARY_NAV_EMAILS;
    expect(isSecretaryNavUser("legal@hernandezlaw.info")).toBe(true);
    expect(isSecretaryNavUser("partner@hernandezlaw.info")).toBe(false);
  });

  it("gives secretary full billing except reports and admin tabs", () => {
    const tabs = billingNavTabsForUser(false, "secretary").map((tab) => tab.id);
    expect(tabs).toContain("home");
    expect(tabs).toContain("history");
    expect(tabs).not.toContain("reports");
    expect(tabs).not.toContain("staffSalary");
    expect(tabs).not.toContain("firmFinances");
    expect(isAllowedBillingPage("reports", false, "secretary")).toBe(false);
    expect(isAllowedBillingPage("home", false, "secretary")).toBe(true);
  });
});

describe("desk billing editors", () => {
  it("defaults firm inbox to desk billing edit access", () => {
    delete process.env.DESK_BILLING_EDITOR_EMAILS;
    delete process.env.SECRETARY_NAV_EMAILS;
    expect(canEditDeskBilling("legal@hernandezlaw.info")).toBe(true);
    expect(canDeleteNotarizations("legal@hernandezlaw.info")).toBe(true);
  });
});
