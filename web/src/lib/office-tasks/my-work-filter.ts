import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { filterStaffWorkloadItems } from "@/lib/office-tasks/andrea-workload";

/** Keep only tasks/events assigned to this staff member (comma-separated assignees supported). */
export function filterItemsForMyWork(
  items: OfficeItem[],
  staffName: string,
  roster: string[] = []
): OfficeItem[] {
  const name = staffName.trim();
  if (!name) return items;
  return filterStaffWorkloadItems(name, items, roster);
}
