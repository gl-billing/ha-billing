import { readBrowserStorage, removeBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

const EMAIL_KEY = "ha-office-last-email";
const LEGACY_EMAIL_KEY = "gl-office-last-email";
const PROVIDER_KEY = "ha-office-last-provider";
const LEGACY_PROVIDER_KEY = "gl-office-last-provider";

export type LastSignInHint = {
  email: string;
  provider: string;
};

export function readLastSignInHint(): LastSignInHint | null {
  const email = readBrowserStorage(EMAIL_KEY, LEGACY_EMAIL_KEY)?.trim();
  const provider = readBrowserStorage(PROVIDER_KEY, LEGACY_PROVIDER_KEY)?.trim();
  if (!email || !provider) return null;
  return { email, provider };
}

export function saveLastSignInHint(hint: LastSignInHint): void {
  writeBrowserStorage(EMAIL_KEY, hint.email.trim(), LEGACY_EMAIL_KEY);
  writeBrowserStorage(PROVIDER_KEY, hint.provider.trim(), LEGACY_PROVIDER_KEY);
}

export function clearLastSignInHint(): void {
  removeBrowserStorage(EMAIL_KEY, LEGACY_EMAIL_KEY);
  removeBrowserStorage(PROVIDER_KEY, LEGACY_PROVIDER_KEY);
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return trimmed;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return trimmed;

  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
