import { readBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

export type WorkspaceId = "billing" | "tasks";

const LAST_WORKSPACE_KEY = "ha-office-last-workspace";
const LEGACY_LAST_WORKSPACE_KEY = "gl-office-last-workspace";

export function getLastWorkspace(): WorkspaceId | null {
  const value = readBrowserStorage(LAST_WORKSPACE_KEY, LEGACY_LAST_WORKSPACE_KEY);
  return value === "billing" || value === "tasks" ? value : null;
}

export function setLastWorkspace(id: WorkspaceId): void {
  writeBrowserStorage(LAST_WORKSPACE_KEY, id, LEGACY_LAST_WORKSPACE_KEY);
}
