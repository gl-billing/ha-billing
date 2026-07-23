import type { Session } from "next-auth";

/** Display name for audit / activity log rows (who performed the action). */
export function sessionAuditUser(session: Session | null | undefined): string {
  const user = session?.user;
  return (
    String(user?.displayName || "").trim() ||
    String(user?.name || "").trim() ||
    String(user?.email || "").trim() ||
    "staff"
  );
}
