"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TabShortcutItem } from "@/lib/workspace-tab-shortcuts";

type ShortcutGroup = {
  title: string;
  items: TabShortcutItem[];
};

const BASE_GROUPS: ShortcutGroup[] = [
  {
    title: "Everywhere",
    items: [
      { keys: "⌘ K", description: "Open command palette (search clients, tasks, quick actions)" },
      { keys: "/", description: "Focus firm-wide search" },
      { keys: "?", description: "Toggle this shortcuts panel" },
      { keys: "Esc", description: "Close dialogs and command palette" }
    ]
  }
];

type Props = {
  className?: string;
  tabShortcuts?: TabShortcutItem[];
  tabShortcutsTitle?: string;
};

export function KeyboardShortcutsHelp({
  className = "",
  tabShortcuts,
  tabShortcutsTitle = "Workspace tabs"
}: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const groups: ShortcutGroup[] = [
    ...BASE_GROUPS,
    ...(tabShortcuts?.length
      ? [{ title: tabShortcutsTitle, items: tabShortcuts }]
      : [])
  ];

  return (
    <>
      <button
        type="button"
        className={`keyboard-shortcuts-trigger ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="keyboard-shortcuts-backdrop" role="presentation" onClick={close}>
              <div
                className="keyboard-shortcuts-modal"
                role="dialog"
                aria-label="Keyboard shortcuts"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="keyboard-shortcuts-modal__head">
                  <h2 className="keyboard-shortcuts-modal__title">Keyboard shortcuts</h2>
                  <button type="button" className="keyboard-shortcuts-modal__close" onClick={close} aria-label="Close">
                    ×
                  </button>
                </div>
                <div className="keyboard-shortcuts-modal__body">
                  {groups.map((group) => (
                    <section key={group.title} className="keyboard-shortcuts-group">
                      <h3 className="keyboard-shortcuts-group__title">{group.title}</h3>
                      <ul className="keyboard-shortcuts-group__list">
                        {group.items.map((item) => (
                          <li key={item.keys + item.description}>
                            <kbd>{item.keys}</kbd>
                            <span>{item.description}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                <p className="keyboard-shortcuts-modal__foot">
                  Number keys switch tabs when you are not typing in a field.
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
