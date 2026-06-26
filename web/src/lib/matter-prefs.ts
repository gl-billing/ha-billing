export type MatterPrefEntry = {
  code: string;
  label?: string;
  at: number;
};

export type OfflineMatterSnapshot = {
  code: string;
  label: string;
  caseTitle?: string;
  balance?: number;
  openTasks?: number;
  openEvents?: number;
  timelinePreview?: Array<{ date: string; title: string; kind: string }>;
  savedAt: number;
};

const RECENT_KEY = "gl-office-recent-matters";
const PINNED_KEY = "gl-office-pinned-matters";
const OFFLINE_PREFIX = "gl-office-offline-matter:";
const MAX_RECENT = 8;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

export function recordMatterVisit(code: string, label?: string): void {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;

  const now = Date.now();
  const recent = getRecentMatters().filter((entry) => entry.code !== trimmed);
  recent.unshift({ code: trimmed, label: label?.trim() || undefined, at: now });
  writeJson(RECENT_KEY, recent.slice(0, MAX_RECENT));

  const pinned = getPinnedMatters();
  const pinIndex = pinned.findIndex((entry) => entry.code === trimmed);
  if (pinIndex >= 0 && label?.trim()) {
    pinned[pinIndex] = { ...pinned[pinIndex], label: label.trim(), at: now };
    writeJson(PINNED_KEY, pinned);
  }
}

export function getRecentMatters(): MatterPrefEntry[] {
  return readJson<MatterPrefEntry[]>(RECENT_KEY, []);
}

export function getPinnedMatters(): MatterPrefEntry[] {
  return readJson<MatterPrefEntry[]>(PINNED_KEY, []);
}

export function isMatterPinned(code: string): boolean {
  const trimmed = code.trim().toUpperCase();
  return getPinnedMatters().some((entry) => entry.code === trimmed);
}

export function togglePinMatter(code: string, label?: string): boolean {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return false;

  const pinned = getPinnedMatters();
  const index = pinned.findIndex((entry) => entry.code === trimmed);
  if (index >= 0) {
    pinned.splice(index, 1);
    writeJson(PINNED_KEY, pinned);
    return false;
  }

  pinned.unshift({ code: trimmed, label: label?.trim() || undefined, at: Date.now() });
  writeJson(PINNED_KEY, pinned.slice(0, 12));
  return true;
}

export function saveOfflineMatterSnapshot(snapshot: OfflineMatterSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${OFFLINE_PREFIX}${snapshot.code}`, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function getOfflineMatterSnapshot(code: string): OfflineMatterSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${OFFLINE_PREFIX}${code.trim().toUpperCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineMatterSnapshot;
  } catch {
    return null;
  }
}
