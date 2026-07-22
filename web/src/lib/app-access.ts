import { FIRM_OWNER_EMAILS, isFirmOwnerEmail, FIRM_SECRETARIES, MANAGING_PARTNER, DEFAULT_FIRM_LAWYERS_ROSTER, FIRM_LIAISON } from "@/lib/firm-team-config";
import { DEFAULT_FIRM_SENDER_EMAIL } from "@/lib/firm-sender";
import { STAFF_GOOGLE_PROVIDER_ID } from "@/lib/guest-oauth";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";

function parseEmailList(raw: string | undefined): string[] {
  return raw?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
}

function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

/** Firm staff with access to Office Hub, tasks, and billing. */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();

  if (FIRM_OWNER_EMAILS.some((owner) => owner.toLowerCase() === normalized)) return true;

  if (getTasksOnlyEmails().includes(normalized)) return true;
  if (getSecretaryNavEmails().includes(normalized)) return true;
  if (getAdminEmails().includes(normalized)) return true;
  if (getAssociateLawyerEmails().includes(normalized)) return true;
  if (getLiaisonEmails().includes(normalized)) return true;

  const allowedList = parseEmailList(process.env.ALLOWED_EMAILS);
  if (allowedList.includes(normalized)) return true;

  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  if (domain && normalized.endsWith(`@${domain}`)) return true;

  // Production: deny when no allowlist is configured (dev may stay open for local testing).
  if (!allowedList.length && !domain) {
    return process.env.NODE_ENV !== "production";
  }

  return false;
}

/** Log a startup warning when production has no staff allowlist configured. */
export function warnProductionAllowlistUnset(): void {
  if (process.env.NODE_ENV !== "production") return;
  const allowedList = parseEmailList(process.env.ALLOWED_EMAILS);
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim();
  if (!allowedList.length && !domain) {
    console.error(
      "[ha-billing] CRITICAL: Set ALLOWED_EMAILS or ALLOWED_EMAIL_DOMAIN in production — all sign-ins are denied until configured."
    );
  }
}

export function canAccessOfficeHub(email: string | null | undefined): boolean {
  return isStaffEmail(email);
}

export function resolvePostLoginPath(
  email: string | null | undefined
): "/office-hub" | "/login?error=AccessDenied" {
  return canAccessOfficeHub(email) ? "/office-hub" : "/login?error=AccessDenied";
}

export function getStaffEmails(): string[] {
  return uniqueEmails([
    ...parseEmailList(process.env.ALLOWED_EMAILS),
    ...getTasksOnlyEmails(),
    ...getSecretaryNavEmails(),
    ...getAdminEmails()
  ]);
}

const DEFAULT_TASKS_ONLY_EMAILS = [] as const;

export function getTasksOnlyEmails(): string[] {
  return uniqueEmails([...DEFAULT_TASKS_ONLY_EMAILS, ...parseEmailList(process.env.TASKS_ONLY_EMAILS)]);
}

export function getSecretaryNavEmails(): string[] {
  const fromEnv = parseEmailList(process.env.SECRETARY_NAV_EMAILS);
  const firmSecretaries = FIRM_SECRETARIES.map((entry) => entry.email.toLowerCase());
  return uniqueEmails([DEFAULT_FIRM_SENDER_EMAIL.toLowerCase(), ...firmSecretaries, ...fromEnv]);
}

/** Associate lawyers — tasks/calendar only, no Accounts billing. */
export function getAssociateLawyerEmails(): string[] {
  const fromEnv = parseEmailList(process.env.ASSOCIATE_LAWYER_EMAILS);
  const partnerEmails = new Set(MANAGING_PARTNER.emails.map((value) => value.toLowerCase()));
  const fromRoster = DEFAULT_FIRM_LAWYERS_ROSTER.filter(
    (entry) => !partnerEmails.has(entry.email.trim().toLowerCase())
  ).map((entry) => entry.email);
  return uniqueEmails([...fromRoster, ...fromEnv]);
}

export function getLiaisonEmails(): string[] {
  const fromEnv = parseEmailList(process.env.LIAISON_EMAILS);
  return uniqueEmails([...FIRM_LIAISON.defaultEmails, ...fromEnv]);
}

export function isLiaisonStaffName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const lower = name.trim().toLowerCase();
  return (
    (lower.includes("james") && lower.includes("bryan")) ||
    lower.includes("hakola") ||
    /\bliaison officer\b/i.test(name)
  );
}

export function isLiaisonEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = getLiaisonEmails();
  return list.length > 0 && list.includes(normalized);
}

export function canViewLiaisonTab(options: {
  email?: string | null;
  staffName?: string | null;
  isAdmin?: boolean;
}): boolean {
  if (options.isAdmin) return true;
  if (isLiaisonEmail(options.email)) return true;
  if (isLiaisonStaffName(options.staffName)) return true;
  return false;
}

export function isAssociateLawyerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (isAdminEmail(email)) return false;
  if (MANAGING_PARTNER.emails.some((value) => value.toLowerCase() === normalized)) return false;
  return getAssociateLawyerEmails().includes(normalized);
}

const DEFAULT_DESK_BILLING_EDITOR_EMAILS = [DEFAULT_FIRM_SENDER_EMAIL.toLowerCase()] as const;

export function getDeskBillingEditorEmails(): string[] {
  const fromEnv = parseEmailList(process.env.DESK_BILLING_EDITOR_EMAILS);
  if (fromEnv.length) return uniqueEmails([...DEFAULT_DESK_BILLING_EDITOR_EMAILS, ...fromEnv]);
  return uniqueEmails([...DEFAULT_DESK_BILLING_EDITOR_EMAILS, ...getSecretaryNavEmails()]);
}

export function canEditDeskBilling(email: string | null | undefined): boolean {
  if (!email || !canAccessBilling(email)) return false;
  if (isFirmOwnerEmail(email)) return true;
  return getDeskBillingEditorEmails().includes(email.trim().toLowerCase());
}

export function isSecretaryNavUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getSecretaryNavEmails();
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

export function isTasksOnlyEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getTasksOnlyEmails();
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

export function isTasksOnlyStaff(email: string | null | undefined): boolean {
  return isTasksOnlyEmail(email);
}

export function canAccessBilling(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isAssociateLawyerEmail(email)) return false;
  return !isTasksOnlyEmail(email);
}

export function canAccessTasks(email: string | null | undefined): boolean {
  return Boolean(email?.trim()) && isStaffEmail(email);
}

export function requireBillingAccess(email: string | null | undefined): void {
  if (!canAccessBilling(email)) {
    throw new Error("You do not have access to the billing system.");
  }
}

export function resolveStaffSignIn(
  email: string | null | undefined,
  provider: string | null | undefined
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  if (provider && provider !== STAFF_GOOGLE_PROVIDER_ID) return false;
  return isStaffEmail(normalized);
}

const BILLING_API_PREFIXES = [
  "/api/ledger",
  "/api/clients",
  "/api/walk-ins",
  "/api/tasks/walk-ins",
  "/api/tasks/client-billing",
  "/api/notarizations",
  "/api/field-dispatch",
  "/api/dashboard",
  "/api/home",
  "/api/documents",
  "/api/export",
  "/api/audit-log",
  "/api/pending-ar",
  "/api/reports",
  "/api/billing",
  "/api/intake",
  "/api/spot-billing",
  "/api/payment-request",
  "/api/client-portal",
  "/api/my-work",
  "/api/staff-salary",
  "/api/firm-finances",
  "/api/birthdays"
] as const;

export function isBillingApiPath(pathname: string): boolean {
  return BILLING_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isBillingPagePath(pathname: string): boolean {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}
