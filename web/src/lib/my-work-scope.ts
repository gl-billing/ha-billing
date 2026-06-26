export type MyWorkScope = "mine" | "firm";

const STORAGE_KEY = "gl-office-my-work-scope";

export function getSavedMyWorkScope(): MyWorkScope | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "mine" || value === "firm" ? value : null;
  } catch {
    return null;
  }
}

export function saveMyWorkScope(scope: MyWorkScope): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, scope);
  } catch {
    // ignore
  }
}
