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
import { canDeleteNotarizations } from "@/lib/admin";
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
    expect(isSecretaryNavUser("info@hernandezassociates.com")).toBe(true);
    expect(isSecretaryNavUser("partner@hernandezassociates.com")).toBe(false);
  });
});

describe("desk billing editors", () => {
  it("defaults firm inbox to desk billing edit access", () => {
    delete process.env.DESK_BILLING_EDITOR_EMAILS;
    delete process.env.SECRETARY_NAV_EMAILS;
    expect(canEditDeskBilling("info@hernandezassociates.com")).toBe(true);
    expect(canDeleteNotarizations("info@hernandezassociates.com")).toBe(true);
  });
});
