"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenuPosition } from "@/hooks/useAnchoredMenuPosition";

type Props = {
  toggling?: boolean;
  showStarted?: boolean;
  onStarted?: () => void;
  showWaiting?: boolean;
  onWaiting?: () => void;
  showInProgress?: boolean;
  onInProgress?: () => void;
  onCancel?: () => void;
  onReset?: () => void;
  onDelete?: () => void;
};

export function ItemMoreMenu({
  toggling,
  showStarted,
  onStarted,
  showWaiting,
  onWaiting,
  showInProgress,
  onInProgress,
  onCancel,
  onReset,
  onDelete
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const items = [
    showStarted && onStarted ? { key: "started", label: "Started", onClick: onStarted } : null,
    showWaiting && onWaiting ? { key: "waiting", label: "Waiting", onClick: onWaiting } : null,
    showInProgress && onInProgress ? { key: "in-progress", label: "In Progress", onClick: onInProgress } : null,
    onCancel ? { key: "cancel", label: "Cancel", onClick: onCancel } : null,
    onReset ? { key: "reset", label: "Reset date", onClick: onReset } : null,
    onDelete ? { key: "delete", label: "Delete permanently", onClick: onDelete, danger: true } : null
  ].filter(Boolean) as Array<{ key: string; label: string; onClick: () => void; danger?: boolean }>;

  const panelStyle = useAnchoredMenuPosition({
    open,
    anchorRef: ref,
    itemCount: items.length
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!items.length) return null;

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  const panel =
    open && panelStyle && mounted ? (
      <div
        ref={panelRef}
        className="item-more-menu__panel item-more-menu__panel--floating"
        style={panelStyle}
        role="menu"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={toggling}
            className={`item-more-menu__item ${item.danger ? "item-more-menu__item--danger" : ""}`}
            onClick={() => run(item.onClick)}
          >
            {toggling ? "Saving…" : item.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="item-more-menu" ref={ref}>
      <button
        type="button"
        className="item-action-btn item-action-btn--more"
        disabled={toggling}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More"
        title="More"
      >
        <span className="item-more-menu__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
