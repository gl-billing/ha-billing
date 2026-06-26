const PREFIX = "gl-form-draft:";

export function saveFormDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    /* quota / private mode */
  }
}

export function readFormDraft<T>(key: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!parsed.value) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > maxAgeMs) {
      localStorage.removeItem(`${PREFIX}${key}`);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    /* ignore */
  }
}
