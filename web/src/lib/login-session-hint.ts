const EMAIL_KEY = "gl-office-last-email";
const PROVIDER_KEY = "gl-office-last-provider";

export type LastSignInHint = {
  email: string;
  provider: string;
};

export function readLastSignInHint(): LastSignInHint | null {
  if (typeof window === "undefined") return null;

  try {
    const email = window.localStorage.getItem(EMAIL_KEY)?.trim();
    const provider = window.localStorage.getItem(PROVIDER_KEY)?.trim();
    if (!email || !provider) return null;
    return { email, provider };
  } catch {
    return null;
  }
}

export function saveLastSignInHint(hint: LastSignInHint): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(EMAIL_KEY, hint.email.trim());
    window.localStorage.setItem(PROVIDER_KEY, hint.provider.trim());
  } catch {
    /* private browsing / storage full */
  }
}

export function clearLastSignInHint(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(EMAIL_KEY);
    window.localStorage.removeItem(PROVIDER_KEY);
  } catch {
    /* private browsing */
  }
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
