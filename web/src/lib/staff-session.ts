import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { canonicalizeStaffName } from "@/lib/staff-assignee";
import { formatStaffDisplayName } from "@/lib/user-display";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  displayName?: string | null;
};

/** Map signed-in user to an Employees-sheet name for My Work filtering. */
export function resolveSessionStaffName(
  user: SessionUser | undefined | null,
  directory: EmployeeRecord[]
): string | null {
  if (!user) return null;

  const roster = directory.map((entry) => entry.name).filter(Boolean);
  if (!roster.length) return null;

  const email = user.email?.trim().toLowerCase();
  if (email) {
    const byEmail = directory.find((entry) => entry.email.trim().toLowerCase() === email);
    if (byEmail?.name) return byEmail.name;
  }

  const candidates = [
    user.displayName?.trim(),
    formatStaffDisplayName(user.name, user.email),
    user.name?.trim()
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const canonical = canonicalizeStaffName(candidate, roster);
    const match = roster.find((name) => name.toLowerCase() === canonical.toLowerCase());
    if (match) return match;
  }

  return null;
}
