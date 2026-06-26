import { billingHref } from "@/lib/billing-routes";
import type { MyWorkBillingSummary } from "@/lib/my-work-billing";
import type { OfficeHubSummary } from "@/lib/office-hub/summary";
import { tasksHref } from "@/lib/tasks-routes";

export type MyWorkHubItem = {
  id: string;
  label: string;
  href: string;
};

export function buildMyWorkHubItems(options: {
  summary: OfficeHubSummary;
  billing?: MyWorkBillingSummary | null;
  billingAccess: boolean;
  }): MyWorkHubItem[] {
  const { summary, billing, billingAccess = false } = options;
  const items: MyWorkHubItem[] = [];
  const tasks = summary.tasks;

  if (tasks?.overdueOpen) {
    items.push({
      id: "tasks-overdue",
      label: `${tasks.overdueOpen} overdue task${tasks.overdueOpen === 1 ? "" : "s"}`,
      href: tasksHref({ tab: "today", q: "overdue" })
    });
  }
  if (tasks?.tasksDueToday) {
    items.push({
      id: "tasks-today",
      label: `${tasks.tasksDueToday} task${tasks.tasksDueToday === 1 ? "" : "s"} due today`,
      href: tasksHref({ tab: "today" })
    });
  }
  if (tasks?.eventsToday) {
    items.push({
      id: "events-today",
      label: `${tasks.eventsToday} hearing${tasks.eventsToday === 1 ? "" : "s"} today`,
      href: tasksHref({ tab: "today" })
    });
  }

  if (billingAccess && billing) {
    if (billing.overdueCount) {
      items.push({
        id: "billing-overdue",
        label: `${billing.overdueCount} overdue client${billing.overdueCount === 1 ? "" : "s"}`,
        href: billingHref({ page: "home" })
      });
    }
    if (billing.pendingArCount) {
      items.push({
        id: "billing-ar",
        label: `${billing.pendingArCount} payment${billing.pendingArCount === 1 ? "" : "s"} need AR`,
        href: billingHref({ page: "documents", docTab: "ar" })
      });
    }
    if (billing.followUpCount) {
      items.push({
        id: "billing-followup",
        label: `${billing.followUpCount} collection follow-up${billing.followUpCount === 1 ? "" : "s"}`,
        href: billingHref({ page: "home" })
      });
    }
  } else if (billingAccess && summary.billingOverdueClients) {
    items.push({
      id: "billing-overdue-fallback",
      label: `${summary.billingOverdueClients} overdue client${summary.billingOverdueClients === 1 ? "" : "s"}`,
      href: billingHref({ page: "home" })
    });
  }

  return items;
}
