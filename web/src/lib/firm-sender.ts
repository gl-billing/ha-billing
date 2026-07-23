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

/** Always the firm inbox — never a personal staff Gmail. */
export const DEFAULT_FIRM_SENDER_EMAIL = FIRM_INBOX_EMAIL;

function settingsMap(settings?: Map<string, string> | Record<string, string>): Map<string, string> | null {
  if (!settings) return null;
  if (settings instanceof Map) return settings;
  return new Map(Object.entries(settings));
}

/**
 * Recipient-visible From address.
 * HA always sends as legal@hernandezlaw.info (same idea as GL’s firm inbox),
 * even if Settings / env accidentally point at a personal Gmail.
 */
export function resolveFirmSenderEmail(_settings?: Map<string, string> | Record<string, string>): string {
  const env = process.env.FIRM_SENDER_EMAIL?.trim();
  if (env) {
    const email = normalizeEmailAddress(env);
    // Only allow the firm inbox or another @hernandezlaw.info address — never @gmail.com staff mail.
    if (isValidEmailAddress(email) && (email === DEFAULT_FIRM_SENDER_EMAIL || email.endsWith("@hernandezlaw.info"))) {
      return email;
    }
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

/** RFC 5322 From header for outbound client mail. */
export function formatFirmOutboundFrom(settings?: Map<string, string> | Record<string, string>): string {
  const email = resolveFirmSenderEmail(settings);
  const name = resolveFirmSenderDisplayName(settings).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${name}" <${email}>`;
}
