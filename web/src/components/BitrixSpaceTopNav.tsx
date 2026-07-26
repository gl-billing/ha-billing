"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { resolveActiveSpaceNav, spaceTopContextTabs } from "@/lib/space-nav";
import { firmLogoOnDarkPublicUrl } from "@/lib/firm-logo-url";
import type { NavUserProfile } from "@/lib/workspace-labels";

type Props = {
  billingAccess?: boolean;
  isAdmin?: boolean;
  navProfile?: NavUserProfile;
  searchSlot?: ReactNode;
  utilitiesSlot?: ReactNode;
  inviteHref?: string;
  /** Used for logo alt text. */
  firmName?: string;
};

/**
 * Bitrix-style top strip — single cool-black bar, edge-to-edge.
 * White logo mark flush on the black banner; search + actions on the right.
 */
export function BitrixSpaceTopNav({
  billingAccess = true,
  isAdmin = false,
  navProfile = "full",
  searchSlot,
  utilitiesSlot,
  inviteHref,
  firmName
}: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const activeId = resolveActiveSpaceNav(pathname, searchParams?.toString() || "");
  const visibility = {
    billingAccess,
    isAdmin,
    navProfile
  };
  // Module switching lives on the left rail / mobile bottom nav — no dual top strip.
  const modules = spaceTopContextTabs(activeId, visibility);
  const logoAlt = firmName?.trim() || "Hernandez & Associates";

  return (
    <header className="bitrix-space-topnav no-print">
      <SameWindowLink
        href="/office-hub"
        className="bitrix-space-topnav__brand-link"
        aria-label={`${logoAlt} — Office Hub`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={firmLogoOnDarkPublicUrl()}
          alt=""
          className="bitrix-space-topnav__logo"
          width={448}
          height={170}
          aria-hidden="true"
        />
      </SameWindowLink>

      {modules.length ? (
        <nav className="bitrix-space-topnav__modules" aria-label="Space module sections">
          {modules.map((item) => {
            const active = item.id === activeId;
            return (
              <SameWindowLink
                key={item.id}
                href={item.href}
                className={`bitrix-space-topnav__link${active ? " bitrix-space-topnav__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </SameWindowLink>
            );
          })}
        </nav>
      ) : (
        <div className="bitrix-space-topnav__void" aria-hidden />
      )}

      <div className="bitrix-space-topnav__search">{searchSlot}</div>

      <div className="bitrix-space-topnav__actions">
        {inviteHref ? (
          <SameWindowLink
            href={inviteHref}
            className="bitrix-space-btn bitrix-space-btn--invite bitrix-space-btn--desktop"
          >
            Invite
          </SameWindowLink>
        ) : null}
        {utilitiesSlot}
      </div>
    </header>
  );
}
