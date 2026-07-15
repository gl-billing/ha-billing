"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import { billingHref } from "@/lib/billing-routes";
import { firmAppHref } from "@/lib/firm-apps";
import { tasksHref } from "@/lib/tasks-routes";
import { BILLING_PAGE_LABELS, TASKS_TAB_LABELS } from "@/lib/workspace-labels";

type Props = {
  billingAccess: boolean;
  isAdmin: boolean;
  secretaryNav: boolean;
};

type Shortcut = { label: string; href: string; description: string };

export function HubRoleShortcuts({ billingAccess, isAdmin, secretaryNav = false }: Props) {
  const shortcuts: Shortcut[] = [];

  if (secretaryNav) {
    shortcuts.push(
      { label: BILLING_PAGE_LABELS.walkIns, href: billingHref({ page: "walkIns" }), description: "Walk-in log" },
      { label: BILLING_PAGE_LABELS.documents, href: billingHref({ page: "documents" }), description: "Statements & receipts" },
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Assigned work today" },
      { label: TASKS_TAB_LABELS.correspondence, href: tasksHref({ tab: "correspondence" }), description: "Firm correspondence" }
    );
  } else if (isAdmin) {
    shortcuts.push(
      { label: BILLING_PAGE_LABELS.home, href: billingHref({ page: "home" }), description: "Balances & collections" },
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Hearings & assigned work" },
      { label: TASKS_TAB_LABELS.calendar, href: tasksHref({ tab: "calendar" }), description: "Month calendar" },
      { label: BILLING_PAGE_LABELS.reports, href: billingHref({ page: "reports" }), description: "Aging & exports" }
    );
  } else if (billingAccess) {
    shortcuts.push(
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Assigned work today" },
      { label: BILLING_PAGE_LABELS.billing, href: billingHref({ page: "billing" }), description: "Post fee or payment" },
      { label: BILLING_PAGE_LABELS.clients, href: billingHref({ page: "clients" }), description: "Open matter file" },
      { label: TASKS_TAB_LABELS.calendar, href: tasksHref({ tab: "calendar" }), description: "Month calendar" }
    );
  } else {
    shortcuts.push(
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Assigned work today" },
      { label: TASKS_TAB_LABELS["add-task"], href: tasksHref({ tab: "add-task" }), description: "Create a task" },
      { label: TASKS_TAB_LABELS.calendar, href: tasksHref({ tab: "calendar" }), description: "Month calendar" }
    );
  }

  if (!shortcuts.length) return null;

  return (
    <section className="hub-role-shortcuts firm-auth-animate firm-auth-animate--2" aria-label="Office shortcuts">
      <p className="hub-role-shortcuts__label">Shortcuts</p>
      <div className="hub-role-shortcuts__grid">
        {shortcuts.map((shortcut) => (
          <SameWindowLink key={shortcut.href + shortcut.label} href={shortcut.href} className="hub-role-shortcuts__card">
            <span className="hub-role-shortcuts__card-title">{shortcut.label}</span>
            <span className="hub-role-shortcuts__card-desc">{shortcut.description}</span>
          </SameWindowLink>
        ))}
      </div>
    </section>
  );
}
