"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import type { NextQueueItem } from "@/lib/next-queue";

type Props = {
  items: NextQueueItem[];
  title?: string;
  className?: string;
  compact?: boolean;
};

export function NextQueueStrip({ items, title = "Next up", className = "", compact = false }: Props) {
  if (!items.length) return null;

  const primary = items[0];
  const rest = items.slice(1, compact ? 3 : 5);

  return (
    <section className={`next-queue-strip ${className}`.trim()} aria-label={title}>
      <div className="next-queue-strip__head">
        <p className="next-queue-strip__title">{title}</p>
        {primary ? (
          <SameWindowLink href={primary.href} className="next-queue-strip__primary">
            <span className={`next-queue-strip__badge next-queue-strip__badge--${primary.priority}`}>
              {primary.priority === "urgent" ? "Urgent" : primary.priority === "high" ? "Soon" : "Next"}
            </span>
            <span className="next-queue-strip__primary-label">{primary.label}</span>
            {primary.detail ? <span className="next-queue-strip__primary-detail">{primary.detail}</span> : null}
          </SameWindowLink>
        ) : null}
      </div>
      {rest.length ? (
        <ul className="next-queue-strip__list">
          {rest.map((item) => (
            <li key={item.id}>
              <SameWindowLink href={item.href} className="next-queue-strip__link">
                {item.label}
              </SameWindowLink>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
