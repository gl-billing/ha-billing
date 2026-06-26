type CacheEntry<T> = { value: T; expiresAt: number; generation: number };

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

export function cacheKey(token: string, key: string): string {
  return `${key}:${token.slice(-12)}`;
}

export async function withCache<T>(
  token: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const id = cacheKey(token, key);
  const hit = store.get(id) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now() && hit.generation === cacheGeneration) {
    return hit.value;
  }

  const pending = inflight.get(id) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const startedGeneration = cacheGeneration;

  const promise = (async () => {
    try {
      const value = await loader();
      if (startedGeneration === cacheGeneration) {
        store.set(id, { value, expiresAt: Date.now() + ttlMs, generation: cacheGeneration });
      }
      return value;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, promise);
  return promise;
}

export function invalidateCache(token: string, keyPrefix: string): void {
  cacheGeneration += 1;
  const suffix = token.slice(-12);
  for (const id of store.keys()) {
    if (id.startsWith(`${keyPrefix}:`) && id.endsWith(suffix)) {
      store.delete(id);
    }
  }
  for (const id of inflight.keys()) {
    if (id.startsWith(`${keyPrefix}:`) && id.endsWith(suffix)) {
      inflight.delete(id);
    }
  }
}

/** Invalidate shared billing reads used across home, my-work, clients, and master list. */
export function invalidateBillingReadCaches(token: string): void {
  for (const prefix of [
    "home-dashboard",
    "my-work-billing",
    "pending-ar",
    "master-rows",
    "clients",
    "clients:active",
    "clients:all",
    "walk-ins",
    "task-billing"
  ]) {
    invalidateCache(token, prefix);
  }
}

export function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Quota exceeded") ||
    message.includes("429") ||
    message.includes("rateLimitExceeded")
  );
}

export function quotaErrorMessage(): string {
  return "Google Sheets read limit reached (about 60 reads per minute). Wait 60 seconds, then refresh once. Avoid opening many client profiles or tabs at the same time.";
}
