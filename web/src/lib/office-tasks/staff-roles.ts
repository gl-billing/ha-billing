/** Roles shown when trial firms register staff on the Employees sheet. */
export const FIRM_STAFF_ROLES = [
  "Lawyer",
  "Associate",
  "Paralegal",
  "Legal Assistant",
  "Secretary",
  "Admin",
  "Staff",
  "Other"
] as const;

export type FirmStaffRole = (typeof FIRM_STAFF_ROLES)[number];

/** What a registered staff member can open in the firm workspace. */
export type TrialStaffAccess = "admin" | "full" | "front-desk" | "tasks-only";

export const TRIAL_STAFF_ACCESS_OPTIONS: { id: TrialStaffAccess; label: string; description: string }[] = [
  {
    id: "admin",
    label: "Admin (everything)",
    description:
      "Everything the workspace creator can do — firm settings, finances, payroll, and managing this staff roster."
  },
  {
    id: "full",
    label: "Full workspace",
    description: "Billing and Tasks & calendar — everything except admin-only pages (finances, payroll, staff registry)."
  },
  {
    id: "front-desk",
    label: "Front desk",
    description: "Daily billing desk (ledger, walk-ins, notarizations, intake, SOA/AR) plus the tasks desk boards."
  },
  {
    id: "tasks-only",
    label: "Tasks only",
    description: "Tasks & calendar only — no access to the billing app."
  }
];

export function normalizeTrialStaffAccess(value: string | null | undefined): TrialStaffAccess {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "administrator" || normalized === "co-admin") return "admin";
  if (normalized === "front-desk" || normalized === "front desk" || normalized === "secretary") return "front-desk";
  if (normalized === "tasks-only" || normalized === "tasks only" || normalized === "tasks") return "tasks-only";
  return "full";
}

export function trialStaffAccessLabel(access: TrialStaffAccess): string {
  return TRIAL_STAFF_ACCESS_OPTIONS.find((option) => option.id === access)?.label ?? "Full workspace";
}

/**
 * Live workspace access for Staff UI.
 * Trial firms: Employees sheet column F.
 * Production GL: ADMIN / SECRETARY_NAV / TASKS_ONLY env lists, then sheet when set.
 */
export function resolveDisplayedStaffAccess(input: {
  email?: string | null;
  sheetAccess?: TrialStaffAccess | string | null;
  accessConfigured?: boolean;
  trialWorkspace?: boolean;
  isAdminEmail?: (email: string) => boolean;
  isSecretaryEmail?: (email: string) => boolean;
  isTasksOnlyEmail?: (email: string) => boolean;
}): TrialStaffAccess {
  const sheetAccess = normalizeTrialStaffAccess(input.sheetAccess);
  if (input.trialWorkspace) return sheetAccess;

  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email) return sheetAccess;

  if (input.isAdminEmail?.(email)) return "admin";
  if (input.isTasksOnlyEmail?.(email)) return "tasks-only";
  if (input.isSecretaryEmail?.(email)) return "front-desk";
  if (input.accessConfigured) return sheetAccess;
  return "full";
}
