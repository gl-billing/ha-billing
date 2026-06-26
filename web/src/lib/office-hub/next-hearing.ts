import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { todayYmd } from "@/lib/office-tasks/date-only";

export type NextHearing = {
  label: string;
  date: string;
  startTime: string | null;
};

export function findNextHearing(items: OfficeItem[]): NextHearing | null {
  const today = todayYmd();
  const upcoming = items
    .filter((item) => item.source === "Event" && !item.done && item.date && item.date >= today)
    .sort((a, b) => {
      const byDate = (a.date || "").localeCompare(b.date || "");
      if (byDate !== 0) return byDate;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

  const next = upcoming[0];
  if (!next?.date) return null;

  const label =
    next.clientCase?.trim() ||
    next.details?.trim() ||
    next.category?.trim() ||
    "Hearing";

  return {
    label,
    date: next.date,
    startTime: next.startTime
  };
}
