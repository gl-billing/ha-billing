import { firmAppHref } from "@/lib/firm-apps";
import type { SavedTasksTab } from "@/lib/staff-prefs";

export type TasksDeepLink = {
  tab?: SavedTasksTab;
  clientCode?: string;
  q?: string;
};

export function tasksHref(link: TasksDeepLink): string {
  const base = firmAppHref("/app");
  const params = new URLSearchParams();
  if (link.tab) params.set("tab", link.tab);
  if (link.clientCode) params.set("client", link.clientCode.trim().toUpperCase());
  if (link.q) params.set("q", link.q);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function correspondenceHref(clientCode?: string): string {
  return tasksHref({ tab: "correspondence", clientCode });
}
