import { readBrowserStorage, removeBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

export type WorkspaceIntroKind = "tasks" | "billing";

const STORAGE_KEYS: Record<WorkspaceIntroKind, { current: string; legacy: string }> = {
  tasks: { current: "ha-workspace-intro-seen-tasks", legacy: "gl-workspace-intro-seen-tasks" },
  billing: { current: "ha-workspace-intro-seen-billing", legacy: "gl-workspace-intro-seen-billing" }
};

function storageKeys(workspace: WorkspaceIntroKind, email?: string | null): { current: string; legacy: string } {
  const base = STORAGE_KEYS[workspace];
  const normalized = email?.trim().toLowerCase();
  const suffix = normalized ? `:${normalized}` : "";
  return { current: `${base.current}${suffix}`, legacy: `${base.legacy}${suffix}` };
}

export function hasSeenWorkspaceIntro(workspace: WorkspaceIntroKind, email?: string | null): boolean {
  const keys = storageKeys(workspace, email);
  return readBrowserStorage(keys.current, keys.legacy) === "1";
}

export function markWorkspaceIntroSeen(workspace: WorkspaceIntroKind, email?: string | null): void {
  const keys = storageKeys(workspace, email);
  writeBrowserStorage(keys.current, "1", keys.legacy);
}

export function clearWorkspaceIntroSeen(workspace: WorkspaceIntroKind, email?: string | null): void {
  const keys = storageKeys(workspace, email);
  removeBrowserStorage(keys.current, keys.legacy);
}
