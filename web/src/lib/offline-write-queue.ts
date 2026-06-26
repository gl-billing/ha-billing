export type OfflineWriteEntry = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  label: string;
  createdAt: number;
  attempts: number;
};

const STORAGE_KEY = "gl-offline-write-queue-v1";
const MAX_QUEUE = 40;

function readQueue(): OfflineWriteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineWriteEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: OfflineWriteEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_QUEUE)));
  } catch {
    /* private mode / quota */
  }
}

export function listOfflineWrites(): OfflineWriteEntry[] {
  return readQueue();
}

export function countOfflineWrites(): number {
  return readQueue().length;
}

export function enqueueOfflineWrite(input: {
  url: string;
  init?: RequestInit;
  label: string;
}): OfflineWriteEntry {
  const entry: OfflineWriteEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: input.url,
    method: (input.init?.method || "POST").toUpperCase(),
    headers: Object.fromEntries(new Headers(input.init?.headers || {}).entries()),
    body: typeof input.init?.body === "string" ? input.init.body : "",
    label: input.label,
    createdAt: Date.now(),
    attempts: 0
  };
  const next = [...readQueue(), entry];
  writeQueue(next);
  return entry;
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("failed to fetch") || message.includes("network") || message.includes("load failed");
}

export function shouldQueueOfflineRequest(method?: string): boolean {
  const verb = (method || "GET").toUpperCase();
  return verb === "POST" || verb === "PATCH" || verb === "PUT" || verb === "DELETE";
}

export async function flushOfflineWriteQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  const queue = readQueue();
  if (!queue.length) return { synced: 0, failed: 0, remaining: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: OfflineWriteEntry[] = [];

  for (const entry of queue) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: {
          "Content-Type": "application/json",
          ...entry.headers
        },
        body: entry.body || undefined
      });
      if (!response.ok) {
        failed += 1;
        remaining.push({ ...entry, attempts: entry.attempts + 1 });
        continue;
      }
      synced += 1;
    } catch {
      failed += 1;
      remaining.push({ ...entry, attempts: entry.attempts + 1 });
    }
  }

  writeQueue(remaining);
  return { synced, failed, remaining: remaining.length };
}
