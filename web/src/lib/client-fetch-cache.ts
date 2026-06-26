type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export type CachedFetchOptions = {
  /** Show cached data while revalidating (default true). */
  staleWhileRevalidate?: boolean;
  /** Max age before background refresh (ms). Default 60s. */
  maxAgeMs?: number;
};

export async function cachedFetchJson<T>(
  key: string,
  loader: () => Promise<T>,
  options: CachedFetchOptions = {}
): Promise<{ data: T; fetchedAt: number; fromCache: boolean }> {
  const maxAgeMs = options.maxAgeMs ?? 60_000;
  const staleWhileRevalidate = options.staleWhileRevalidate !== false;
  const hit = store.get(key) as CacheEntry<T> | undefined;
  const age = hit ? Date.now() - hit.fetchedAt : Infinity;
  const fresh = hit && age < maxAgeMs;

  if (fresh) {
    return { data: hit.data, fetchedAt: hit.fetchedAt, fromCache: true };
  }

  if (staleWhileRevalidate && hit) {
    void revalidate(key, loader).catch(() => undefined);
    return { data: hit.data, fetchedAt: hit.fetchedAt, fromCache: true };
  }

  const data = await revalidate(key, loader);
  const entry = store.get(key) as CacheEntry<T>;
  return { data, fetchedAt: entry?.fetchedAt ?? Date.now(), fromCache: false };
}

async function revalidate<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const data = await loader();
      store.set(key, { data, fetchedAt: Date.now() });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function invalidateCachedFetch(key: string): void {
  store.delete(key);
  inflight.delete(key);
}

/** Warm cache in the background — never throws and never caches failed responses. */
export function prefetchCachedFetch(key: string, loader: () => Promise<unknown>): void {
  if (store.has(key) || inflight.has(key)) return;

  const promise = (async () => {
    try {
      const data = await loader();
      if (data !== null && data !== undefined) {
        store.set(key, { data, fetchedAt: Date.now() });
      }
    } catch {
      // Prefetch is optional; ignore auth/quota/transient failures.
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
}
