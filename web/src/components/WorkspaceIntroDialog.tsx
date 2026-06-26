"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SameWindowLink } from "@/components/SameWindowLink";
import type { WorkspaceIntroContent } from "@/lib/workspace-intro-content";

type Props = {
  open: boolean;
  content: WorkspaceIntroContent;
  onSelectTab: (tabId: string) => void;
  onClose: () => void;
};

export function WorkspaceIntroDialog({ open, content, onSelectTab, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace-intro-backdrop" role="presentation">
      <div
        className="workspace-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-intro-title"
        aria-describedby="workspace-intro-lede"
      >
        <button
          type="button"
          className="workspace-intro-modal__close"
          aria-label="Close guide"
          title="Close"
          onClick={onClose}
        >
          ×
        </button>
        <header className="workspace-intro-modal__head">
          <p className="workspace-intro-modal__eyebrow">HA Office</p>
          <h2 id="workspace-intro-title" className="workspace-intro-modal__title">
            {content.title}
          </h2>
          <p id="workspace-intro-lede" className="workspace-intro-modal__lede">
            {content.lede}
          </p>
        </header>

        <div className="workspace-intro-modal__body">
          <ul className="workspace-intro-section__list">
            {content.items.map((item) => (
              <li key={item.tabId} className="workspace-intro-section__item">
                <button
                  type="button"
                  className="workspace-intro-section__item-link"
                  onClick={() => onSelectTab(item.tabId)}
                >
                  {item.label}
                </button>
                <span className="workspace-intro-section__item-desc">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="workspace-intro-modal__tip">{content.tip}</p>

        <footer className="workspace-intro-modal__foot workspace-intro-modal__foot--solo">
          <SameWindowLink
            href={`/office-hub/instructions#${content.instructionsAnchor}`}
            className="workspace-intro-modal__link"
          >
            Full guide
          </SameWindowLink>
        </footer>
      </div>
    </div>,
    document.body
  );
}
