"use client";

import { useEffect, useState } from "react";
import { firmStatusDismissMs, type FirmStatusVariant } from "@/lib/firm-status-report";

type Props = {
  message?: string;
  variant?: FirmStatusVariant;
  /** Override auto-hide (0 = stay until message clears or user dismisses). */
  dismissMs?: number;
};

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
      ? "firm-status-toast--processing"
      : variant === "error"
        ? "firm-status-toast--error"
        : variant === "warn"
          ? "firm-status-toast--warn"
          : "firm-status-toast--ok";

  return (
    <div className="firm-status-toast-wrap no-print" role="status" aria-live="polite">
      <div className={`firm-status-toast ${toneClass}`}>
        {variant === "processing" ? (
          <span className="firm-status-toast__spinner" aria-hidden />
        ) : (
          <span className="firm-status-toast__icon" aria-hidden>
            {variant === "error" || variant === "warn" ? "!" : "✓"}
          </span>
        )}
        <p className="firm-status-toast__text">{visible}</p>
        <button
          type="button"
          className="firm-status-toast__close"
          aria-label="Dismiss"
          onClick={() => setVisible(undefined)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
