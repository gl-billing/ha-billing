import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { resolveAndreaEmployee } from "@/lib/hearing-escalation";
import { resolveFirmOwnerAssignee } from "@/lib/staff-assignee";

/** Default assignee for BIR / tax compliance work — managing partner. */
export function defaultTaxComplianceAssignee(roster: string[]): string {
  return resolveFirmOwnerAssignee(roster) || roster.find((name) => /janine/i.test(name)) || "Admin";
}

/** Default assignee for billing ops, SOA/AR, and engagement/contract delivery — firm secretary. */
export function resolveAndreaAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  if (directory?.length) {
    const fromDirectory = resolveAndreaEmployee(directory);
    if (fromDirectory?.name) return fromDirectory.name;
  }

  const fromRoster = roster.find((name) => {
    const lower = name.toLowerCase();
    return (
      lower.includes("shiela") ||
      lower.includes("andrea") ||
      lower.includes("ellyza") ||
      lower.includes("secretary")
    );
  });
  if (fromRoster) return fromRoster;

  return "Shiela";
}

export function defaultAndreaOperationsAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  return resolveAndreaAssignee(roster, directory);
}

/** Default assignee for filing prep tasks — Jas (field / liaison). */
export function resolveJasAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  if (directory?.length) {
    const fromDirectory = directory.find((row) => {
      const lower = row.name.toLowerCase();
      return lower.includes("jas") || lower.includes("james bryan") || lower.includes("hakola");
    });
    if (fromDirectory?.name) return fromDirectory.name;
  }

  const fromRoster = roster.find((name) => {
    const lower = name.toLowerCase();
    return lower.includes("jas") || lower.includes("james bryan") || lower.includes("hakola");
  });
  if (fromRoster) return fromRoster;

  return "Jas";
}

/** Comma-separated prep assignees for a filing event prep task — Andrea, Jas, or both. */
export function buildFilingPrepAssignees(
  options: { andrea?: boolean; jas?: boolean },
  roster: string[] = [],
  directory?: EmployeeRecord[]
): string {
  const names: string[] = [];
  if (options.andrea !== false) names.push(resolveAndreaAssignee(roster, directory));
  if (options.jas) names.push(resolveJasAssignee(roster, directory));
  return names.filter(Boolean).join(", ");
}

export function defaultFilingPrepAssignees(
  roster: string[] = [],
  directory?: EmployeeRecord[]
): string {
  return resolveAndreaAssignee(roster, directory);
}
