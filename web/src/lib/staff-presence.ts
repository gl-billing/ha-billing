/** Staff presence — attendance register (firm-admin view). */

export type PresenceWorkspace = "hub" | "billing" | "tasks";

export type StaffPresenceLogin = {
  /** ISO timestamp when this session started (app open after a gap). */
  at: string;
  workspace: PresenceWorkspace;
};

export type StaffPresenceEntry = {
  email: string;
  displayName: string;
  workspace: PresenceWorkspace;
  path: string;
  /** Last heartbeat while the app is open. */
  lastSeen: string;
  /** Most recent session start (sign-in / reopen after gap). */
  lastSignedIn: string;
  /** Recent session starts, newest first. */
  recentLogins: StaffPresenceLogin[];
};

/** Consider online if heartbeat within this window. */
export const PRESENCE_ONLINE_MS = 3 * 60_000;

/** Keep people on the live register when last seen within this window. */
export const PRESENCE_RETAIN_MS = 24 * 60 * 60_000;

/** New "signed in" if no heartbeat for this long (or first visit). */
export const PRESENCE_SESSION_GAP_MS = 30 * 60_000;

/** Keep sign-in history this long for the attendance log. */
export const PRESENCE_LOGIN_RETAIN_MS = 30 * 24 * 60 * 60_000;

/** Cap stored login events per person. */
export const PRESENCE_LOGIN_LOG_MAX = 40;

export const PRESENCE_SETTING_KEY_PREFIX = "Staff Presence ";

export function presenceSettingKey(email: string): string {
  return `${PRESENCE_SETTING_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

function normalizeWorkspace(value: unknown): PresenceWorkspace {
  return value === "billing" || value === "tasks" || value === "hub" ? value : "hub";
}

function parseLogin(raw: unknown): StaffPresenceLogin | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<StaffPresenceLogin>;
  const at = String(row.at ?? "").trim();
  if (!at || Number.isNaN(Date.parse(at))) return null;
  return {
    at: new Date(at).toISOString(),
    workspace: normalizeWorkspace(row.workspace)
  };
}

export function parsePresenceEntry(raw: string): StaffPresenceEntry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StaffPresenceEntry> & { recentLogins?: unknown };
    const email = String(parsed.email ?? "").trim().toLowerCase();
    const lastSeen = String(parsed.lastSeen ?? "").trim();
    if (!email || !lastSeen || Number.isNaN(Date.parse(lastSeen))) return null;

    const lastSeenIso = new Date(lastSeen).toISOString();
    const lastSignedInRaw = String(parsed.lastSignedIn ?? "").trim();
    const lastSignedIn =
      lastSignedInRaw && !Number.isNaN(Date.parse(lastSignedInRaw))
        ? new Date(lastSignedInRaw).toISOString()
        : lastSeenIso;

    const recentLogins = Array.isArray(parsed.recentLogins)
      ? parsed.recentLogins.map(parseLogin).filter((row): row is StaffPresenceLogin => Boolean(row))
      : [{ at: lastSignedIn, workspace: normalizeWorkspace(parsed.workspace) }];

    return {
      email,
      displayName: String(parsed.displayName ?? "").trim() || email,
      workspace: normalizeWorkspace(parsed.workspace),
      path: String(parsed.path ?? "").trim() || "/",
      lastSeen: lastSeenIso,
      lastSignedIn,
      recentLogins: recentLogins
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, PRESENCE_LOGIN_LOG_MAX)
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
    lastSeen: new Date(entry.lastSeen).toISOString(),
    lastSignedIn: new Date(entry.lastSignedIn).toISOString(),
    recentLogins: entry.recentLogins
      .slice(0, PRESENCE_LOGIN_LOG_MAX)
      .map((row) => ({
        at: new Date(row.at).toISOString(),
        workspace: row.workspace
      }))
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

function hasRecentLoginHistory(entry: StaffPresenceEntry, nowMs: number): boolean {
  if (Date.parse(entry.lastSignedIn) >= nowMs - PRESENCE_LOGIN_RETAIN_MS) return true;
  return entry.recentLogins.some((row) => Date.parse(row.at) >= nowMs - PRESENCE_LOGIN_RETAIN_MS);
}

export function collectPresenceFromSettings(
  settings: Map<string, string>,
  nowMs = Date.now()
): StaffPresenceEntry[] {
  const entries: StaffPresenceEntry[] = [];
  for (const [key, value] of settings) {
    if (!key.startsWith(PRESENCE_SETTING_KEY_PREFIX)) continue;
    const entry = parsePresenceEntry(value);
    if (!entry) continue;
    if (!isPresenceRecent(entry.lastSeen, nowMs) && !hasRecentLoginHistory(entry, nowMs)) continue;
    entries.push(entry);
  }
  return entries.sort((a, b) => {
    const signed = Date.parse(b.lastSignedIn) - Date.parse(a.lastSignedIn);
    if (signed !== 0) return signed;
    return Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
  });
}

/** Flatten recent logins across staff for the attendance sign-in log (newest first). */
export function flattenPresenceLoginLog(
  entries: StaffPresenceEntry[],
  nowMs = Date.now()
): Array<StaffPresenceLogin & { email: string; displayName: string }> {
  const cutoff = nowMs - PRESENCE_LOGIN_RETAIN_MS;
  const rows: Array<StaffPresenceLogin & { email: string; displayName: string }> = [];
  for (const entry of entries) {
    for (const login of entry.recentLogins) {
      if (Date.parse(login.at) < cutoff) continue;
      rows.push({
        ...login,
        email: entry.email,
        displayName: entry.displayName
      });
    }
  }
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * Apply a heartbeat: refresh lastSeen; if first visit or session gap, record a new sign-in.
 */
export function applyPresenceHeartbeat(
  previous: StaffPresenceEntry | null,
  input: {
    email: string;
    displayName: string;
    workspace: PresenceWorkspace;
    path: string;
    nowIso?: string;
  }
): StaffPresenceEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email;
  const workspace = input.workspace;
  const path = input.path.trim() || "/";

  const gapMs = previous ? nowMs - Date.parse(previous.lastSeen) : Number.POSITIVE_INFINITY;
  const isNewSession = !previous || Number.isNaN(gapMs) || gapMs >= PRESENCE_SESSION_GAP_MS;

  const priorLogins = previous?.recentLogins ?? [];
  const recentLogins = isNewSession
    ? [{ at: nowIso, workspace }, ...priorLogins]
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, PRESENCE_LOGIN_LOG_MAX)
    : priorLogins;

  return {
    email,
    displayName,
    workspace,
    path,
    lastSeen: nowIso,
    lastSignedIn: isNewSession ? nowIso : previous!.lastSignedIn,
    recentLogins
  };
}

export function workspaceLabel(workspace: PresenceWorkspace): string {
  if (workspace === "billing") return "Accounts";
  if (workspace === "tasks") return "Schedule";
  return "Office Hub";
}
