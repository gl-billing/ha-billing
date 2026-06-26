import { canonicalizeStaffName, resolveFirmOwnerAssignee } from "@/lib/staff-assignee";

/** Handling lawyers who own court filing events — firm owner and other attorneys on the roster. */
export function isHandlingLawyerStaff(name: string, roster: string[]): boolean {
  const target = canonicalizeStaffName(name, roster).trim().toLowerCase();
  if (!target) return false;

  const owner = resolveFirmOwnerAssignee(roster);
  if (owner && target === canonicalizeStaffName(owner, roster).trim().toLowerCase()) {
    return true;
  }

  const row = roster.find((entry) => target === canonicalizeStaffName(entry, roster).trim().toLowerCase());
  return Boolean(row && /^atty/i.test(row.trim()));
}
