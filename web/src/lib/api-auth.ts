import { requireBillingAccess } from "@/lib/app-access";
import { getSafeServerSession } from "@/lib/safe-server-session";

export async function requireSessionAccessToken(): Promise<string> {
  const session = await getSafeServerSession();

  if (session?.error === "RefreshAccessTokenError") {
    throw new Error("Your Google session expired. Please sign out and sign in again.");
  }

  const token = session?.accessToken;

  if (!token) {
    throw new Error("Unauthorized. Please sign in again.");
  }

  return token;
}

export async function requireBillingAccessToken(): Promise<string> {
  const session = await getSafeServerSession();

  if (session?.error === "RefreshAccessTokenError") {
    throw new Error("Your Google session expired. Please sign out and sign in again.");
  }

  const token = session?.accessToken;
  if (!token) {
    throw new Error("Unauthorized. Please sign in again.");
  }

  requireBillingAccess(session.user?.email);
  return token;
}
