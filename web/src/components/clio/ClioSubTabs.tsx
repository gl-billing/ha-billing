"use client";

import { usePathname, useRouter } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { navigateClioHref } from "@/lib/clio/navigate-clio";
import {
  buildClioHref,
  clioSectionsForUser,
  findClioPrimary,
  HA_BILLING_PATH,
  HA_TASKS_PATH,
  type ClioNavId,
  type ClioVisibilityOptions
} from "@/lib/clio/workspace-nav";
import type { NavUserProfile } from "@/lib/workspace-labels";

type Props = {
  activeNav: ClioNavId;
  activeSection: string;
  isAdmin?: boolean;
  billingAccess?: boolean;
  navProfile?: NavUserProfile;
  email?: string | null;
  canManageTeamRoster?: boolean;
  canViewLiaisonTab?: boolean;
  canViewPresenceTab?: boolean;
  billingPath?: string;
  tasksPath?: string;
};

/** Horizontal secondary sections for the active Clio primary — above firm search. */
export function ClioSubTabs({
  activeNav,
  activeSection,
  isAdmin = false,
  billingAccess = true,
  navProfile = "full",
  email = null,
  canManageTeamRoster = false,
  canViewLiaisonTab = false,
  canViewPresenceTab = false,
  billingPath = HA_BILLING_PATH,
  tasksPath = HA_TASKS_PATH
}: Props) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const primary = findClioPrimary(activeNav);
  const visibility: ClioVisibilityOptions = {
    billingAccess,
    navProfile,
    isAdmin,
    email,
    canManageTeamRoster,
    canViewLiaisonTab,
    canViewPresenceTab
  };
  const sections = clioSectionsForUser(primary, visibility);
  const pathOpts = { billingPath, tasksPath };

  if (sections.length <= 1) return null;

  function navigateClio(href: string) {
    navigateClioHref(href, {
      pathname,
      billingPath,
      tasksPath,
      push: (next) => router.push(next)
    });
  }

  return (
    <nav className="ha-clio-subtabs" aria-label={`${primary.label} sections`}>
      <p className="ha-clio-subtabs__eyebrow">{primary.label}</p>
      <ul className="ha-clio-subtabs__list">
        {sections.map((section) => {
          const active = section.id === activeSection;
          const href = buildClioHref(activeNav, section.id, pathOpts);
          return (
            <li key={section.id} className="ha-clio-subtabs__item-wrap">
              <SameWindowLink
                href={href}
                className={`ha-clio-subtabs__item${active ? " ha-clio-subtabs__item--active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={section.description}
                onClick={(event) => {
                  event.preventDefault();
                  navigateClio(href);
                }}
              >
                {section.label}
              </SameWindowLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
