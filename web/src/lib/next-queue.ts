import { billingHref } from "@/lib/billing-routes";
import type { MyWorkBillingSummary } from "@/lib/my-work-billing";
import type { OfficeHubSummary } from "@/lib/office-hub/summary";
import { clientCodeFromCase } from "@/lib/office-tasks/client-matter";
import { matterHref } from "@/lib/matter-routes";
import { tasksHref } from "@/lib/tasks-routes";
import type { FilingDeadlineAlert } from "@/lib/office-tasks/filing-confirmation";

export type NextQueuePriority = "urgent" | "high" | "normal";

export type NextQueueItem = {
  id: string;
  priority: NextQueuePriority;
  rank: number;
  label: string;
  detail?: string;
  href: string;
  kind: "task" | "hearing" | "filing" | "billing" | "document";
};

const PRIORITY_RANK: Record<NextQueuePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2
};

export function buildNextQueue(options: {
  summary: OfficeHubSummary;
  billing?: MyWorkBillingSummary | null;
  billingAccess?: boolean;
  filingAlerts?: FilingDeadlineAlert[];
  limit?: number;
}): NextQueueItem[] {
  const { summary, billing, billingAccess = false, filingAlerts = [], limit = 8 } = options;
  const items: NextQueueItem[] = [];
  const tasks = summary.tasks;

  if (tasks?.overdueOpen) {
    items.push({
      id: "tasks-overdue",
      priority: "urgent",
      rank: 10,
      label: `Clear ${tasks.overdueOpen} overdue task${tasks.overdueOpen === 1 ? "" : "s"}`,
      detail: "Past due — complete or reschedule",
      href: tasksHref({ tab: "today", q: "overdue" }),
      kind: "task"
    });
  }

  for (const alert of filingAlerts.slice(0, 3)) {
    if (alert.urgency !== "overdue" && alert.urgency !== "due-today" && alert.urgency !== "confirm-soon") continue;
    const clientCode = clientCodeFromCase(alert.item.clientCase);
    const timelineKind = alert.item.source === "Event" ? "hearing" : "task";
    const timelineId = `${timelineKind}-${alert.item.sheetName}-${alert.item.rowNumber}`;
    items.push({
      id: `filing-${alert.item.id}`,
      priority: alert.urgency === "overdue" ? "urgent" : "high",
      rank: alert.urgency === "overdue" ? 15 : 20,
      label: alert.needsConfirmation ? "Confirm filing submitted" : "Filing deadline",
      detail: `${alert.item.clientCase || "Matter"} · ${alert.deadline}`,
      href: clientCode
        ? matterHref(clientCode, undefined, { highlightTimeline: timelineId })
        : tasksHref({ tab: "today" }),
      kind: "filing"
    });
  }

  if (tasks?.eventsToday) {
    items.push({
      id: "events-today",
      priority: "urgent",
      rank: 25,
      label: `${tasks.eventsToday} hearing${tasks.eventsToday === 1 ? "" : "s"} today`,
      detail: "Review prep and court confirmations",
      href: tasksHref({ tab: "today" }),
      kind: "hearing"
    });
  }

  if (tasks?.tasksDueToday) {
    items.push({
      id: "tasks-today",
      priority: "high",
      rank: 30,
      label: `${tasks.tasksDueToday} task${tasks.tasksDueToday === 1 ? "" : "s"} due today`,
      href: tasksHref({ tab: "today" }),
      kind: "task"
    });
  }

  if (billingAccess && billing) {
    if (billing.overdueCount) {
      items.push({
        id: "billing-overdue",
        priority: "high",
        rank: 40,
        label: `${billing.overdueCount} overdue client${billing.overdueCount === 1 ? "" : "s"}`,
        detail: "Collections follow-up",
        href: billingHref({ page: "home" }),
        kind: "billing"
      });
    }
    if (billing.pendingArCount) {
      items.push({
        id: "billing-ar",
        priority: "high",
        rank: 45,
        label: `Issue ${billing.pendingArCount} acknowledgment receipt${billing.pendingArCount === 1 ? "" : "s"}`,
        href: billingHref({ page: "documents", docTab: "ar" }),
        kind: "document"
      });
    }
    if (billing.followUpCount) {
      items.push({
        id: "billing-followup",
        priority: "normal",
        rank: 50,
        label: `${billing.followUpCount} collection follow-up${billing.followUpCount === 1 ? "" : "s"} this week`,
        href: billingHref({ page: "home" }),
        kind: "billing"
      });
    }
  } else if (billingAccess && summary.billingOverdueClients) {
    items.push({
      id: "billing-overdue-fallback",
      priority: "high",
      rank: 40,
      label: `${summary.billingOverdueClients} overdue client${summary.billingOverdueClients === 1 ? "" : "s"}`,
      href: billingHref({ page: "home" }),
      kind: "billing"
    });
  }

  return items
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.rank - b.rank)
    .slice(0, limit);
}

/** @deprecated Use buildNextQueue — kept for hub list compatibility. */
export function buildMyWorkHubItems(options: Parameters<typeof buildNextQueue>[0]) {
  return buildNextQueue(options).map((item) => ({
    id: item.id,
    label: item.detail ? `${item.label} — ${item.detail}` : item.label,
    href: item.href
  }));
}
