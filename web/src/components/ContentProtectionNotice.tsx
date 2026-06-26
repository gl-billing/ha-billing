"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CONTENT_PROTECTION_CONTACT_EMAIL,
  CONTENT_PROTECTION_NOTICE_TITLE
} from "@/lib/content-protection-notice";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ContentProtectionNotice({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="content-protection-notice-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="content-protection-notice"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="content-protection-notice-title"
        aria-describedby="content-protection-notice-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="content-protection-notice__head">
          <div>
            <p className="content-protection-notice__eyebrow">Protected system</p>
            <h2 id="content-protection-notice-title" className="content-protection-notice__title">
              {CONTENT_PROTECTION_NOTICE_TITLE}
            </h2>
          </div>
          <button
            type="button"
            className="content-protection-notice__close"
            onClick={onClose}
            aria-label="Close copyright notice"
          >
            ×
          </button>
        </div>
        <p id="content-protection-notice-body" className="content-protection-notice__body">
          This system is copyrighted under Atty. Maria Hernandez. Any unauthorized copying or
          distribution is prohibited. You may contact us at{" "}
          <a href={`mailto:${CONTENT_PROTECTION_CONTACT_EMAIL}`}>{CONTENT_PROTECTION_CONTACT_EMAIL}</a> for
          pricing and setting up if interested.
        </p>
        <div className="content-protection-notice__foot">
          <div className="content-protection-notice__ornament" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="content-protection-notice__actions">
            <button type="button" className="content-protection-notice__btn" onClick={onClose}>
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
