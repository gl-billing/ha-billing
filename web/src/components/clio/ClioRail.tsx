"use client";

import { useId } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import {
  buildClioHref,
  clioPrimariesForUser,
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

function hrefAppPath(href: string, billingPath: string, tasksPath: string): string {
  if (href.startsWith(tasksPath)) return tasksPath;
  if (href.startsWith(billingPath)) return billingPath;
  return href.split("?")[0] || href;
}

/** Clio-style primary left rail — HA layout (monochrome theme unchanged). */
export function ClioRail({
  activeNav,
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
  const primaries = clioPrimariesForUser(visibility);
  const activeMeta = primaries.find((item) => item.id === activeNav) || findClioPrimary(activeNav);
  const pathOpts = { billingPath, tasksPath };
  const selectValue = primaries.some((item) => item.id === activeNav)
    ? activeNav
    : primaries[0]?.id || activeNav;

  function navigateClio(href: string) {
    const targetPath = hrefAppPath(href, billingPath, tasksPath);
    const here = pathname.split("?")[0] || "";
    if (here !== targetPath) {
      window.location.assign(href);
      return;
    }
    router.push(href);
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
          const primary = findClioPrimary(next);
          const section = defaultClioSectionForUser(primary, visibility);
          navigateClio(buildClioHref(next, section.id, pathOpts));
        }}
      >
        {primaries.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <div className="ha-clio-rail__primary">
        <p className="ha-clio-rail__eyebrow">Office</p>
        <ul className="ha-clio-rail__list">
          {primaries.map((item) => {
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

      {activeMeta?.description ? (
        <p className="ha-clio-rail__hint" id={hintId}>
          {activeMeta.description}
        </p>
      ) : null}
    </nav>
  );
}
