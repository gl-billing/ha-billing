import { canEditDeskBilling } from "@/lib/app-access";

function parseEmailList(raw: string | undefined): string[] {
  return raw?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
}

/** Comma-separated in ADMIN_EMAILS — firm admins (client admin, announcements, etc.). */
export function getAdminEmails(): string[] {
  return parseEmailList(process.env.ADMIN_EMAILS);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
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
