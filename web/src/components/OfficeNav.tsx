"use client";

import { usePathname } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { firmAppHref } from "@/lib/firm-apps";
import { buildClioHref } from "@/lib/clio/workspace-nav";

/** Legacy dual Schedule/Accounts nav — unused in Clio shell; kept as single desk entry if remounted. */
export function OfficeNav() {
  const pathname = usePathname() || "";
  const href = buildClioHref("checklist", "today") || firmAppHref("/app");
  const active =
    pathname.startsWith("/app") || pathname.startsWith("/billing") || pathname.startsWith("/matter");

  return (
    <div className="office-nav-wrap">
      <nav className="office-nav office-nav--lines no-print" aria-label="Firm desk">
        <div className="office-nav__track">
          <SameWindowLink
            href={href}
            className={`office-nav__link ${active ? "office-nav__link--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            Desk
          </SameWindowLink>
        </div>
      </nav>
    </div>
  );
}
