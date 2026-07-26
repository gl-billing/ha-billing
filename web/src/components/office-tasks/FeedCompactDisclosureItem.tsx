"use client";

import type { ReactNode } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { deskChecklistCompactSummary } from "@/lib/office-tasks/desk-checklist";

type Props = {
  item: OfficeItem;
  children: ReactNode;
  className?: string;
};

/**
 * One bordered card per Completed / Cancelled feed row.
 * Collapsed: one-line summary. Expanded: details render inline below (same card).
 */
export function FeedCompactDisclosureItem({ item, children, className }: Props) {
  const summary = deskChecklistCompactSummary(item);

  return (
    <li className={`feed-compact-disclosure${className ? ` ${className}` : ""}`}>
      <details className="feed-compact-disclosure__details">
        <summary className="feed-compact-disclosure__summary">{summary}</summary>
        <div className="feed-compact-disclosure__body">{children}</div>
      </details>
    </li>
  );
}
