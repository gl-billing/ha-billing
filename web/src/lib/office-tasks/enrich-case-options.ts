import type { CaseOption } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

/** Fill court/venue from the latest event when Master List has no court pending. */
export function enrichCaseOptionsFromItems(options: CaseOption[], items: OfficeItem[]): CaseOption[] {
  const latestVenue = new Map<string, { venue: string; date: string }>();

  for (const item of items) {
    if (item.source !== "Event") continue;
    const label = item.clientCase?.trim();
    const venue = item.venue?.trim();
    if (!label || !venue) continue;

    const date = item.date || item.filingDeadline || "";
    const existing = latestVenue.get(label);
    if (!existing || date.localeCompare(existing.date) > 0) {
      latestVenue.set(label, { venue, date });
    }
  }

  return options.map((option) => {
    const fallback = latestVenue.get(option.label)?.venue;
    if (option.courtPending?.trim() || !fallback) return option;
    return { ...option, courtPending: fallback };
  });
}
