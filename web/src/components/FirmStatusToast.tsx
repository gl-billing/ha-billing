"use client";

import { useEffect, useState } from "react";
import { firmStatusDismissMs, type FirmStatusVariant } from "@/lib/firm-status-report";

type Props = {
  message?: string;
  variant?: FirmStatusVariant;
  /** Override auto-hide (0 = stay until message clears or user dismisses). */
  dismissMs?: number;
};

/** Single quiet status line — not a stacked toast pile. */
export function FirmStatusToast({ message, variant = "ok", dismissMs }: Props) {
  const [visible, setVisible] = useState(message);

  useEffect(() => {
    setVisible(message);
    const ms = dismissMs ?? firmStatusDismissMs(variant);
    if (!message || ms <= 0) return;
    const timer = window.setTimeout(() => setVisible(undefined), ms);
    return () => window.clearTimeout(timer);
  }, [message, variant, dismissMs]);

  if (!visible) return null;

  const toneClass =
    variant === "processing"
      ? "firm-status-line--processing"
      : variant === "error"
        ? "firm-status-line--error"
        : variant === "warn"
          ? "firm-status-line--warn"
          : "firm-status-line--ok";

  return (
    <div className={`firm-status-line no-print ${toneClass}`} role="status" aria-live="polite">
      <p className="firm-status-line__text">{visible}</p>
      {variant !== "processing" ? (
        <button
          type="button"
          className="firm-status-line__close"
          aria-label="Dismiss"
          onClick={() => setVisible(undefined)}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
