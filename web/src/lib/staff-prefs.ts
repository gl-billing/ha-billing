import type { WorkspaceId } from "@/lib/office-hub/storage";
import { getLastWorkspace } from "@/lib/office-hub/storage";
import { readBrowserStorage, removeBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

const TASKS_TAB_KEY = "ha-office-tasks-tab";
const LEGACY_TASKS_TAB_KEY = "gl-office-tasks-tab";
const BILLING_PAGE_KEY = "ha-office-billing-page";
const LEGACY_BILLING_PAGE_KEY = "gl-office-billing-page";

export type SavedTasksTab =
  | "desk-checklist"
  | "today"
  | "calendar"
  | "week"
  | "team"
  | "history"
  | "add-task"
  | "add-event"
  | "all-items"
  | "correspondence"
  | "templates"
  | "filing"
  | "tools"
  | "liaison"
  | "presence";

export type SavedBillingPage =
  | "home"
  | "billing"
  | "clients"
  | "walkIns"
  | "spotBilling"
  | "notarizations"
  | "fieldDispatch"
  | "newClient"
  | "documents"
  | "history"
  | "reports"
  | "firmFinances"
  | "staffSalary";

export function getSavedTasksTab(): SavedTasksTab | null {
  const value = readBrowserStorage(TASKS_TAB_KEY, LEGACY_TASKS_TAB_KEY);
  const allowed: SavedTasksTab[] = [
    "desk-checklist",
    "today",
    "calendar",
    "week",
    "team",
    "history",
    "add-task",
    "add-event",
    "all-items",
    "correspondence",
    "templates",
    "filing",
    "tools",
    "liaison",
    "presence"
  ];
  return allowed.includes(value as SavedTasksTab) ? (value as SavedTasksTab) : null;
}

export function saveTasksTab(tab: SavedTasksTab): void {
  writeBrowserStorage(TASKS_TAB_KEY, tab, LEGACY_TASKS_TAB_KEY);
}

export function getSavedBillingPage(): SavedBillingPage | null {
  const value = readBrowserStorage(BILLING_PAGE_KEY, LEGACY_BILLING_PAGE_KEY);
  const allowed: SavedBillingPage[] = [
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
  return allowed.includes(value as SavedBillingPage) ? (value as SavedBillingPage) : null;
}

export function saveBillingPage(page: SavedBillingPage): void {
  writeBrowserStorage(BILLING_PAGE_KEY, page, LEGACY_BILLING_PAGE_KEY);
}

const MATTER_CODE_KEY = "ha-office-matter-code";
const LEGACY_MATTER_CODE_KEY = "gl-office-matter-code";
const MATTER_LABEL_KEY = "ha-office-matter-label";
const LEGACY_MATTER_LABEL_KEY = "gl-office-matter-label";

export type SavedMatter = {
  code: string;
  label?: string;
};

export function getSavedMatter(): SavedMatter | null {
  const code = readBrowserStorage(MATTER_CODE_KEY, LEGACY_MATTER_CODE_KEY)?.trim().toUpperCase();
  if (!code) return null;
  const label = readBrowserStorage(MATTER_LABEL_KEY, LEGACY_MATTER_LABEL_KEY)?.trim();
  return { code, label: label || undefined };
}

export function saveMatter(code: string, label?: string): void {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;
  writeBrowserStorage(MATTER_CODE_KEY, trimmed, LEGACY_MATTER_CODE_KEY);
  if (label?.trim()) writeBrowserStorage(MATTER_LABEL_KEY, label.trim(), LEGACY_MATTER_LABEL_KEY);
}

export function clearSavedMatter(): void {
  removeBrowserStorage(MATTER_CODE_KEY, LEGACY_MATTER_CODE_KEY);
  removeBrowserStorage(MATTER_LABEL_KEY, LEGACY_MATTER_LABEL_KEY);
}

/** Tasks-only staff never get "billing" as last workspace. */
export function getAllowedLastWorkspace(billingAccess: boolean): WorkspaceId | null {
  const last = getLastWorkspace();
  if (!billingAccess) {
    return last === "tasks" ? "tasks" : null;
  }
  return last;
}
