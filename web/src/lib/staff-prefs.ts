import type { WorkspaceId } from "@/lib/office-hub/storage";
import { getLastWorkspace } from "@/lib/office-hub/storage";

const TASKS_TAB_KEY = "gl-office-tasks-tab";
const BILLING_PAGE_KEY = "gl-office-billing-page";

export type SavedTasksTab =
  | "today"
  | "calendar"
  | "week"
  | "team"
  | "history"
  | "add-task"
  | "add-event"
  | "all-items"
  | "correspondence"
  | "tools";

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

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing or quota — ignore.
  }
}

export function getSavedTasksTab(): SavedTasksTab | null {
  const value = readStorage(TASKS_TAB_KEY);
  const allowed: SavedTasksTab[] = [
    "today",
    "calendar",
    "week",
    "team",
    "history",
    "add-task",
    "add-event",
    "all-items",
    "correspondence",
    "tools"
  ];
  return allowed.includes(value as SavedTasksTab) ? (value as SavedTasksTab) : null;
}

export function saveTasksTab(tab: SavedTasksTab): void {
  writeStorage(TASKS_TAB_KEY, tab);
}

export function getSavedBillingPage(): SavedBillingPage | null {
  const value = readStorage(BILLING_PAGE_KEY);
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
  writeStorage(BILLING_PAGE_KEY, page);
}

const MATTER_CODE_KEY = "gl-office-matter-code";
const MATTER_LABEL_KEY = "gl-office-matter-label";

export type SavedMatter = {
  code: string;
  label?: string;
};

export function getSavedMatter(): SavedMatter | null {
  const code = readStorage(MATTER_CODE_KEY)?.trim().toUpperCase();
  if (!code) return null;
  const label = readStorage(MATTER_LABEL_KEY)?.trim();
  return { code, label: label || undefined };
}

export function saveMatter(code: string, label?: string): void {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;
  writeStorage(MATTER_CODE_KEY, trimmed);
  if (label?.trim()) writeStorage(MATTER_LABEL_KEY, label.trim());
}

export function clearSavedMatter(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MATTER_CODE_KEY);
    localStorage.removeItem(MATTER_LABEL_KEY);
  } catch {
    // ignore
  }
}

/** Tasks-only staff never get "billing" as last workspace. */
export function getAllowedLastWorkspace(billingAccess: boolean): WorkspaceId | null {
  const last = getLastWorkspace();
  if (!billingAccess) {
    return last === "tasks" ? "tasks" : null;
  }
  return last;
}
