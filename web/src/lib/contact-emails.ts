import { isValidEmailAddress } from "@/lib/email-utils";

const CONTACT_EMAIL_SEPARATOR = "; ";

/** Split a stored contact email cell into individual addresses. */
export function parseContactEmails(value: string): string[] {
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const part of String(value || "").split(/[;,]/)) {
    const email = part.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(email);
  }
  return parsed;
}

/** Serialize contact emails for Master List / walk-in sheets. */
export function formatContactEmails(emails: string[]): string {
  return parseContactEmails(emails.join("; ")).join(CONTACT_EMAIL_SEPARATOR);
}

export function contactEmailsToFieldValue(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    if (!value.length) return [""];
    return value;
  }
  const normalized = parseContactEmails(value);
  return normalized.length ? normalized : [""];
}

/** Keep in-progress empty rows when parent state has not caught up yet. */
export function mergeContactEmailFieldRows(current: string[], incoming: string[] | string): string[] {
  const next = contactEmailsToFieldValue(incoming);
  if (next.length >= current.length) return next;
  const prefixMatches = next.every((value, index) => value === current[index]);
  if (prefixMatches && current.length > next.length) return current;
  return next;
}

export function hasAnyContactEmail(emails: string[]): boolean {
  return parseContactEmails(emails.join("; ")).length > 0;
}

export function hasValidContactEmail(emails: string[]): boolean {
  return parseContactEmails(emails.join("; ")).some((email) => isValidEmailAddress(email));
}

/** First valid email — used when a single recipient is required. */
export function primaryContactEmail(emails: string[] | string): string {
  const list = Array.isArray(emails) ? parseContactEmails(emails.join("; ")) : parseContactEmails(emails);
  return list.find((email) => isValidEmailAddress(email)) || list[0] || "";
}
