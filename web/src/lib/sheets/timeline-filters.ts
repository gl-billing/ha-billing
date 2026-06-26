import type { ActivityItem } from "@/lib/gl-config";

export type TimelineFilter = "all" | "billing" | "documents" | "tasks" | "hearings";

export function filterTimelineItems(items: ActivityItem[], filter: TimelineFilter): ActivityItem[] {
  if (filter === "all") return items;
  if (filter === "billing") {
    return items.filter((item) => item.kind === "charge" || item.kind === "payment" || item.kind === "billing");
  }
  if (filter === "documents") {
    return items.filter((item) => item.kind === "soa" || item.kind === "ar");
  }
  if (filter === "tasks") {
    return items.filter((item) => item.kind === "task" || item.kind === "task-action");
  }
  if (filter === "hearings") {
    return items.filter((item) => item.kind === "hearing");
  }
  return items;
}
