"use client";

import { useMemo } from "react";
import { summarizeCalendarSync } from "@/lib/calendar-sync-status";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

type Props = {
  items: OfficeItem[];
  compact?: boolean;
  className?: string;
};

export function CalendarSyncStatus({ items, compact = false, className = "" }: Props) {
  const summary = useMemo(() => summarizeCalendarSync(items), [items]);

  return (
    <p
      className={`calendar-sync-status calendar-sync-status--${summary.tone}${compact ? " calendar-sync-status--compact" : ""}${className ? ` ${className}` : ""}`}
      role="status"
    >
      {summary.message}
    </p>
  );
}
