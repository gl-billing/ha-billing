import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";

/** Map roster display names to their role label from the Employees sheet. */
export function buildEmployeeRoleLookup(
  directory: EmployeeRecord[],
  roster: string[],
  canonicalize: (name: string, roster: string[]) => string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const employee of directory) {
    const role = employee.role.trim();
    if (!role) continue;
    const keys = new Set<string>([
      employee.name.trim().toLowerCase(),
      canonicalize(employee.name, roster).trim().toLowerCase()
    ]);
    keys.forEach((key) => {
      if (key) map.set(key, role);
    });
  }
  return map;
}
