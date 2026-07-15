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

  const firstTab = content.items[0]?.tabId;

  return createPortal(
    <div className="workspace-intro-backdrop" role="presentation">
      <div
        className="workspace-intro-modal workspace-intro-modal--formal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-intro-title"
        aria-describedby="workspace-intro-lede"
      >
        <header className="workspace-intro-modal__head">
          <p className="workspace-intro-modal__eyebrow">Hernandez &amp; Associates</p>
          <h2 id="workspace-intro-title" className="workspace-intro-modal__title">
            {content.title}
          </h2>
          <p id="workspace-intro-lede" className="workspace-intro-modal__lede">
            {content.lede}
          </p>
        </header>

        <footer className="workspace-intro-modal__foot">
          <SameWindowLink
            href={`/office-hub/instructions#${content.instructionsAnchor}`}
            className="workspace-intro-modal__link"
          >
            Office procedures
          </SameWindowLink>
          <button
            type="button"
            className="workspace-intro-modal__continue"
            onClick={() => {
              if (firstTab) onSelectTab(firstTab);
              else onClose();
            }}
          >
            Continue
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
