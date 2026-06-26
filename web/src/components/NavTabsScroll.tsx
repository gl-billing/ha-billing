"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { NavTabDef } from "@/lib/workspace-labels";

type Props<T extends string> = {
  tabs: NavTabDef<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  disabled?: boolean;
  splitAdmin?: boolean;
  workspace?: "billing" | "tasks";
  ariaLabel?: string;
};

export function NavTabsScroll<T extends string>({
  tabs,
  activeId,
  onSelect,
  disabled = false,
  splitAdmin = false,
  workspace,
  ariaLabel = "Section navigation"
}: Props<T>) {
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const isFirstScroll = useRef(true);

  const staffTabs = splitAdmin ? tabs.filter((tab) => !tab.adminOnly) : tabs;
  const adminTabs = splitAdmin ? tabs.filter((tab) => tab.adminOnly) : [];

  useLayoutEffect(() => {
    const activeEl = tabRefs.current.get(activeId);
    if (!activeEl) return;

    const behavior = isFirstScroll.current ? "instant" : "smooth";
    isFirstScroll.current = false;
    activeEl.scrollIntoView({ inline: "nearest", block: "nearest", behavior });
  }, [activeId, tabs]);

  function renderTab(tab: NavTabDef<T>): ReactNode {
    return (
      <button
        key={tab.id}
        ref={(node) => {
          if (node) tabRefs.current.set(tab.id, node);
          else tabRefs.current.delete(tab.id);
        }}
        type="button"
        className={`nav-tab inline-flex items-center ${activeId === tab.id ? "active" : ""}`}
        onClick={() => onSelect(tab.id)}
        disabled={disabled}
        title={tab.description}
      >
        {tab.label}
      </button>
    );
  }

  return (
    <div className="nav-tabs-scroll-wrap">
      <nav
        className={`nav-tabs-scroll no-print${workspace ? ` nav-tabs-scroll--${workspace}` : ""}`}
        aria-label={ariaLabel}
        data-workspace={workspace}
      >
        {splitAdmin ? (
          <>
            {staffTabs.map(renderTab)}
            {adminTabs.map(renderTab)}
          </>
        ) : (
          tabs.map(renderTab)
        )}
      </nav>
    </div>
  );
}
