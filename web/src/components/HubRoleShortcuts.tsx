"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import { billingHref } from "@/lib/billing-routes";
import { firmAppHref } from "@/lib/firm-apps";
import { tasksHref } from "@/lib/tasks-routes";

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
      { label: "Log walk-in", href: billingHref({ page: "walkIns" }), description: "Today's office visitor" },
      { label: "SOA / receipt", href: billingHref({ page: "documents" }), description: "Print statement or AR" },
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Today's task list" },
      { label: "Write letter", href: tasksHref({ tab: "correspondence" }), description: "Firm letterhead" }
    );
  } else if (isAdmin) {
    shortcuts.push(
      { label: "Overview", href: billingHref({ page: "home" }), description: "Balances & collections" },
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Today's hearings & tasks" },
      { label: "Calendar", href: tasksHref({ tab: "calendar" }), description: "Month schedule" },
      { label: "Reports", href: billingHref({ page: "reports" }), description: "Who owes & exports" }
    );
  } else if (billingAccess) {
    shortcuts.push(
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Today's task list" },
      { label: "Charges & pay", href: billingHref({ page: "billing" }), description: "Record fee or payment" },
      { label: "Find client", href: billingHref({ page: "clients" }), description: "Open billing file" },
      { label: "Calendar", href: tasksHref({ tab: "calendar" }), description: "Month schedule" }
    );
  } else {
    shortcuts.push(
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Today's task list" },
      { label: "Add task", href: tasksHref({ tab: "add-task" }), description: "Log new work" },
      { label: "Calendar", href: tasksHref({ tab: "calendar" }), description: "Month schedule" }
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
