import { requireBillingAccess } from "@/lib/app-access";
import { isAdminEmail } from "@/lib/admin";
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

/** Email for audit logs — call only after a require*AccessToken() gate. */
export async function sessionAuditEmail(): Promise<string> {
  const session = await getSafeServerSession();
  return session?.user?.email?.trim() || "unknown";
}

/** Staff session + Google token + admin role (tasks maintenance routes). */
export async function requireAdminSessionAccessToken(): Promise<{ token: string; email: string }> {
  const token = await requireSessionAccessToken();
  const session = await getSafeServerSession();
  const email = session?.user?.email?.trim() || "";
  if (!isAdminEmail(email)) {
    throw new Error("Admin only.");
  }
  return { token, email };
}

/** Billing session + Google token + admin role. */
export async function requireAdminBillingAccessToken(): Promise<{ token: string; email: string }> {
  const token = await requireBillingAccessToken();
  const session = await getSafeServerSession();
  const email = session?.user?.email?.trim() || "";
  if (!isAdminEmail(email)) {
    throw new Error("Admin only.");
  }
  return { token, email };
}
