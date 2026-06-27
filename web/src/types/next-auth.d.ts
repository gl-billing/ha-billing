import type { DefaultSession } from "next-auth";
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    authProvider?: string;
    user?: DefaultSession["user"] & {
      displayName?: string;
      billingAccess?: boolean;
      isAdmin?: boolean;
      canManageTeamRoster?: boolean;
      secretaryNav?: boolean;
      deskBillingEdit?: boolean;
      officeAccess?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: string;
    errorMessage?: string;
    officeAccess?: boolean;
    isAdmin?: boolean;
    canManageTeamRoster?: boolean;
    authProvider?: string;
  }
}
