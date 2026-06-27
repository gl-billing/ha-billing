import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import {
  canAccessBilling,
  canEditDeskBilling,
  isSecretaryNavUser,
  isStaffEmail,
  resolveStaffSignIn
} from "@/lib/app-access";
import { canManageTeamRoster, isAdminEmail } from "@/lib/admin";
import { STAFF_GOOGLE_PROVIDER_ID } from "@/lib/guest-oauth";
import { getGoogleOAuthConfig, getNextAuthSecret, isGoogleOAuthConfigured } from "@/lib/auth-env";
import { formatStaffDisplayName } from "@/lib/user-display";

const STAFF_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar"
].join(" ");

function staffGoogleClient(): { clientId: string; clientSecret: string } {
  return getGoogleOAuthConfig();
}

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      throw new Error("Missing refresh token. Sign out and sign in again.");
    }

    const { clientId, clientSecret } = staffGoogleClient();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: String(token.refreshToken)
      })
    });

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !refreshed.access_token) {
      throw new Error(refreshed.error_description || refreshed.error || "Token refresh failed.");
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + (refreshed.expires_in || 3600) * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined
    };
  } catch (error) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
      errorMessage: error instanceof Error ? error.message : "Token refresh failed."
    };
  }
}

const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() ?? "";

function isUnreachableAuthHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    hostname.endsWith(".local")
  );
}

export const authOptions: NextAuthOptions = {
  useSecureCookies: nextAuthUrl.startsWith("https://"),
  providers: isGoogleOAuthConfigured()
    ? [
        GoogleProvider({
          id: STAFF_GOOGLE_PROVIDER_ID,
          name: "Google",
          clientId: staffGoogleClient().clientId,
          clientSecret: staffGoogleClient().clientSecret,
          authorization: {
            params: {
              scope: STAFF_SCOPES,
              prompt: "consent",
              access_type: "offline",
              response_type: "code"
            }
          }
        })
      ]
    : [],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const base = baseUrl.replace(/\/$/, "");

      if (url.startsWith("/")) {
        return `${base}${url}`;
      }

      try {
        const target = new URL(url);
        if (isUnreachableAuthHost(target.hostname)) {
          return `${base}${target.pathname}${target.search}${target.hash}`;
        }
        if (url.startsWith(base)) return url;
        const baseOrigin = new URL(base).origin;
        if (target.origin === baseOrigin) return url;
      } catch {
        return `${base}/auth/continue`;
      }

      return `${base}/auth/continue`;
    },
    async signIn({ user, account }) {
      return resolveStaffSignIn(user.email, account?.provider);
    },
    async jwt({ token, account, user }) {
      const email =
        user?.email ?? (typeof token.email === "string" ? token.email.trim() : "");
      if (email) {
        token.officeAccess = isStaffEmail(email);
        token.isAdmin = isAdminEmail(email);
        token.canManageTeamRoster = canManageTeamRoster(email);
      }

      if (account) {
        token.authProvider = account.provider;
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          refreshToken: account.refresh_token ?? token.refreshToken
        };
      }

      if (!token.refreshToken) {
        return token;
      }

      if (token.accessTokenExpires && Date.now() < Number(token.accessTokenExpires) - 60_000) {
        return token;
      }

      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      session.authProvider = typeof token.authProvider === "string" ? token.authProvider : undefined;
      if (session.user) {
        session.user.displayName = formatStaffDisplayName(session.user.name, session.user.email);
        session.user.billingAccess = canAccessBilling(session.user.email);
        session.user.isAdmin = isAdminEmail(session.user.email);
        session.user.canManageTeamRoster = canManageTeamRoster(session.user.email);
        session.user.secretaryNav =
          session.user.billingAccess === true && isSecretaryNavUser(session.user.email);
        session.user.deskBillingEdit =
          session.user.billingAccess === true && canEditDeskBilling(session.user.email);
        session.user.officeAccess =
          typeof token.officeAccess === "boolean" ? token.officeAccess : isStaffEmail(session.user.email);
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  secret: getNextAuthSecret() || undefined
};
