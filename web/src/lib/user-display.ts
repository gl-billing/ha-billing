/** Display name for header / Office Hub greeting. */

import { DEFAULT_FIRM_SENDER_EMAIL } from "@/lib/firm-sender";

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

const displayNameByEmail = parseDisplayNameMap();

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function greetingFromProfile(name: string, email: string): string | null {
  const firmInbox = DEFAULT_FIRM_SENDER_EMAIL.toLowerCase();
  if (email === firmInbox) {
    return "Admin";
  }

  return null;
}

export function formatStaffDisplayName(
  name?: string | null,
  email?: string | null
): string {
  const emailKey = email?.trim().toLowerCase();
  if (emailKey === DEFAULT_FIRM_SENDER_EMAIL.toLowerCase()) {
    return "Admin";
  }

  if (emailKey && displayNameByEmail.has(emailKey)) {
    return displayNameByEmail.get(emailKey)!;
  }

  const profileName = name?.trim();
  if (profileName && emailKey) {
    const greeting = greetingFromProfile(profileName, emailKey);
    if (greeting) return greeting;
  }

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
