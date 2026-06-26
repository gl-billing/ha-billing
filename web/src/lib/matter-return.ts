
/** Query param carrying the in-app page the user came from before opening a matter. */
export const MATTER_RETURN_PARAM = "from";

const LOCAL_ORIGIN = "http://local";

export function isMatterPath(path: string): boolean {
  const pathname = path.split("?")[0]?.split("#")[0] || "";
  return /^\/matter\/[^/?#]+/.test(pathname);
}

export function buildMatterReturnPath(pathname: string, search?: string | URLSearchParams | null): string {
  const path = pathname || "/";
  if (!search) return path;
  const qs =
    typeof search === "string"
      ? search.replace(/^\?/, "")
      : search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function sanitizeMatterReturnPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/login")) return null;

  try {
    const url = new URL(trimmed, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function matterReturnPathForNavigation(
  pathname: string,
  searchParams: URLSearchParams | string | null | undefined
): string {
  if (isMatterPath(pathname)) {
    const params =
      searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(typeof searchParams === "string" ? searchParams.replace(/^\?/, "") : "");
    const existing = sanitizeMatterReturnPath(params.get(MATTER_RETURN_PARAM));
    if (existing) return existing;
    return "/app";
  }

  return buildMatterReturnPath(pathname, searchParams);
}

export function readMatterReturnFromSearchParams(
  searchParams: URLSearchParams | null | undefined
): string | null {
  return sanitizeMatterReturnPath(searchParams?.get(MATTER_RETURN_PARAM));
}

export function withMatterReturn(href: string, returnPath: string | null | undefined): string {
  const sanitized = sanitizeMatterReturnPath(returnPath);
  if (!sanitized || !isMatterPath(href)) return href;

  const url = new URL(href, LOCAL_ORIGIN);
  url.searchParams.set(MATTER_RETURN_PARAM, sanitized);
  return `${url.pathname}${url.search}`;
}

export function matterReturnLabel(path: string | null | undefined): string {
  const sanitized = sanitizeMatterReturnPath(path);
  if (!sanitized) return "Go back";

  const pathname = sanitized.split("?")[0] || "";
  if (pathname.startsWith("/billing")) return "Back to billing";
  if (pathname.startsWith("/app")) return "Back to tasks";
  if (pathname.startsWith("/office-hub")) return "Back to office hub";
  if (pathname.startsWith("/matter/")) return "Go back";
  return "Go back";
}
