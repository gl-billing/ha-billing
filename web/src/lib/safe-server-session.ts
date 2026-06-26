import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isNextAuthSecretConfigured } from "@/lib/auth-env";

/** Avoid 500s when NEXTAUTH_SECRET changed or the session cookie is stale. */
export async function getSafeServerSession(): Promise<Session | null> {
  if (!isNextAuthSecretConfigured()) return null;
  try {
    return (await getServerSession(authOptions)) ?? null;
  } catch {
    return null;
  }
}
