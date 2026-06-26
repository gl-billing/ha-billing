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
    authProvider?: string;
  }
}
