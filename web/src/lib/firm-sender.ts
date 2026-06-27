import { FIRM_NAME } from "@/lib/billing-document-design";

function normalizeEmailAddress(raw: string): string {
  const trimmed = String(raw || "").trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle ? angle[1] : trimmed).trim().toLowerCase();
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

import { FIRM_INBOX_EMAIL } from "@/lib/firm-team-config";

export const DEFAULT_FIRM_SENDER_EMAIL = FIRM_INBOX_EMAIL;

const FIRM_SENDER_SETTINGS_KEYS = ["Firm Email", "Sender Email", "Billing From Email"] as const;

function settingsMap(settings?: Map<string, string> | Record<string, string>): Map<string, string> | null {
  if (!settings) return null;
  if (settings instanceof Map) return settings;
  return new Map(Object.entries(settings));
}

/** Plain firm outbound address (recipient-visible From). */
export function resolveFirmSenderEmail(settings?: Map<string, string> | Record<string, string>): string {
  const map = settingsMap(settings);
  for (const key of FIRM_SENDER_SETTINGS_KEYS) {
    const value = map?.get(key)?.trim();
    if (!value) continue;
    const email = normalizeEmailAddress(value);
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

/** RFC 5322 From header for outbound client mail. */
export function formatFirmOutboundFrom(settings?: Map<string, string> | Record<string, string>): string {
  const email = resolveFirmSenderEmail(settings);
  const name = resolveFirmSenderDisplayName(settings).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${name}" <${email}>`;
}
