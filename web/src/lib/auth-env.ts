/** Server-only checks for NextAuth / Google OAuth configuration. */

const PLACEHOLDER_NEXTAUTH_SECRET = "generate-a-long-random-string";

export function getGoogleOAuthConfig(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || ""
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  return Boolean(clientId && clientSecret);
}

export function getNextAuthSecret(): string {
  return process.env.NEXTAUTH_SECRET?.trim() || "";
}

export function isNextAuthSecretConfigured(): boolean {
  const secret = getNextAuthSecret();
  return Boolean(secret && secret !== PLACEHOLDER_NEXTAUTH_SECRET);
}

export function assertGoogleOAuthConfigured(): void {
  if (!isGoogleOAuthConfigured()) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in web/.env.local (from Google Cloud Console), then restart the dev server."
    );
  }
}

export function assertNextAuthSecretConfigured(): void {
  if (!isNextAuthSecretConfigured()) {
    throw new Error(
      "NEXTAUTH_SECRET is not configured. Set a long random string in web/.env.local (run: openssl rand -base64 32), then restart the dev server."
    );
  }
}
