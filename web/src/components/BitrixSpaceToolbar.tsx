"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import {
  resolveActiveSpaceNav,
  spaceCreateAction,
  spaceCreateMenu,
  spaceInviteHref,
  spaceNavCatalog,
  spaceTeamHref
} from "@/lib/space-nav";
import { tasksHref } from "@/lib/tasks-routes";

type Props = {
  sectionTitle?: string;
  sectionTabs?: ReactNode;
  messagesSlot?: ReactNode;
  notificationsSlot?: ReactNode;
  profileSlot?: ReactNode;
  themeSlot?: ReactNode;
  /** When true, Invite lives only in the topnav. */
  hideInvite?: boolean;
  billingAccess?: boolean;
  isAdmin?: boolean;
  /** Controlled Find query (Tasks desk). */
  findValue?: string;
  onFindChange?: (query: string) => void;
  onFindSubmit?: (query: string) => void;
};

/**
 * Bitrix Space content header — single title + Find field + Create, collaboration, section tabs.
 */
export function BitrixSpaceToolbar({
  sectionTitle,
  sectionTabs,
  messagesSlot,
  notificationsSlot,
  profileSlot,
  themeSlot,
  hideInvite = false,
  billingAccess = true,
  isAdmin = false,
  findValue,
  onFindChange,
  onFindSubmit
}: Props) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = resolveActiveSpaceNav(pathname, searchParams?.toString() || "");
  const catalog = spaceNavCatalog({ billingAccess });
  const active = catalog.find((i) => i.id === activeId);
  const title =
    sectionTitle ||
    (activeId === "tasks"
      ? "My tasks"
      : activeId === "start"
        ? "Feed"
        : activeId === "calendar"
          ? "Calendar"
          : activeId === "communications"
            ? "Communications"
            : activeId === "drive"
              ? "Drive"
              : activeId === "messenger"
                ? "Messenger"
                : activeId === "administration"
                  ? "Administration"
                  : activeId === "crm"
                    ? "Client Directory"
                    : activeId === "settings"
                      ? "Settings"
                      : active?.label || "Workspace");
  const create = spaceCreateAction(activeId, { billingAccess });
  const createMenu = spaceCreateMenu(activeId, { billingAccess, isAdmin });
  const inviteHref = spaceInviteHref();
  const teamHref = spaceTeamHref();
  const settingsHref = (() => {
    const base = tasksHref({ tab: "tools" });
    return `${base}${base.includes("?") ? "&" : "?"}panel=integrations`;
  })();
  const findHref = tasksHref({ tab: "all-items" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [localFind, setLocalFind] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const findId = useId();
  const findQuery = findValue !== undefined ? findValue : localFind;
  const showFind = activeId === "tasks" || activeId === "start" || activeId === "calendar";

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function setFindQuery(next: string) {
    if (findValue !== undefined) onFindChange?.(next);
    else setLocalFind(next);
  }

  function submitFind(event: FormEvent) {
    event.preventDefault();
    const q = findQuery.trim();
    if (onFindSubmit) {
      onFindSubmit(q);
      return;
    }
    const href = q ? `${findHref}${findHref.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}` : findHref;
    router.push(href);
  }

  return (
    <div className="bitrix-space-toolbar no-print">
      <div className="bitrix-space-toolbar__row">
        <div className="bitrix-space-toolbar__heading">
          <div className="bitrix-space-toolbar__left">
            <h2 className="bitrix-space-toolbar__title">{title}</h2>
          </div>

          {showFind ? (
            <form className="bitrix-space-toolbar__find" onSubmit={submitFind} role="search">
              <label className="sr-only" htmlFor={findId}>
                Find item
              </label>
              <span className="bitrix-space-toolbar__find-icon" aria-hidden>
                ⌕
              </span>
              <input
                id={findId}
                type="search"
                className="bitrix-space-toolbar__find-input"
                placeholder="Find item…"
                value={findQuery}
                onChange={(event) => setFindQuery(event.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>
          ) : null}

          <div className={`bitrix-space-create${menuOpen ? " bitrix-space-create--open" : ""}`} ref={menuRef}>
            {createMenu.length > 1 ? (
              <>
                <SameWindowLink href={create.href} className="bitrix-space-btn bitrix-space-btn--create">
                  <span className="bitrix-space-btn__plus" aria-hidden>
                    +
                  </span>
                  <span className="bitrix-space-btn__label">{create.label}</span>
                </SameWindowLink>
                <button
                  type="button"
                  className="bitrix-space-btn bitrix-space-btn--create bitrix-space-create__caret"
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  aria-label="Create options"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  ▾
                </button>
                {menuOpen ? (
                  <div id={menuId} className="bitrix-space-create__menu" role="menu">
                    {createMenu.map((item) => (
                      <SameWindowLink
                        key={item.href}
                        href={item.href}
                        className="bitrix-space-create__option"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </SameWindowLink>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <SameWindowLink href={create.href} className="bitrix-space-btn bitrix-space-btn--create">
                <span className="bitrix-space-btn__plus" aria-hidden>
                  +
                </span>
                <span className="bitrix-space-btn__label">{create.label}</span>
              </SameWindowLink>
            )}
          </div>
        </div>

        <div className="bitrix-space-toolbar__actions">
          {!hideInvite ? (
            <SameWindowLink href={inviteHref} className="bitrix-space-btn bitrix-space-btn--ghost">
              Invite
            </SameWindowLink>
          ) : null}
          <SameWindowLink href={teamHref} className="bitrix-space-btn bitrix-space-btn--ghost">
            Collaboration
          </SameWindowLink>
          <SameWindowLink href={settingsHref} className="bitrix-space-btn bitrix-space-btn--ghost">
            Settings
          </SameWindowLink>
          {messagesSlot}
          {notificationsSlot}
          {themeSlot}
          {profileSlot}
        </div>
      </div>
      {sectionTabs ? <div className="bitrix-space-toolbar__tabs">{sectionTabs}</div> : null}
    </div>
  );
}