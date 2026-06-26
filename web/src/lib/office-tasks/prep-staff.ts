import { resolveAndreaAssignee, resolveJasAssignee } from "@/lib/office-tasks/task-assignees";
import { canonicalizeStaffName, resolveFirmOwnerAssignee } from "@/lib/staff-assignee";

function splitAssignees(value: string): string[] {
  return String(value || "")
    .split(/[,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Prep is handled by Andrea / Jas — they own filing prep tasks, not court filing events. */
export function isFilingPrepOperationsStaff(name: string, roster: string[]): boolean {
  const target = canonicalizeStaffName(name, roster).trim().toLowerCase();
  const owner = resolveFirmOwnerAssignee(roster);
  if (owner && target === canonicalizeStaffName(owner, roster).trim().toLowerCase()) {
    return false;
  }

  const andrea = canonicalizeStaffName(resolveAndreaAssignee(roster), roster).trim().toLowerCase();
  const jas = canonicalizeStaffName(resolveJasAssignee(roster), roster).trim().toLowerCase();
  return target === andrea || target === jas;
}

export function responsibleIsFilingPrepStaff(responsible: string, roster: string[]): boolean {
  return splitAssignees(responsible).some((name) => isFilingPrepOperationsStaff(name, roster));
}
