"use client";

import type { ReactNode } from "react";
import { ConflictCheckLoading } from "@/components/ConflictCheckLoading";
import type { PrefixCollisionMatch } from "@/lib/sheets/prefix-collision";
import { formatCollisionSummary } from "@/lib/sheets/prefix-collision";

type CardVariant = "checking" | "review" | "blocked" | "clear";

type CardProps = {
  variant: CardVariant;
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
  compactLoading?: boolean;
};

function CardIcon({ variant }: { variant: CardVariant }) {
  if (variant === "clear") {
    return (
      <svg className="conflict-warning-card__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "blocked") {
    return (
      <svg className="conflict-warning-card__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="conflict-warning-card__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 2.5 20h19L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 9v5M12 17h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ConflictWarningCard({
  variant,
  eyebrow,
  title,
  subtitle,
  children,
  className = "",
  compactLoading = false
}: CardProps) {
  const variantClass =
    variant === "blocked"
      ? "conflict-warning-card--blocked"
      : variant === "clear"
        ? "conflict-warning-card--clear"
        : variant === "checking"
          ? "conflict-warning-card--checking"
          : "conflict-warning-card--review";

  return (
    <div
      className={`conflict-warning-card ${variantClass} ${className}`.trim()}
      aria-live={variant === "checking" ? undefined : "polite"}
    >
      <div className="conflict-warning-card__shine" aria-hidden />
      <div className="conflict-warning-card__inner">
        {variant === "checking" ? (
          <ConflictCheckLoading compact={compactLoading} />
        ) : (
          <>
            <header className="conflict-warning-card__header">
              <div className="conflict-warning-card__badge" aria-hidden>
                <CardIcon variant={variant} />
              </div>
              <div className="min-w-0 flex-1">
                {eyebrow ? <p className="conflict-warning-card__eyebrow">{eyebrow}</p> : null}
                <h3 className="conflict-warning-card__title">{title}</h3>
                {subtitle ? <div className="conflict-warning-card__subtitle">{subtitle}</div> : null}
              </div>
            </header>
            {children ? <div className="conflict-warning-card__body">{children}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}

export function ConflictWarningSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="conflict-warning-card__section">
      <p className="conflict-warning-card__section-title">{title}</p>
      <div className="conflict-warning-card__section-body">{children}</div>
    </section>
  );
}

export function ConflictMatchList({
  matches,
  onUseExistingCode,
  limit = 5
}: {
  matches: PrefixCollisionMatch[];
  onUseExistingCode?: (code: string) => void;
  limit?: number;
}) {
  if (!matches.length) return null;

  return (
    <ul className="conflict-warning-card__matches">
      {matches.slice(0, limit).map((match) => (
        <li key={match.code} className="conflict-warning-card__match">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="conflict-warning-card__match-code">{match.code}</span>
              <p className="conflict-warning-card__match-title">{formatCollisionSummary(match)}</p>
            </div>
            <p className="conflict-warning-card__match-reason">
              {match.reasons.length ? match.reasons.join(" · ") : "Listed on Master List"}
            </p>
          </div>
          {onUseExistingCode ? (
            <button
              type="button"
              className="conflict-warning-card__use-btn"
              onClick={() => onUseExistingCode(match.code)}
            >
              Use {match.code}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
