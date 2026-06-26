export type WorkspaceIntroKind = "tasks" | "billing";

const STORAGE_KEYS: Record<WorkspaceIntroKind, string> = {
  tasks: "gl-workspace-intro-seen-tasks",
  billing: "gl-workspace-intro-seen-billing"
};

function storageKey(workspace: WorkspaceIntroKind, email?: string | null): string {
  const base = STORAGE_KEYS[workspace];
  const normalized = email?.trim().toLowerCase();
  return normalized ? `${base}:${normalized}` : base;
}

export function hasSeenWorkspaceIntro(workspace: WorkspaceIntroKind, email?: string | null): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(storageKey(workspace, email)) === "1";
}

export function markWorkspaceIntroSeen(workspace: WorkspaceIntroKind, email?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(workspace, email), "1");
}

export function clearWorkspaceIntroSeen(workspace: WorkspaceIntroKind, email?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(workspace, email));
}
