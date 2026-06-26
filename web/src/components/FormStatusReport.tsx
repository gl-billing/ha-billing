"use client";

import type { FormSaveStatus } from "@/lib/firm-status-report";

type Props = {
  status: FormSaveStatus | null | undefined;
  className?: string;
};

export function FormStatusReport({ status, className = "" }: Props) {
  if (!status?.message) return null;

  const toneClass =
    status.phase === "error"
      ? "form-status-report--error"
      : status.phase === "success"
        ? "form-status-report--success"
        : "form-status-report--processing";

  return (
    <div
      className={`form-status-report ${toneClass} ${className}`.trim()}
      role={status.phase === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {status.phase === "processing" ? (
        <span className="form-status-report__spinner" aria-hidden />
      ) : (
        <span className="form-status-report__icon" aria-hidden>
          {status.phase === "error" ? "!" : "✓"}
        </span>
      )}
      <span className="form-status-report__text">{status.message}</span>
    </div>
  );
}
