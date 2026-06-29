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
      { label: BILLING_PAGE_LABELS.walkIns, href: billingHref({ page: "walkIns" }), description: "Today's office visitor" },
      { label: BILLING_PAGE_LABELS.documents, href: billingHref({ page: "documents" }), description: "Print statement or AR" },
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Today's task list" },
      { label: TASKS_TAB_LABELS.correspondence, href: tasksHref({ tab: "correspondence" }), description: "Firm letterhead" }
    );
  } else if (isAdmin) {
    shortcuts.push(
      { label: BILLING_PAGE_LABELS.home, href: billingHref({ page: "home" }), description: "Balances & collections" },
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Today's hearings & tasks" },
      { label: TASKS_TAB_LABELS.calendar, href: tasksHref({ tab: "calendar" }), description: "Month schedule" },
      { label: BILLING_PAGE_LABELS.reports, href: billingHref({ page: "reports" }), description: "Who owes & exports" }
    );
  } else if (billingAccess) {
    shortcuts.push(
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Today's task list" },
      { label: BILLING_PAGE_LABELS.billing, href: billingHref({ page: "billing" }), description: "Record fee or payment" },
      { label: BILLING_PAGE_LABELS.clients, href: billingHref({ page: "clients" }), description: "Open billing file" },
      { label: TASKS_TAB_LABELS.calendar, href: tasksHref({ tab: "calendar" }), description: "Month schedule" }
    );
  } else {
    shortcuts.push(
      { label: TASKS_TAB_LABELS.today, href: tasksHref({ tab: "today" }), description: "Today's task list" },
      { label: TASKS_TAB_LABELS["add-task"], href: tasksHref({ tab: "add-task" }), description: "Log new work" },
      { label: TASKS_TAB_LABELS.calendar, href: tasksHref({ tab: "calendar" }), description: "Month schedule" }
    );
  }

  if (!shortcuts.length) return null;

  return (
    <section className="hub-role-shortcuts firm-auth-animate firm-auth-animate--2" aria-label="Quick shortcuts for your role">
      <p className="hub-role-shortcuts__label">Quick start</p>
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
