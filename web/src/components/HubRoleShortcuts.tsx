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
      { label: "Log walk-in", href: billingHref({ page: "walkIns" }), description: "Same-day visit" },
      { label: "SOA / AR", href: billingHref({ page: "documents" }), description: "Statements & receipts" },
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Today's queue" },
      { label: "Draft letter", href: tasksHref({ tab: "correspondence" }), description: "Firm correspondence" }
    );
  } else if (isAdmin) {
    shortcuts.push(
      { label: "Overview", href: billingHref({ page: "home" }), description: "Firm snapshot & batch SOA" },
      { label: "Today's hearings", href: tasksHref({ tab: "today" }), description: "Court & prep" },
      { label: "Calendar", href: tasksHref({ tab: "calendar" }), description: "Month view" },
      { label: "Reports", href: billingHref({ page: "reports" }), description: "AR aging & exports" }
    );
  } else if (billingAccess) {
    shortcuts.push(
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Tasks & hearings" },
      { label: "Post billing", href: billingHref({ page: "billing" }), description: "Charges & payments" },
      { label: "Clients", href: billingHref({ page: "clients" }), description: "Open a matter" },
      { label: "Calendar", href: tasksHref({ tab: "calendar" }), description: "Schedule" }
    );
  } else {
    shortcuts.push(
      { label: "My work", href: tasksHref({ tab: "today" }), description: "Today's queue" },
      { label: "Add task", href: tasksHref({ tab: "add-task" }), description: "Quick add" },
      { label: "Calendar", href: tasksHref({ tab: "calendar" }), description: "Month view" }
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
