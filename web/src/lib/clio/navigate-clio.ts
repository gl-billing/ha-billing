import { getBillingAppUrl, getTasksAppUrl } from "@/lib/firm-apps";

/** Billing and tasks on the same host — client router is enough (no full reload). */
export function isSameOriginClioApps(): boolean {
  return !getBillingAppUrl() && !getTasksAppUrl();
}

export function hrefAppPath(href: string, billingPath: string, tasksPath: string): string {
  if (href.startsWith(tasksPath)) return tasksPath;
  if (href.startsWith(billingPath)) return billingPath;
  return href.split("?")[0] || href;
}

export function navigateClioHref(
  href: string,
  options: {
    pathname: string;
    billingPath: string;
    tasksPath: string;
    push: (href: string) => void;
  }
): void {
  const { pathname, billingPath, tasksPath, push } = options;
  if (isSameOriginClioApps()) {
    push(href);
    return;
  }
  const targetPath = hrefAppPath(href, billingPath, tasksPath);
  const here = pathname.split("?")[0] || "";
  if (here !== targetPath) {
    window.location.assign(href);
    return;
  }
  push(href);
}
