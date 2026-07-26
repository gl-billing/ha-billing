"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import {
  resolveActiveSpaceNav,
  spaceNavItemsForUser,
  type SpaceNavId
} from "@/lib/space-nav";
import type { NavUserProfile } from "@/lib/workspace-labels";

type Props = {
  billingAccess?: boolean;
  isAdmin?: boolean;
  navProfile?: NavUserProfile;
  /** Kept for callers; unused in brand chrome (text mark). */
  firmName?: string;
};

const COLLAPSE_KEY = "ha-space-rail-collapsed";
const UNREAD_EVENT = "ha-staff-messages-unread";
/** Shell + layout classes — grid columns must track rail width (CSS alone on the nav was not enough). */
const SHELL_COLLAPSED_CLASS = "firm-space-shell--rail-collapsed";
const LAYOUT_COLLAPSED_CLASS = "trial-firm-layout--rail-collapsed";

function RailIcon({ id }: { id: SpaceNavId }) {
  const common = { viewBox: "0 0 24 24", "aria-hidden": true as const };
  const paths: Record<SpaceNavId, ReactNode> = {
    start: <path d="M4 6.5h16M4 12h10M4 17.5h14" />,
    messenger: (
      <>
        <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="2.5" />
        <circle cx="16" cy="9" r="2" />
        <path d="M4.5 18c.7-2.8 2.6-4.2 5-4.2s4.3 1.4 5 4.2M14 18c.4-1.6 1.4-2.5 3-2.5s2.4.8 2.8 2.2" />
      </>
    ),
    tasks: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </>
    ),
    crm: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5S13.7 16 14.5 19" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M15 19c.4-1.8 1.5-2.8 3.2-2.8" />
      </>
    ),
    accounts: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 12.5h5M8 16h3" />
      </>
    ),
    booking: (
      <>
        <path d="M8 7V5.5M16 7V5.5" />
        <rect x="4" y="7" width="16" height="13" rx="2" />
        <path d="M4 11h16" />
      </>
    ),
    filing: <path d="M4 8.5 7 5h5l2 2h6v12.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 19.5V10" />,
    templates: (
      <>
        <path d="M7 4.5h7l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-8.5A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5z" />
        <path d="M14 4.5V8h3.5M8.5 12h7M8.5 15.5h5" />
      </>
    ),
    drive: (
      <>
        <path d="M4 16.5 8.5 7h7L20 16.5" />
        <path d="M7 16.5h10" />
      </>
    ),
    communications: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="m4 8 8 5 8-5" />
      </>
    ),
    reports: <path d="M5 19V10M10 19V6M15 19v-7M20 19V8" />,
    notifications: (
      <>
        <path d="M6 16h12l-1.2-2.2a6 6 0 0 1-.8-3V9a4 4 0 1 0-8 0v1.8c0 1.1-.3 2.1-.8 3z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </>
    ),
    administration: (
      <>
        <path d="M4 20.5h16" />
        <path d="M6 20.5V8.5l6-4 6 4v12" />
        <path d="M10 20.5v-5h4v5" />
        <path d="M9.5 11.5h.01M14.5 11.5h.01M12 14.5h.01" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.8 7.2l1.9 1.1M17.3 15.7l1.9 1.1M4.8 16.8l1.9-1.1M17.3 8.3l1.9-1.1" />
      </>
    )
  };
  return (
    <span className="bitrix-space-rail__icon">
      <svg {...common}>{paths[id]}</svg>
    </span>
  );
}

/**
 * Bitrix Space–style left rail — collaboration + workspace tools.
 */
export function BitrixSpaceRail({
  billingAccess = true,
  isAdmin = false,
  navProfile = "full"
}: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || "";
  const activeId = resolveActiveSpaceNav(pathname, search);

  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const railRef = useRef<HTMLElement | null>(null);

  const { collaboration, workspace, footer, primary } = useMemo(
    () =>
      spaceNavItemsForUser({
        billingAccess,
        navProfile,
        isAdmin
      }),
    [billingAccess, navProfile, isAdmin]
  );

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  /* Keep shell grid column in sync with rail width — parent layout must shrink too.
   * CSS uses !important width locks, so parent styles must also use important priority. */
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const layout = rail.closest(".trial-firm-layout") as HTMLElement | null;
    const shell = rail.closest(".firm-workspace") as HTMLElement | null;
    const navCol = rail.closest(".trial-firm-layout__nav") as HTMLElement | null;
    const width = collapsed ? "4.25rem" : "14rem";

    layout?.classList.toggle(LAYOUT_COLLAPSED_CLASS, collapsed);
    shell?.classList.toggle(SHELL_COLLAPSED_CLASS, collapsed);
    shell?.style.setProperty("--space-rail-width", width);
    layout?.style.setProperty("--space-rail-width", width);
    layout?.style.setProperty("grid-template-columns", `${width} minmax(0, 1fr)`, "important");
    if (navCol) {
      navCol.style.setProperty("width", width, "important");
      navCol.style.setProperty("min-width", width, "important");
      navCol.style.setProperty("max-width", width, "important");
    }

    return () => {
      layout?.classList.remove(LAYOUT_COLLAPSED_CLASS);
      shell?.classList.remove(SHELL_COLLAPSED_CLASS);
      shell?.style.removeProperty("--space-rail-width");
      layout?.style.removeProperty("--space-rail-width");
      layout?.style.removeProperty("grid-template-columns");
      if (navCol) {
        navCol.style.removeProperty("width");
        navCol.style.removeProperty("min-width");
        navCol.style.removeProperty("max-width");
      }
    };
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/staff-messages")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json && typeof json.unreadCount === "number") {
          setUnreadMessages(json.unreadCount);
        }
      })
      .catch(() => undefined);
    function onUnread(event: Event) {
      const detail = (event as CustomEvent<{ unreadCount?: number }>).detail;
      if (typeof detail?.unreadCount === "number") setUnreadMessages(detail.unreadCount);
    }
    window.addEventListener(UNREAD_EVENT, onUnread as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(UNREAD_EVENT, onUnread as EventListener);
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function renderItem(item: (typeof primary)[number], active: boolean) {
    return (
      <li key={item.id}>
        <SameWindowLink
          href={item.href}
          className={`bitrix-space-rail__item${active ? " bitrix-space-rail__item--active" : ""}`}
          aria-current={active ? "page" : undefined}
          title={collapsed ? item.label : item.description}
        >
          <RailIcon id={item.id} />
          {!collapsed ? <span className="bitrix-space-rail__item-label">{item.label}</span> : null}
          {!collapsed && item.id === "messenger" && unreadMessages > 0 ? (
            <span className="bitrix-space-rail__badge" aria-label={`${unreadMessages} unread`}>
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          ) : null}
        </SameWindowLink>
      </li>
    );
  }

  return (
    <nav
      ref={railRef}
      className={`bitrix-space-rail${collapsed ? " bitrix-space-rail--collapsed" : ""}`}
      aria-label="Space workspace"
      data-collapsed={collapsed ? "1" : "0"}
    >
      <div className="bitrix-space-rail__brand">
        <span className="bitrix-space-rail__hub" aria-label="Office Hub">
          <span className="bitrix-space-rail__hub-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3.5 20.5h17" />
              <path d="M5 20.5V9l7-5 7 5v11.5" />
              <path d="M9.5 20.5v-5h5v5" />
              <path d="M9 11h.01M12 11h.01M15 11h.01M9 14.5h.01M15 14.5h.01" />
            </svg>
          </span>
          <span className="bitrix-space-rail__hub-full">OFFICE HUB</span>
          <span className="bitrix-space-rail__hub-short" aria-hidden="true">
            OH
          </span>
        </span>
        <button
          type="button"
          className="bitrix-space-rail__collapse"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleCollapsed();
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <label className="bitrix-space-rail__mobile-label" htmlFor="bitrix-space-rail-select">
        Workspace
      </label>
      <select
        id="bitrix-space-rail-select"
        className="bitrix-space-rail__mobile-select"
        value={activeId}
        onChange={(event) => {
          const id = event.target.value as SpaceNavId;
          const hit = [...primary, ...footer].find((i) => i.id === id);
          if (hit) window.location.assign(hit.href);
        }}
      >
        {[...primary, ...footer].map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      {collaboration.length ? (
        <div className="bitrix-space-rail__group">
          {!collapsed ? <p className="bitrix-space-rail__group-label">Collaboration</p> : null}
          <ul className="bitrix-space-rail__list">
            {collaboration.map((item) => renderItem(item, item.id === activeId))}
          </ul>
        </div>
      ) : null}

      {workspace.length ? (
        <div className="bitrix-space-rail__group">
          {!collapsed ? <p className="bitrix-space-rail__group-label">Workspace</p> : null}
          <ul className="bitrix-space-rail__list">
            {workspace.map((item) => renderItem(item, item.id === activeId))}
          </ul>
        </div>
      ) : null}

      {footer.length ? (
        <ul className="bitrix-space-rail__footer">
          {footer.map((item) => renderItem(item, item.id === activeId))}
        </ul>
      ) : null}
    </nav>
  );
}
