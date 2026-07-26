"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { billingHref } from "@/lib/billing-routes";
import { tasksHref } from "@/lib/tasks-routes";

type Props = {
  billingAccess?: boolean;
  isAdmin?: boolean;
};

function withSpace(href: string, space: string): string {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}space=${space}`;
}

type MoreGroup = { label: string; links: { href: string; label: string }[] };

/**
 * Space mobile bottom nav — core desks + grouped More sheet.
 */
export function MobileSpaceDeskNav({ billingAccess = true, isAdmin = false }: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const path = pathname.split("?")[0] || "";
  const tasksBase = "/app";
  const onTasks = path === tasksBase || path.startsWith(`${tasksBase}/`);
  const onBilling = path.includes("/billing");
  const onHub = path.includes("/office-hub") || path.includes("/hub");
  const space = searchParams?.get("space") || "";
  const tab = searchParams?.get("tab") || "";
  const page = searchParams?.get("page") || "";
  const cal = searchParams?.get("cal") || "";
  const toolsHref = tasksHref({ tab: "tools" });

  const feedHref = tasksHref({ tab: "desk-checklist" });
  const tasksHrefList = tasksHref({ tab: "all-items" });
  const messengerHref = withSpace(tasksHref({ tab: "today" }), "messenger");
  const calendarHref = (() => {
    const base = tasksHref({ tab: "week" });
    return `${base}${base.includes("?") ? "&" : "?"}cal=day`;
  })();

  const items = [
    {
      href: feedHref,
      label: "Feed",
      active:
        onTasks &&
        !space &&
        (tab === "desk-checklist" || tab === "today" || tab === "history" || !tab)
    },
    {
      href: tasksHrefList,
      label: "Tasks",
      active: onTasks && !space && (tab === "all-items" || tab === "add-task" || tab === "add-event")
    },
    {
      href: messengerHref,
      label: "Chat",
      active: onTasks && space === "messenger"
    },
    {
      href: calendarHref,
      label: "Cal",
      active:
        onTasks &&
        !space &&
        (tab === "week" || tab === "calendar" || cal === "day" || cal === "week" || cal === "schedule")
    }
  ] as const;

  const filingBase = tasksHref({ tab: "filing" });
  const filingJoin = filingBase.includes("?") ? "&" : "?";
  const communicationsHref = withSpace(tasksHref({ tab: "correspondence" }), "communications");
  const driveHref = withSpace(billingHref({ page: "documents" }), "drive");
  const settingsHref = `${toolsHref}${toolsHref.includes("?") ? "&" : "?"}panel=integrations`;
  const moreGroups: MoreGroup[] = [
    {
      label: "Workspace",
      links: [
        { href: "/office-hub", label: "Office Hub" },
        { href: tasksHref({ tab: "team" }), label: "Collaboration" },
        ...(billingAccess
          ? [
              { href: billingHref({ page: "clients" }), label: "Clients" },
              { href: billingHref({ page: "walkIns" }), label: "Booking" },
              { href: driveHref, label: "Drive" }
            ]
          : []),
        { href: communicationsHref, label: "Communications" },
        { href: toolsHref, label: "Administration" },
        { href: settingsHref, label: "Settings" }
      ]
    },
    {
      label: "Desk",
      links: [
        { href: `${filingBase}${filingJoin}filingQueue=e-filing`, label: "E-filing" },
        { href: `${filingBase}${filingJoin}filingQueue=physical`, label: "Physical filing" },
        {
          href: withSpace(tasksHref({ tab: "today" }), "communications") + "&panel=client-messaging",
          label: "Message clients"
        },
        { href: tasksHref({ tab: "templates" }), label: "Templates" },
        { href: withSpace(tasksHref({ tab: "today" }), "notifications"), label: "Notifications" }
      ]
    },
    {
      label: "Clients & accounts",
      links: [
        ...(billingAccess
          ? [
              { href: billingHref({ page: "newClient" }), label: "Client intake" },
              { href: billingHref({ page: "walkIns" }), label: "Add walk-in" },
              { href: billingHref({ page: "spotBilling" }), label: "Add spot billing" },
              { href: billingHref({ page: "notarizations" }), label: "Notarizations" },
              { href: billingHref({ page: "billing" }), label: "Billing" },
              { href: billingHref({ page: "documents" }), label: "SOA & Receipts" },
              { href: billingHref({ page: "history" }), label: "History" },
              { href: billingHref({ page: "home" }), label: "Firm dashboard" },
              { href: billingHref({ page: "reports" }), label: "Reports" }
            ]
          : [])
      ]
    },
    {
      label: "Admin",
      links: [
        ...(isAdmin
          ? [
              { href: withSpace(toolsHref, "staff"), label: "Staff" },
              { href: tasksHref({ tab: "presence" }), label: "Staff attendance" },
              { href: billingHref({ page: "staffSalary" }), label: "Payroll" }
            ]
          : [])
      ]
    }
  ]
    .map((group) => ({ ...group, links: group.links.filter(Boolean) }))
    .filter((group) => group.links.length > 0);

  const moreActive =
    onBilling ||
    onHub ||
    (onTasks &&
      (space === "staff" ||
        space === "drive" ||
        space === "communications" ||
        space === "notifications" ||
        tab === "filing" ||
        tab === "correspondence" ||
        tab === "templates" ||
        tab === "team" ||
        tab === "tools" ||
        tab === "presence" ||
        page === "documents"));

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className="mobile-space-desk-nav__sheet-backdrop"
          aria-label="Close more menu"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}
      <nav
        className="mobile-clio-desk-nav mobile-space-desk-nav no-print"
        aria-label="Space quick navigation"
        style={{ gridTemplateColumns: `repeat(${items.length + 2}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-clio-desk-nav__link${item.active ? " mobile-clio-desk-nav__link--active" : ""}`}
            aria-current={item.active ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-clio-desk-nav__link${moreActive || moreOpen ? " mobile-clio-desk-nav__link--active" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          More
        </button>
        <button
          type="button"
          className="mobile-clio-desk-nav__search"
          onClick={() => window.dispatchEvent(new CustomEvent("gl-open-command-palette"))}
        >
          Search
        </button>
      </nav>
      {moreOpen ? (
        <div className="mobile-space-desk-nav__sheet" role="dialog" aria-label="More desks">
          <div className="mobile-space-desk-nav__sheet-head">
            <p className="mobile-space-desk-nav__sheet-title">More</p>
            <button type="button" className="mobile-space-desk-nav__sheet-close" onClick={() => setMoreOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          {moreGroups.map((group) => (
            <div key={group.label} className="mobile-space-desk-nav__sheet-group">
              <p className="mobile-space-desk-nav__sheet-label">{group.label}</p>
              <div className="mobile-space-desk-nav__sheet-links">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="mobile-space-desk-nav__sheet-item"
                    onClick={() => setMoreOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
