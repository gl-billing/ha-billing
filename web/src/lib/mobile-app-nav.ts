import { billingHref } from "@/lib/billing-routes";
import { isMobileOfficeHomePath, mobileOfficeHomeHref } from "@/lib/space-nav";
import { tasksHref } from "@/lib/tasks-routes";
import { mobileOfficeBackHref } from "@/lib/mobile-office-views";

export const HA_MOBILE_OPEN_MENU = "ha-mobile-open-menu";
export const HA_OPEN_COMMAND_PALETTE = "ha-open-command-palette";

export type MobileBottomTab = "home" | "calendar" | "tasks" | "clients" | "more";

export type MobileNavOptions = {
  billingAccess?: boolean;
};

export function openMobileOfficeMenu(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HA_MOBILE_OPEN_MENU));
}

function pathBase(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function paramsOf(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function onTasksApp(pathname: string): boolean {
  const path = pathBase(pathname);
  return path === "/app" || path.endsWith("/app");
}

function onBillingApp(pathname: string): boolean {
  const path = pathBase(pathname);
  return path === "/billing" || path.endsWith("/billing");
}

function onMatterPage(pathname: string): boolean {
  return /\/matter(\/|$)/.test(pathBase(pathname));
}

/** Primary tabs keep the brand header without a Back row (bottom nav is enough). */
export function isMobilePrimaryTab(pathname: string, search = ""): boolean {
  if (isMobileOfficeHomePath(pathname, search)) return true;
  const params = paramsOf(search);
  const tab = (params.get("tab") || "").trim().toLowerCase();
  const page = (params.get("page") || "").trim().toLowerCase();
  if (onTasksApp(pathname)) {
    if (tab === "week" || tab === "calendar") return true;
    if (tab === "all-items" || tab === "tasks") return true;
    return false;
  }
  if (onBillingApp(pathname)) {
    return page === "clients" || page === "deskclients" || page === "retainers";
  }
  return false;
}

export function mobileBottomNavActive(pathname: string, search = ""): MobileBottomTab {
  if (isMobileOfficeHomePath(pathname, search)) return "home";
  if (onMatterPage(pathname)) return "clients";
  const params = paramsOf(search);
  const tab = (params.get("tab") || "").trim().toLowerCase();
  const page = (params.get("page") || "").trim().toLowerCase();
  const space = (params.get("space") || "").trim().toLowerCase();
  if (onTasksApp(pathname)) {
    if (tab === "week" || tab === "calendar") return "calendar";
    if (tab === "all-items" || tab === "tasks" || tab === "add-task") return "tasks";
    if (tab === "add-event") return "calendar";
    if (space === "notifications") return "more";
    return "more";
  }
  if (onBillingApp(pathname)) {
    if (page === "clients" || page === "deskclients" || page === "retainers") return "clients";
    return "more";
  }
  return "more";
}

export function mobileBottomNavItems(v: MobileNavOptions): Array<{
  id: MobileBottomTab;
  href: string;
  label: string;
}> {
  const calendar = tasksHref({ tab: "week" });
  const items: Array<{ id: MobileBottomTab; href: string; label: string }> = [
    { id: "home", href: mobileOfficeHomeHref(), label: "Home" },
    {
      id: "calendar",
      href: `${calendar}${calendar.includes("?") ? "&" : "?"}cal=day`,
      label: "Calendar"
    },
    { id: "tasks", href: tasksHref({ tab: "all-items" }), label: "Tasks" }
  ];
  if (v.billingAccess !== false) {
    items.push({ id: "clients", href: billingHref({ page: "clients" }), label: "Clients" });
  }
  return items;
}

export function mobileAppBackHref(homeHref: string, pathname: string, search = ""): string {
  const params = paramsOf(search);
  if (onTasksApp(pathname)) {
    return mobileOfficeBackHref(homeHref, search);
  }
  const from = params.get("from")?.trim();
  if (from && from.startsWith("/")) return from;
  if (onMatterPage(pathname)) {
    return billingHref({ page: "clients" });
  }
  return homeHref;
}

export function mobileClientsListHref(): string {
  return billingHref({ page: "clients" });
}
