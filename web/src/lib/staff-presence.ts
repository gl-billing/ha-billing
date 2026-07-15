/** Staff presence — last opened / online status (firm-owner view only). */

export type PresenceWorkspace = "hub" | "billing" | "tasks";

export type StaffPresenceEntry = {
  email: string;
  displayName: string;
  workspace: PresenceWorkspace;
  path: string;
  lastSeen: string;
};

/** Consider online if heartbeat within this window. */
export const PRESENCE_ONLINE_MS = 3 * 60_000;

/** Keep history for the list when not currently online. */
export const PRESENCE_RETAIN_MS = 24 * 60 * 60_000;

export const PRESENCE_SETTING_KEY_PREFIX = "Staff Presence ";

export function presenceSettingKey(email: string): string {
  return `${PRESENCE_SETTING_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

export function parsePresenceEntry(raw: string): StaffPresenceEntry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StaffPresenceEntry>;
    const email = String(parsed.email ?? "").trim().toLowerCase();
    const lastSeen = String(parsed.lastSeen ?? "").trim();
    if (!email || !lastSeen || Number.isNaN(Date.parse(lastSeen))) return null;
    const workspace = parsed.workspace;
    const workspaceOk =
      workspace === "hub" || workspace === "billing" || workspace === "tasks" ? workspace : "hub";
    return {
      email,
      displayName: String(parsed.displayName ?? "").trim() || email,
      workspace: workspaceOk,
      path: String(parsed.path ?? "").trim() || "/",
      lastSeen: new Date(lastSeen).toISOString()
    };
  } catch {
    return null;
  }
}

export function serializePresenceEntry(entry: StaffPresenceEntry): string {
  return JSON.stringify({
    email: entry.email.trim().toLowerCase(),
    displayName: entry.displayName.trim(),
    workspace: entry.workspace,
    path: entry.path,
    lastSeen: new Date(entry.lastSeen).toISOString()
  });
}

export function isPresenceOnline(lastSeen: string, nowMs = Date.now()): boolean {
  const seen = Date.parse(lastSeen);
  if (Number.isNaN(seen)) return false;
  return nowMs - seen <= PRESENCE_ONLINE_MS;
}

export function isPresenceRecent(lastSeen: string, nowMs = Date.now()): boolean {
  const seen = Date.parse(lastSeen);
  if (Number.isNaN(seen)) return false;
  return nowMs - seen <= PRESENCE_RETAIN_MS;
}

export function collectPresenceFromSettings(
  settings: Map<string, string>,
  nowMs = Date.now()
): StaffPresenceEntry[] {
  const entries: StaffPresenceEntry[] = [];
  for (const [key, value] of settings) {
    if (!key.startsWith(PRESENCE_SETTING_KEY_PREFIX)) continue;
    const entry = parsePresenceEntry(value);
    if (!entry || !isPresenceRecent(entry.lastSeen, nowMs)) continue;
    entries.push(entry);
  }
  return entries.sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
}

export function workspaceLabel(workspace: PresenceWorkspace): string {
  if (workspace === "billing") return "Accounts";
  if (workspace === "tasks") return "Schedule";
  return "Office Hub";
}
