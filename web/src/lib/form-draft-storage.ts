import { readBrowserStorage, removeBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

const PREFIX = "ha-form-draft:";
const LEGACY_PREFIX = "gl-form-draft:";

export function saveFormDraft<T>(key: string, value: T): void {
  writeBrowserStorage(`${PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }), `${LEGACY_PREFIX}${key}`);
}

export function readFormDraft<T>(key: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000): T | null {
  const raw = readBrowserStorage(`${PREFIX}${key}`, `${LEGACY_PREFIX}${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!parsed.value) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > maxAgeMs) {
      clearFormDraft(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string): void {
  removeBrowserStorage(`${PREFIX}${key}`, `${LEGACY_PREFIX}${key}`);
}
