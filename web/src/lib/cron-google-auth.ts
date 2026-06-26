/**
 * Google access for Vercel cron jobs (Sheets + Gmail) without a signed-in user.
 * Prefer CRON_GOOGLE_REFRESH_TOKEN — access tokens from OAuth Playground expire in ~1 hour.
 */

export const CRON_GOOGLE_TOKEN_HINT =
  "Set CRON_GOOGLE_REFRESH_TOKEN (recommended) or CRON_GOOGLE_ACCESS_TOKEN on Vercel, or send greetings manually from the client matter page.";

/** Strip accidental JSON / Bearer prefix from OAuth Playground copy-paste. */
export function normalizeCronGoogleCredential(
  raw: string | undefined,
  field: "access_token" | "refresh_token"
): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const fromField = String(parsed[field] ?? "").trim();
      if (fromField) return normalizeCronGoogleCredential(fromField, field);
      const other = field === "access_token" ? "refresh_token" : "access_token";
      const fallback = String(parsed[other] ?? "").trim();
      if (fallback) return normalizeCronGoogleCredential(fallback, other);
    } catch {
      /* use raw text below */
    }
  }

  const firstLine = text.split(/\r?\n/)[0]?.trim() || "";
  const withoutBearer = firstLine.replace(/^Bearer\s+/i, "").trim();
  if (!withoutBearer || /[\r\n"]/.test(withoutBearer)) return null;
  return withoutBearer;
}

async function refreshCronAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to refresh CRON_GOOGLE_REFRESH_TOKEN.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Cron Google token refresh failed.");
  }

  return data.access_token;
}

/** Firm Google access token for cron — refresh token preferred, static access token as fallback. */
export async function getCronGoogleAccessToken(): Promise<string | null> {
  const refreshToken = normalizeCronGoogleCredential(
    process.env.CRON_GOOGLE_REFRESH_TOKEN,
    "refresh_token"
  );
  if (refreshToken) {
    return refreshCronAccessToken(refreshToken);
  }

  return normalizeCronGoogleCredential(process.env.CRON_GOOGLE_ACCESS_TOKEN, "access_token");
}
