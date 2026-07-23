"use client";

import { useId } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { navigateClioHref } from "@/lib/clio/navigate-clio";
import { sectionForPrimarySwitch } from "@/lib/clio/section-for-primary";
import {
  buildClioHref,
  clioRailGroupsForUser,
  defaultClioSectionForUser,
  findClioPrimary,
  HA_BILLING_PATH,
  HA_TASKS_PATH,
  type ClioNavId,
  type ClioVisibilityOptions
} from "@/lib/clio/workspace-nav";
import type { NavUserProfile } from "@/lib/workspace-labels";

type Props = {
  activeNav: ClioNavId;
  activeSection?: string;
  billingPath?: string;
  tasksPath?: string;
  isAdmin?: boolean;
  billingAccess?: boolean;
  navProfile?: NavUserProfile;
  email?: string | null;
  canManageTeamRoster?: boolean;
  canViewLiaisonTab?: boolean;
  canViewPresenceTab?: boolean;
};

/** Clio-style primary left rail — grouped by function (Work / Clients / Accounts / Firm). */
export function ClioRail({
  activeNav,
  activeSection = "",
  billingPath = HA_BILLING_PATH,
  tasksPath = HA_TASKS_PATH,
  isAdmin = false,
  billingAccess = true,
  navProfile = "full",
  email = null,
  canManageTeamRoster = false,
  canViewLiaisonTab = false,
  canViewPresenceTab = false
}: Props) {
  const hintId = useId();
  const pathname = usePathname() || "";
  const router = useRouter();
  const visibility: ClioVisibilityOptions = {
    billingAccess,
    navProfile,
    isAdmin,
    email,
    canManageTeamRoster,
    canViewLiaisonTab,
    canViewPresenceTab
  };
  const groups = clioRailGroupsForUser(visibility);
  const primaries = groups.flatMap((group) => group.primaries);
  const activeMeta = primaries.find((item) => item.id === activeNav) || findClioPrimary(activeNav);
  const pathOpts = { billingPath, tasksPath };
  const selectValue = primaries.some((item) => item.id === activeNav)
    ? activeNav
    : primaries[0]?.id || activeNav;

  function navigateClio(href: string) {
    navigateClioHref(href, {
      pathname,
      billingPath,
      tasksPath,
      push: (next) => router.push(next)
    });
  }

  function sectionForPrimary(next: ClioNavId) {
    if (activeSection) {
      return sectionForPrimarySwitch(next, activeNav, activeSection, visibility);
    }
    const primary = findClioPrimary(next);
    return defaultClioSectionForUser(primary, visibility);
  }

  return (
    <nav className="ha-clio-rail" aria-label="Firm workspace">
      <label className="ha-clio-rail__mobile-label" htmlFor={`${hintId}-primary`}>
        Workspace
      </label>
      <select
        id={`${hintId}-primary`}
        className="ha-clio-rail__mobile-select"
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value as ClioNavId;
          const section = sectionForPrimary(next);
          navigateClio(buildClioHref(next, section.id, pathOpts));
        }}
      >
        {groups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.primaries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="ha-clio-rail__primary">
        {groups.map((group) => (
          <div key={group.id} className="ha-clio-rail__group">
            <p className="ha-clio-rail__eyebrow">{group.label}</p>
            <ul className="ha-clio-rail__list">
              {group.primaries.map((item) => {
                const active = item.id === activeNav;
                const section = defaultClioSectionForUser(item, visibility);
                const href = buildClioHref(item.id, section.id, pathOpts);
                return (
                  <li key={item.id}>
                    <SameWindowLink
                      href={href}
                      className={`ha-clio-rail__item${active ? " ha-clio-rail__item--active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateClio(href);
                      }}
                    >
                      {item.label}
                    </SameWindowLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {activeMeta?.description ? (
        <p className="ha-clio-rail__hint" id={hintId}>
          {activeMeta.description}
        </p>
      ) : null}
    </nav>
  );
}
