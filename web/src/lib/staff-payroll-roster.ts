import {
  DEFAULT_STAFF_MONTHLY_ALLOWANCE,
  STAFF_PAYROLL_BANK,
  type StaffSalaryProfile
} from "@/lib/staff-salary";

export const STAFF_PAYROLL_ROSTER_SETTING_KEY = "Staff Payroll Roster";

export type StaffPayrollRosterEntry = {
  id: string;
  displayName: string;
  shortName: string;
  role: string;
  email: string;
  associatedLawyerName: string;
  associatedLawyerEmail: string;
  includesFieldDispatch: boolean;
  monthlyAllowance: number;
  payrollBank: string;
  payrollAccountNumber: string;
  active: boolean;
};

export function slugifyStaffPayrollId(displayName: string): string {
  const base = String(displayName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "staff";
}

export function ensureUniqueStaffPayrollId(
  displayName: string,
  roster: StaffPayrollRosterEntry[],
  excludeId?: string
): string {
  const base = slugifyStaffPayrollId(displayName);
  let candidate = base;
  let n = 2;
  while (roster.some((entry) => entry.id === candidate && entry.id !== excludeId)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

function firstName(displayName: string): string {
  const part = String(displayName || "").trim().split(/\s+/)[0];
  return part || "Staff";
}

function buildMatchNames(entry: StaffPayrollRosterEntry): string[] {
  const names = new Set<string>();
  const display = entry.displayName.trim().toLowerCase();
  const short = entry.shortName.trim().toLowerCase();
  if (display) names.add(display);
  if (short) names.add(short);
  for (const part of display.split(/\s+/)) {
    if (part.length >= 3) names.add(part);
  }
  return [...names];
}

export function rosterEntryToProfile(entry: StaffPayrollRosterEntry): StaffSalaryProfile {
  return {
    id: entry.id,
    displayName: entry.displayName.trim(),
    shortName: entry.shortName.trim() || firstName(entry.displayName),
    role: entry.role.trim() || "Staff",
    includesFieldDispatch: entry.includesFieldDispatch,
    monthlyAllowance: entry.monthlyAllowance,
    matchNames: buildMatchNames(entry),
    payrollBank: entry.payrollBank.trim() || STAFF_PAYROLL_BANK,
    payrollAccountNumber: entry.payrollAccountNumber.trim(),
    email: entry.email.trim(),
    associatedLawyerName: entry.associatedLawyerName.trim(),
    associatedLawyerEmail: entry.associatedLawyerEmail.trim()
  };
}

export function findStaffSalaryProfileInRoster(
  roster: StaffPayrollRosterEntry[],
  staffId: string
): StaffSalaryProfile | undefined {
  const entry = roster.find((row) => row.id === staffId && row.active !== false);
  return entry ? rosterEntryToProfile(entry) : undefined;
}

export function activePayrollRoster(roster: StaffPayrollRosterEntry[]): StaffPayrollRosterEntry[] {
  return roster.filter((entry) => entry.active !== false && entry.displayName.trim());
}

function normalizeEntry(raw: Partial<StaffPayrollRosterEntry>): StaffPayrollRosterEntry | null {
  const displayName = String(raw.displayName ?? "").trim();
  if (!displayName) return null;

  const id = String(raw.id ?? "").trim() || slugifyStaffPayrollId(displayName);

  return {
    id,
    displayName,
    shortName: String(raw.shortName ?? "").trim() || firstName(displayName),
    role: String(raw.role ?? "").trim(),
    email: String(raw.email ?? "").trim(),
    associatedLawyerName: String(raw.associatedLawyerName ?? "").trim(),
    associatedLawyerEmail: String(raw.associatedLawyerEmail ?? "").trim(),
    includesFieldDispatch: Boolean(raw.includesFieldDispatch),
    monthlyAllowance:
      typeof raw.monthlyAllowance === "number" && raw.monthlyAllowance >= 0
        ? raw.monthlyAllowance
        : DEFAULT_STAFF_MONTHLY_ALLOWANCE,
    payrollBank: String(raw.payrollBank ?? STAFF_PAYROLL_BANK).trim() || STAFF_PAYROLL_BANK,
    payrollAccountNumber: String(raw.payrollAccountNumber ?? "").trim(),
    active: raw.active !== false
  };
}

export function parseStaffPayrollRoster(raw: string | undefined | null): StaffPayrollRosterEntry[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as Partial<StaffPayrollRosterEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => normalizeEntry(entry)).filter((entry): entry is StaffPayrollRosterEntry => entry !== null);
  } catch {
    return [];
  }
}

export function serializeStaffPayrollRoster(roster: StaffPayrollRosterEntry[]): string {
  return JSON.stringify(activePayrollRoster(roster));
}
