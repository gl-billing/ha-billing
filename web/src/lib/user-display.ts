/** Display name for header / Office Hub greeting. */

function parseDisplayNameMap(): Map<string, string> {
  const raw = process.env.USER_DISPLAY_NAMES?.trim();
  if (!raw) return new Map();

  const map = new Map<string, string>();
  for (const entry of raw.split(",")) {
    const piece = entry.trim();
    if (!piece) continue;
    const sep = piece.indexOf(":");
    if (sep <= 0) continue;
    const email = piece.slice(0, sep).trim().toLowerCase();
    const label = piece.slice(sep + 1).trim();
    if (email && label) map.set(email, label);
  }
  return map;
}

/** Default greeting labels by sign-in email (env USER_DISPLAY_NAMES overrides these). */
const DEFAULT_STAFF_GREETING_BY_EMAIL: Record<string, string> = {
  "atty.rahernandez@gmail.com": "Atty. Robert",
  "rahernandez@gmail.com": "Atty. Robert",
  "jlppasagui@gmail.com": "Atty. Jeff",
  "legal@hernandezlaw.info": "Shiela",
  "lizparreno595@gmail.com": "Atty. April",
  "rahernandez555@gmail.com": "Hiedee",
  "rbr083080@gmail.com": "Raquel"
};

const displayNameByEmail = parseDisplayNameMap();

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function greetingForEmail(emailKey: string): string | null {
  if (displayNameByEmail.has(emailKey)) {
    return displayNameByEmail.get(emailKey)!;
  }
  return DEFAULT_STAFF_GREETING_BY_EMAIL[emailKey] ?? null;
}

export function formatStaffDisplayName(
  name?: string | null,
  email?: string | null
): string {
  const emailKey = email?.trim().toLowerCase();

  if (emailKey) {
    const greeting = greetingForEmail(emailKey);
    if (greeting) return greeting;
  }

  const profileName = name?.trim();
  if (profileName) {
    const first = profileName.split(/\s+/)[0]?.trim();
    if (first) return capitalizeFirst(first);
  }

  if (emailKey) {
    const local = emailKey.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    if (local) return capitalizeFirst(local.split(/\s+/)[0] ?? local);
  }

  return "there";
}
