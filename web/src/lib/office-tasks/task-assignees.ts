import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { resolveAndreaEmployee } from "@/lib/hearing-escalation";
import { resolveFirmOwnerAssignee } from "@/lib/staff-assignee";

/** Default assignee for BIR / tax compliance work — managing partner. */
export function defaultTaxComplianceAssignee(roster: string[]): string {
  return resolveFirmOwnerAssignee(roster) || roster.find((name) => /janine/i.test(name)) || "Admin";
}

function isSecretaryRosterName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("shiela") ||
    lower.includes("hiedee") ||
    lower.includes("andrea") ||
    lower.includes("ellyza") ||
    /\bsecretary\b/i.test(name)
  );
}

function isLiaisonRosterName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("liaison") ||
    lower.includes("jas") ||
    lower.includes("james bryan") ||
    lower.includes("hakola")
  );
}

/** Default assignee for billing ops, SOA/AR, and engagement/contract delivery — firm secretary. */
export function resolveSecretaryAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  if (directory?.length) {
    const fromDirectory = resolveAndreaEmployee(directory);
    if (fromDirectory?.name) return fromDirectory.name;
  }

  const fromRoster = roster.find((name) => isSecretaryRosterName(name));
  if (fromRoster) return fromRoster;

  return "Shiela";
}

/** @deprecated Prefer resolveSecretaryAssignee. */
export function resolveAndreaAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  return resolveSecretaryAssignee(roster, directory);
}

export function defaultSecretaryOperationsAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  return resolveSecretaryAssignee(roster, directory);
}

/** @deprecated Prefer defaultSecretaryOperationsAssignee. */
export function defaultAndreaOperationsAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  return defaultSecretaryOperationsAssignee(roster, directory);
}

/** Default assignee for filing prep / field work — liaison officer. */
export function resolveLiaisonAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  if (directory?.length) {
    const fromDirectory = directory.find((row) => isLiaisonRosterName(row.name));
    if (fromDirectory?.name) return fromDirectory.name;
  }

  const fromRoster = roster.find((name) => isLiaisonRosterName(name));
  if (fromRoster) return fromRoster;

  return "Liaison Officer";
}

/** @deprecated Prefer resolveLiaisonAssignee. */
export function resolveJasAssignee(
  roster: string[],
  directory?: EmployeeRecord[]
): string {
  return resolveLiaisonAssignee(roster, directory);
}

/** Comma-separated prep assignees for a filing event prep task — secretary, liaison, or both. */
export function buildFilingPrepAssignees(
  options: { andrea?: boolean; jas?: boolean; secretary?: boolean; liaison?: boolean },
  roster: string[] = [],
  directory?: EmployeeRecord[]
): string {
  const includeSecretary = options.secretary ?? options.andrea ?? true;
  const includeLiaison = options.liaison ?? options.jas ?? false;
  const names: string[] = [];
  if (includeSecretary !== false) names.push(resolveSecretaryAssignee(roster, directory));
  if (includeLiaison) names.push(resolveLiaisonAssignee(roster, directory));
  return names.filter(Boolean).join(", ");
}

export function defaultFilingPrepAssignees(
  roster: string[] = [],
  directory?: EmployeeRecord[]
): string {
  return resolveSecretaryAssignee(roster, directory);
}
