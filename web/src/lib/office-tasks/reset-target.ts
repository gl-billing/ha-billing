import { isFilingDeadlineEvent } from "@/lib/office-tasks/filing-confirmation";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isDeadlineLike } from "@/lib/office-tasks/schedule";

type ResetItemShape = Pick<OfficeItem, "source" | "category" | "filingDeadline" | "date">;

/** UI + dialog: filing events reset the filing deadline, not only the event date. */
export function usesFilingDeadlineForReset(item: Pick<OfficeItem, "source" | "category" | "filingDeadline">): boolean {
  return isFilingDeadlineEvent({
    source: item.source,
    category: item.category,
    filingDeadline: item.filingDeadline
  });
}

/** Which date the reset dialog should pre-fill. */
export function resetTargetDate(item: ResetItemShape): string | null {
  if (usesFilingDeadlineForReset(item) && item.filingDeadline?.trim()) {
    return item.filingDeadline.trim();
  }
  return item.date;
}

/** Server: which event columns to update when resetting with a new date. */
export function shouldUpdateFilingDeadlineOnReset(
  source: "Task" | "Event",
  category: string,
  hasFilingDeadline: boolean
): boolean {
  if (source !== "Event") return false;
  return isDeadlineLike({ category }) || hasFilingDeadline;
}
