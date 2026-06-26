export type WorkspaceId = "billing" | "tasks";

const LAST_WORKSPACE_KEY = "gl-office-last-workspace";

export function getLastWorkspace(): WorkspaceId | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(LAST_WORKSPACE_KEY);
  return value === "billing" || value === "tasks" ? value : null;
}

export function setLastWorkspace(id: WorkspaceId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_WORKSPACE_KEY, id);
}
