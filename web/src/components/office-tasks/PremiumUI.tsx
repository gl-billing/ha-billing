"use client";

import type { ReactNode } from "react";
import { FIRM_LOGO_ASPECT } from "@/components/FirmLogoBanner";
import { firmLogoPublicUrl } from "@/lib/firm-logo-url";

export function ViewHero({
  eyebrow,
  title,
  subtitle,
  action,
  className = ""
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`view-hero ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="view-eyebrow">{eyebrow}</p>
          <h2 className="view-hero__title">{title}</h2>
          {subtitle && <p className="view-hero__subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  variant = "default",
  sub,
  layout = "center",
  onClick
}: {
  label: string;
  value: number;
  variant?: "default" | "gold" | "green" | "blue" | "rose" | "red" | "muted" | "sage";
  sub?: string;
  layout?: "center" | "row";
  onClick?: () => void;
}) {
  const className = [
    "stat-tile",
    `stat-tile--${variant}`,
    layout === "row" ? "stat-tile--row" : "",
    onClick ? "stat-tile--clickable" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <div className="stat-tile__value">{value}</div>
      <div className="stat-tile__text">
        {sub ? <div className="stat-tile__sub">{sub}</div> : null}
        <div className="stat-tile__label">{label}</div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={`Jump to ${label}`}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

export function HintBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`hint-bar no-print ${className}`.trim()}>
      <span className="hint-bar__icon" aria-hidden>
        ‖
      </span>
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  message,
  action,
  compact = false,
  className = ""
}: {
  title?: string;
  message: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const logoHeight = compact ? 36 : 44;
  const logoWidth = Math.round(logoHeight * FIRM_LOGO_ASPECT);

  return (
    <div className={`empty-state ${compact ? "empty-state--compact" : ""} ${className}`.trim()}>
      <div className="empty-state__mark" aria-hidden>
        <img
          src={firmLogoPublicUrl()}
          alt=""
          className="empty-state__logo"
          width={logoWidth}
          height={logoHeight}
        />
      </div>
      {title ? <p className="empty-state__title">{title}</p> : null}
      <p className="empty-state__message">{message}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ToneLegend({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const items = [
    { tone: "overdue", label: "Overdue" },
    { tone: "event", label: "Hearing" },
    { tone: "deadline", label: "Filing" },
    { tone: "task", label: "Task" },
    { tone: "started", label: "Started" },
    { tone: "waiting", label: "Waiting" },
    { tone: "done", label: "Done" },
    { tone: "cancelled", label: "Cancelled" }
  ] as const;

  return (
    <div className={className}>
      {showLabel ? (
        <p className="tone-legend__heading no-print">Color key — what each dot means on the calendar</p>
      ) : null}
      <div className="tone-legend no-print">
        {items.map(({ tone, label }) => (
          <span key={tone} className="tone-legend__item">
            <span className={`tone-dot tone-dot--${tone}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EmployeeAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span className="employee-avatar" aria-hidden>
      {initials || "?"}
    </span>
  );
}

export function ProgressRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="progress-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#b8913d ${clamped * 3.6}deg, #e8e4dc ${clamped * 3.6}deg)`
      }}
      role="img"
      aria-label={`${clamped}% complete`}
    >
      <span className="progress-ring__inner">{clamped}%</span>
    </div>
  );
}
