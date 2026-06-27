import { canEditDeskBilling } from "@/lib/app-access";
import { FIRM_OWNER_EMAILS, isFirmOwnerEmail } from "@/lib/firm-team-config";

function parseEmailList(raw: string | undefined): string[] {
  return raw?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
}

function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

/** Comma-separated in ADMIN_EMAILS — firm admins (client admin, announcements, etc.). */
export function getAdminEmails(): string[] {
  return uniqueEmails([...FIRM_OWNER_EMAILS, ...parseEmailList(process.env.ADMIN_EMAILS)]);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isFirmOwnerEmail(email)) return true;
  const normalized = email.trim().toLowerCase();
  const admins = getAdminEmails();
  if (admins.length) return admins.includes(normalized);
  // Small-team default: anyone allowed to sign in when ADMIN_EMAILS is unset.
  const allowed = parseEmailList(process.env.ALLOWED_EMAILS);
  return allowed.includes(normalized);
}

export function requireAdminEmail(email: string | null | undefined): void {
  if (!isAdminEmail(email)) {
    throw new Error(
      "Only firm admins can perform this action. Add your Google sign-in email to ADMIN_EMAILS in server settings."
    );
  }
}

/** Admins who can add or edit associate lawyers and payroll staff on Accounts → Payroll. */
export function getTeamRosterAdminEmails(): string[] {
  return uniqueEmails([
    ...FIRM_OWNER_EMAILS,
    ...getAdminEmails(),
    ...parseEmailList(process.env.TEAM_ROSTER_ADMIN_EMAILS)
  ]);
}

export function canManageTeamRoster(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isFirmOwnerEmail(email)) return true;
  const normalized = email.trim().toLowerCase();
  return getTeamRosterAdminEmails().includes(normalized);
}

export function requireTeamRosterAdmin(email: string | null | undefined): void {
  if (!canManageTeamRoster(email)) {
    throw new Error(
      "Only firm admins can manage associate lawyers and payroll staff. Add your Google sign-in email to ADMIN_EMAILS or TEAM_ROSTER_ADMIN_EMAILS in server settings."
    );
  }
}

/**
 * Delete notarizations — only emails listed in ADMIN_EMAILS (not all ALLOWED_EMAILS).
 * When ADMIN_EMAILS is unset, falls back to isAdminEmail for small-team setups.
 */
export function canDeleteNotarizations(email: string | null | undefined): boolean {
  if (!email) return false;
  if (canEditDeskBilling(email)) return true;
  const normalized = email.trim().toLowerCase();
  const admins = getAdminEmails();
  if (admins.length) return admins.includes(normalized);
  return isAdminEmail(email);
}

export function requireNotarizationManage(email: string | null | undefined): void {
  if (!canDeleteNotarizations(email)) {
    throw new Error(
      "Only firm admins and desk editors can edit or delete notarizations."
    );
  }
}

/** @deprecated Use requireNotarizationManage */
export function requireNotarizationDeleteAdmin(email: string | null | undefined): void {
  requireNotarizationManage(email);
}
