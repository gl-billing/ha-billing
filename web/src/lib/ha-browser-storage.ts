/** Browser keys for HA Office. Earlier HA builds used different prefixes; those are read once then migrated. */

export function readBrowserStorage(key: string, legacyKey?: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(key);
    if (current != null) return current;
    if (!legacyKey) return null;
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy == null) return null;
    try {
      window.localStorage.setItem(key, legacy);
    } catch {
      /* quota / private mode */
    }
    return legacy;
  } catch {
    return null;
  }
}

export function writeBrowserStorage(key: string, value: string, legacyKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    if (legacyKey) window.localStorage.removeItem(legacyKey);
  } catch {
    /* private browsing or quota */
  }
}

export function removeBrowserStorage(key: string, legacyKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    if (legacyKey) window.localStorage.removeItem(legacyKey);
  } catch {
    /* ignore */
  }
}

export function readSessionStorage(key: string, legacyKey?: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.sessionStorage.getItem(key);
    if (current != null) return current;
    if (!legacyKey) return null;
    const legacy = window.sessionStorage.getItem(legacyKey);
    if (legacy == null) return null;
    try {
      window.sessionStorage.setItem(key, legacy);
      window.sessionStorage.removeItem(legacyKey);
    } catch {
      /* ignore */
    }
    return legacy;
  } catch {
    return null;
  }
}

export function writeSessionStorage(key: string, value: string, legacyKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
    if (legacyKey) window.sessionStorage.removeItem(legacyKey);
  } catch {
    /* ignore */
  }
}

export function removeSessionStorage(key: string, legacyKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
    if (legacyKey) window.sessionStorage.removeItem(legacyKey);
  } catch {
    /* ignore */
  }
}
