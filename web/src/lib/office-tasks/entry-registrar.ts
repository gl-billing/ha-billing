import type { Session } from "next-auth";

export function sessionEntryRegistrarLabel(session: Session | null | undefined): string {
  const user = session?.user;
  return (
    String(user?.displayName || "").trim() ||
    String(user?.name || "").trim() ||
    String(user?.email || "").trim() ||
    "Unknown user"
  );
}
