import { canonicalizeStaffName, resolveFirmOwnerAssignee } from "@/lib/staff-assignee";

import { isFirmLawyerOnRoster } from "@/lib/firm-lawyers-roster";

/** Handling lawyers who own court filing events — firm roster + attorneys on the employees list. */
export function isHandlingLawyerStaff(
  name: string,
  roster: string[],
  firmLawyers?: import("@/lib/firm-lawyers-roster").FirmLawyerRosterEntry[]
): boolean {
  if (firmLawyers?.length && isFirmLawyerOnRoster(name, firmLawyers)) {
    return true;
  }
  const target = canonicalizeStaffName(name, roster).trim().toLowerCase();
  if (!target) return false;

  const owner = resolveFirmOwnerAssignee(roster);
  if (owner && target === canonicalizeStaffName(owner, roster).trim().toLowerCase()) {
    return true;
  }

  const row = roster.find((entry) => target === canonicalizeStaffName(entry, roster).trim().toLowerCase());
  return Boolean(row && /^atty/i.test(row.trim()));
}
