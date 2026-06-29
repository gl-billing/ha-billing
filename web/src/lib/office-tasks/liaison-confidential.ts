import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { filterItemsForMyWork } from "@/lib/office-tasks/my-work-filter";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";

export const LIAISON_CONFIDENTIAL_MARKER = "LIAISON_CONFIDENTIAL";

export function isLiaisonConfidentialItem(item: Pick<OfficeItem, "remarks" | "source">): boolean {
  if (item.source !== "Task") return false;
  return new RegExp(`\\b${LIAISON_CONFIDENTIAL_MARKER}\\b`, "i").test(item.remarks || "");
}

export function markLiaisonConfidentialRemarks(remarks: string): string {
  if (isLiaisonConfidentialItem({ source: "Task", remarks })) return remarks.trim();
  return appendRemarkMarkers(remarks, [LIAISON_CONFIDENTIAL_MARKER]);
}

/** Remove confidential liaison tasks from general schedule views. */
export function excludeLiaisonConfidentialItems(items: OfficeItem[]): OfficeItem[] {
  return items.filter((item) => !isLiaisonConfidentialItem(item));
}

/** Server-side: strip confidential tasks unless viewer is liaison or admin. */
export function filterVisibleOfficeItems(
  items: OfficeItem[],
  options: { canViewLiaisonConfidential: boolean }
): OfficeItem[] {
  if (options.canViewLiaisonConfidential) return items;
  return excludeLiaisonConfidentialItems(items);
}

export function filterLiaisonConfidentialItems(items: OfficeItem[]): OfficeItem[] {
  return items.filter(isLiaisonConfidentialItem);
}

/** Liaison tab — admin sees all confidential tasks; liaison sees only theirs. */
export function liaisonConfidentialItemsForViewer(
  items: OfficeItem[],
  options: { isAdmin: boolean; staffName?: string; roster?: string[] }
): OfficeItem[] {
  const confidential = filterLiaisonConfidentialItems(items);
  if (options.isAdmin) return confidential;
  if (!options.staffName?.trim()) return [];
  return filterItemsForMyWork(confidential, options.staffName, options.roster ?? []);
}
