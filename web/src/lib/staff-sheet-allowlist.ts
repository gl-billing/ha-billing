import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { allowlistHasEmail } from "@/lib/email-allowlist";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";

const CACHE_TTL_MS = 60_000;
const FAILURE_TTL_MS = 15_000;

let cache: { emails: string[]; expiresAt: number } | null = null;

export function invalidateSheetStaffAllowlist(): void {
  cache = null;
}

export async function getActiveSheetStaffEmails(): Promise<string[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.emails;

  const token = await getCronGoogleAccessToken().catch(() => null);
  if (!token) {
    cache = { emails: cache?.emails ?? [], expiresAt: now + FAILURE_TTL_MS };
    return cache.emails;
  }

  try {
    const directory = await getEmployeeDirectory(token);
    const emails = directory.map((row) => row.email.trim()).filter(Boolean);
    cache = { emails, expiresAt: now + CACHE_TTL_MS };
    return emails;
  } catch {
    cache = { emails: cache?.emails ?? [], expiresAt: now + FAILURE_TTL_MS };
    return cache.emails;
  }
}

/** Active Employees-sheet emails may sign in without ALLOWED_EMAILS / owner approval. */
export async function isActiveSheetStaffEmail(email: string | null | undefined): Promise<boolean> {
  if (!email?.trim()) return false;
  const emails = await getActiveSheetStaffEmails();
  return allowlistHasEmail(emails, email);
}
