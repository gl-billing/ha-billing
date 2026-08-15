import { readBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

export type MyWorkScope = "mine" | "firm";

const STORAGE_KEY = "ha-office-my-work-scope";
const LEGACY_STORAGE_KEY = "gl-office-my-work-scope";

export function getSavedMyWorkScope(): MyWorkScope | null {
  const value = readBrowserStorage(STORAGE_KEY, LEGACY_STORAGE_KEY);
  return value === "mine" || value === "firm" ? value : null;
}

export function saveMyWorkScope(scope: MyWorkScope): void {
  writeBrowserStorage(STORAGE_KEY, scope, LEGACY_STORAGE_KEY);
}
