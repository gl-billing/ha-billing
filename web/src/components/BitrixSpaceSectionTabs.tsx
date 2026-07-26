"use client";

import type { NavTabDef } from "@/lib/workspace-labels";

type Props<T extends string> = {
  tabs: NavTabDef<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * Bitrix-style in-panel section links (List / Calendar / …) — not desk segmented tabs.
 */
export function BitrixSpaceSectionTabs<T extends string>({
  tabs,
  activeId,
  onSelect,
  disabled = false,
  ariaLabel = "Section"
}: Props<T>) {
  return (
    <nav className="bitrix-space-section-tabs" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={`bitrix-space-section-tabs__link${active ? " bitrix-space-section-tabs__link--active" : ""}`}
            aria-current={active ? "page" : undefined}
            title={tab.description}
            disabled={disabled}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
