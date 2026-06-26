/** When unset or "same", tasks/billing links use this app (one port, one tab). */
function isSameOriginMode(url: string | undefined): boolean {
  if (!url) return true;
  const v = url.toLowerCase();
  return v === "same" || v === "same-origin" || v === "merged";
}

/** Base URL for cross-app links; empty string = use relative paths on this host. */
export function getTasksAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_TASKS_APP_URL?.trim();
  if (isSameOriginMode(url)) return "";
  return (url || "").replace(/\/$/, "");
}

export function getBillingAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_BILLING_APP_URL?.trim();
  if (isSameOriginMode(url)) return "";
  return (url || "").replace(/\/$/, "");
}

export function firmAppHref(path: string, base?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const b = (base ?? "").replace(/\/$/, "");
  return b ? `${b}${p}` : p;
}

export function getTasksAppLoginUrl(): string {
  return firmAppHref("/login", getTasksAppUrl());
}

/** Force billing ↔ tasks ↔ hub links to stay in the same browser tab. */
export function sameWindowNavProps(href: string) {
  return { href, target: "_self" as const, rel: "noopener noreferrer" };
}
