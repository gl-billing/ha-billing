import { buildClioHref, resolveClioFromTasksTab } from "@/lib/clio/workspace-nav";
import type { SavedTasksTab } from "@/lib/staff-prefs";

export type TasksDeepLink = {
  tab?: SavedTasksTab;
  clientCode?: string;
  q?: string;
};

export function tasksHref(link: TasksDeepLink): string {
  const tab = link.tab || "today";
  const clio = resolveClioFromTasksTab(tab);
  const params = new URLSearchParams();
  if (link.clientCode) params.set("client", link.clientCode.trim().toUpperCase());
  if (link.q) params.set("q", link.q);
  const qs = params.toString();
  const href = buildClioHref(clio.nav, clio.section);
  return qs ? `${href}${href.includes("?") ? "&" : "?"}${qs}` : href;
}

export function correspondenceHref(clientCode?: string): string {
  return tasksHref({ tab: "correspondence", clientCode });
}
