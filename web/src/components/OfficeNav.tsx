"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { SameWindowLink } from "@/components/SameWindowLink";
import { firmAppHref } from "@/lib/firm-apps";

const OFFICE_LINKS = [
  {
    href: firmAppHref("/app"),
    label: "Schedule",
    description: "Hearings, deadlines, and assignments.",
    match: "/app",
    billingOnly: false
  },
  {
    href: "/billing",
    label: "Accounts",
    description: "Client files, entries, and statements.",
    match: "/billing",
    billingOnly: true
  }
] as const;

export function OfficeNav() {
  const pathname = usePathname() || "";
  const { data: session } = useSession();
  const billingAccess = session?.user?.billingAccess !== false;

  const links = OFFICE_LINKS.filter((link) => billingAccess || !link.billingOnly);

  return (
    <div className="office-nav-wrap">
      <nav className="office-nav office-nav--lines no-print" aria-label="Workspaces">
        <div className="office-nav__track">
        {links.map(({ href, label, description, match }) => {
          const isMatter = pathname.startsWith("/matter");
          const active =
            pathname === match ||
            pathname.startsWith(`${match}/`) ||
            (isMatter && match === "/app");
          return (
            <SameWindowLink
              key={match}
              href={href}
              className={`office-nav__link ${active ? "office-nav__link--active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={description}
            >
              {label}
            </SameWindowLink>
          );
        })}
        </div>
      </nav>
    </div>
  );
}
