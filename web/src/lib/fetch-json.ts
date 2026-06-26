import {
  enqueueOfflineWrite,
  isOfflineError,
  shouldQueueOfflineRequest
} from "@/lib/offline-write-queue";

/** Parse a fetch response body as JSON; returns null when the body is empty or not JSON. */
export async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseResponseText<T>(text: string, status: number): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        status === 404
          ? "Could not reach the server API. Refresh the page and try again."
          : `Server returned an error page (${status}). Try refreshing or signing in again.`
      );
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("Internal Server Error")) {
      throw new Error("Server error — refresh the page. If it keeps happening, restart the dev server.");
    }
    throw new Error(trimmed || `Unexpected server response (${status}).`);
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<{ ok: boolean; status: number; data: T }> {
  const timeoutMs = init?.timeoutMs ?? 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { timeoutMs: _t, ...rest } = init || {};
    const res = await fetch(url, { ...rest, signal: controller.signal });
    const text = await res.text();
    const data = parseResponseText<T>(text, res.status);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export type OfflineQueuedResult = {
  queued: true;
  label: string;
  message: string;
};

/** POST/PATCH/PUT/DELETE with offline queue fallback for billing writes. */
export async function postJsonWithOfflineQueue<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; offlineLabel: string }
): Promise<{ ok: boolean; status: number; data: T } | OfflineQueuedResult> {
  try {
    return await fetchJson<T>(url, init);
  } catch (error) {
    const body = typeof init.body === "string" ? init.body : "";
    if (shouldQueueOfflineRequest(init.method) && isOfflineError(error) && body) {
      enqueueOfflineWrite({ url, init, label: init.offlineLabel });
      return {
        queued: true,
        label: init.offlineLabel,
        message: `${init.offlineLabel} saved on this device. It will sync automatically when you are back online.`
      };
    }
    throw error;
  }
}
