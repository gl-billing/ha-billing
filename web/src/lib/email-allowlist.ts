/** Gmail ignores dots in the local part; OAuth still returns the registered spelling. */
function canonicalizeGmailDomain(domain: string): string {
  return domain === "googlemail.com" ? "gmail.com" : domain;
}

/** Lowercase + Gmail dot-insensitive form for allowlist comparisons. */
export function normalizeAllowlistEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;
  let local = trimmed.slice(0, at);
  const domain = canonicalizeGmailDomain(trimmed.slice(at + 1));
  if (domain === "gmail.com") {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeAllowlistEmail(a) === normalizeAllowlistEmail(b);
}

export function allowlistHasEmail(
  list: readonly string[] | null | undefined,
  email: string | null | undefined
): boolean {
  if (!email || !list?.length) return false;
  const needle = normalizeAllowlistEmail(email);
  return list.some((item) => item.trim() && normalizeAllowlistEmail(item) === needle);
}

export function uniqueNormalizedEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of emails) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    const key = normalizeAllowlistEmail(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed.toLowerCase());
  }
  return result;
}
