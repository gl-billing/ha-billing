import { getAndreaCourtConfirmationItems } from "@/lib/hearing-escalation";
import { applyStaffWorkloadDedup } from "@/lib/office-tasks/event-prep-workload";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isCancelledStatus, itemHasAssignee } from "@/lib/office-tasks/schedule";
import { resolveAndreaAssignee } from "@/lib/office-tasks/task-assignees";
import { isFilingPrepOperationsStaff } from "@/lib/office-tasks/prep-staff";
import {
  expandStaffWorkloadWithLinkedPrepPairs,
  resolvePrepWorkloadViewRole
} from "@/lib/office-tasks/prep-workload-view";
import { canonicalizeStaffName } from "@/lib/staff-assignee";

export function isAndreaStaffName(name: string, roster: string[] = []): boolean {
  const andrea = resolveAndreaAssignee(roster);
  return (
    canonicalizeStaffName(name, roster).trim().toLowerCase() === andrea.trim().toLowerCase()
  );
}

export function isPrepStaffName(name: string, roster: string[] = []): boolean {
  return isFilingPrepOperationsStaff(name, roster);
}

/** Raw assignee match — Andrea also gets firm-wide hearings pending court confirmation. */
export function itemsForEmployeeWorkload(
  name: string,
  items: OfficeItem[],
  roster: string[] = []
): OfficeItem[] {
  const assigned = items.filter(
    (item) => itemHasAssignee(item, name, roster) && !isCancelledStatus(item.status)
  );
  if (!isAndreaStaffName(name, roster)) return assigned;

  const seen = new Set(assigned.map((item) => `${item.source}-${item.rowNumber}`));
  const courtCalls = getAndreaCourtConfirmationItems(items).filter(
    (item) => !seen.has(`${item.source}-${item.rowNumber}`)
  );
  return courtCalls.length ? [...assigned, ...courtCalls] : assigned;
}

/** Staff workload with linked prep/event pairs surfaced for each role. */
export function filterStaffWorkloadItems(
  name: string,
  items: OfficeItem[],
  roster: string[] = []
): OfficeItem[] {
  const role = resolvePrepWorkloadViewRole(name, roster);
  const list = itemsForEmployeeWorkload(name, items, roster);
  const expanded = expandStaffWorkloadWithLinkedPrepPairs(list, items, role);
  return applyStaffWorkloadDedup(expanded, name, items, roster);
}
