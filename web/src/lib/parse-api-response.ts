type ApiJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T;
  errorMessage: string | null;
};

/** Parse fetch responses safely — avoids JSON parse errors when the server returns plain text. */
export async function parseApiJson<T = Record<string, unknown>>(
  response: Response
): Promise<ApiJsonResult<T>> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!text.trim()) {
    return {
      ok: response.ok,
      status: response.status,
      data: {} as T,
      errorMessage: response.ok ? null : `Request failed (${response.status}).`
    };
  }

  const looksJson = contentType.includes("application/json") || text.trim().startsWith("{");
  if (looksJson) {
    try {
      const data = JSON.parse(text) as T;
      const apiError =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error || "").trim()
          : "";
      return {
        ok: response.ok,
        status: response.status,
        data,
        errorMessage: response.ok ? null : apiError || `Request failed (${response.status}).`
      };
    } catch {
      /* fall through to plain-text handling */
    }
  }

  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    ok: false,
    status: response.status,
    data: {} as T,
    errorMessage:
      response.status >= 500
        ? "Server error — refresh the page and try again. If it persists, restart the local dev server."
        : snippet || `Request failed (${response.status}).`
  };
}
