"use client";

type Props = {
  compact?: boolean;
  className?: string;
};

const CHECK_STEPS = ["Master List", "Similar names", "Task grouping"] as const;

export function ConflictCheckLoading({ compact = false, className = "" }: Props) {
  return (
    <div
      className={`conflict-check-loading ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="conflict-check-loading__row">
        <span className="conflict-check-loading__spinner" aria-hidden />
        <div className="min-w-0">
          <p className="conflict-check-loading__title">Checking for conflicts…</p>
          {!compact ? (
            <p className="conflict-check-loading__hint">
              Searching Master List, similar names, and task grouping.
            </p>
          ) : null}
        </div>
      </div>
      <div className="conflict-check-loading__bar" aria-hidden>
        <span className="conflict-check-loading__bar-fill" />
      </div>
      {!compact ? (
        <ul className="conflict-check-loading__steps" aria-hidden>
          {CHECK_STEPS.map((label, index) => (
            <li
              key={label}
              className="conflict-check-loading__step"
              style={{ animationDelay: `${index * 0.4}s` }}
            >
              <span className="conflict-check-loading__step-dot" />
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
