"use client";

import { useLayoutMode } from "@/components/LayoutModeProvider";
import type { LayoutMode } from "@/lib/layout-mode-prefs";

type Variant = "segmented" | "sheet" | "banner" | "topnav";

type Props = {
  variant?: Variant;
  className?: string;
};

const OPTIONS: { id: LayoutMode; label: string; hint: string }[] = [
  { id: "mobile", label: "Mobile", hint: "Phone layout" },
  { id: "desktop", label: "Desktop", hint: "Full desk" }
];

export function LayoutModeSwitcher({ variant = "segmented", className = "" }: Props) {
  const { layoutMode, setLayoutMode, isPhoneDevice } = useLayoutMode();
  if (!isPhoneDevice) return null;

  if (variant === "topnav") {
    if (layoutMode !== "desktop") return null;
    return (
      <button
        type="button"
        className={`layout-mode-topnav-btn no-print ${className}`.trim()}
        onClick={() => setLayoutMode("mobile")}
      >
        Mobile version
      </button>
    );
  }

  if (variant === "banner") {
    if (layoutMode !== "desktop") return null;
    return (
      <div className={`layout-mode-phone-bar no-print ${className}`.trim()}>
        <p className="layout-mode-phone-bar__copy">You are on the desktop layout.</p>
        <button
          type="button"
          className="layout-mode-phone-bar__btn"
          onClick={() => setLayoutMode("mobile")}
        >
          Use mobile version
        </button>
      </div>
    );
  }

  return (
    <div
      className={`layout-mode-switcher layout-mode-switcher--${variant} ${className}`.trim()}
      role="group"
      aria-label="Layout version"
    >
      {variant === "sheet" ? <p className="layout-mode-switcher__label">Version</p> : null}
      <div className="layout-mode-switcher__options">
        {OPTIONS.map((option) => {
          const selected = option.id === layoutMode;
          return (
            <button
              key={option.id}
              type="button"
              className={`layout-mode-switcher__option${
                selected ? " layout-mode-switcher__option--active" : ""
              }`}
              aria-pressed={selected}
              onClick={() => setLayoutMode(option.id)}
            >
              <span className="layout-mode-switcher__option-label">{option.label}</span>
              {variant === "sheet" ? (
                <span className="layout-mode-switcher__option-hint">{option.hint}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
