import { FIRM_NAME } from "@/lib/billing-document-design";
import { FIRM_INBOX_EMAIL } from "@/lib/firm-team-config";

function normalizeEmailAddress(raw: string): string {
  const trimmed = String(raw || "").trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle ? angle[1] : trimmed).trim().toLowerCase();
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Default when no signed-in sender is available (e.g. cron). */
export const DEFAULT_FIRM_SENDER_EMAIL = FIRM_INBOX_EMAIL;

function settingsMap(settings?: Map<string, string> | Record<string, string>): Map<string, string> | null {
  if (!settings) return null;
  if (settings instanceof Map) return settings;
  return new Map(Object.entries(settings));
}

/**
 * Fallback From address for unattended sends (cron / digest).
 * Interactive Gmail sends use the signed-in mailbox instead.
 */
export function resolveFirmSenderEmail(settings?: Map<string, string> | Record<string, string>): string {
  const map = settingsMap(settings);
  const fromSettings = map?.get("Firm Sender Email")?.trim();
  if (fromSettings) {
    const email = normalizeEmailAddress(fromSettings);
    if (isValidEmailAddress(email)) return email;
  }

  const env = process.env.FIRM_SENDER_EMAIL?.trim();
  if (env) {
    const email = normalizeEmailAddress(env);
    if (isValidEmailAddress(email)) return email;
  }

  return DEFAULT_FIRM_SENDER_EMAIL;
}

export function resolveFirmSenderDisplayName(settings?: Map<string, string> | Record<string, string>): string {
  const map = settingsMap(settings);
  const fromSettings = map?.get("Firm Name")?.trim();
  if (fromSettings) return fromSettings;

  const env = process.env.FIRM_SENDER_NAME?.trim();
  if (env) return env;

  return FIRM_NAME;
}

/** RFC 5322 From header for a specific mailbox (usually the signed-in sender). */
export function formatOutboundFrom(
  email: string,
  settings?: Map<string, string> | Record<string, string>
): string {
  const address = normalizeEmailAddress(email);
  if (!isValidEmailAddress(address)) {
    throw new Error(`Invalid From email: ${email}`);
  }
  const name = resolveFirmSenderDisplayName(settings).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${name}" <${address}>`;
}

/** Fallback From for cron when no actor mailbox is known. */
export function formatFirmOutboundFrom(settings?: Map<string, string> | Record<string, string>): string {
  return formatOutboundFrom(resolveFirmSenderEmail(settings), settings);
}
