"use client";

import { useContext } from "react";
import type { Session } from "next-auth";
import { SessionContext } from "next-auth/react";

type SessionContextValue = {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
  update: (data?: unknown) => Promise<Session | null>;
};

const UNAUTHENTICATED: SessionContextValue = {
  data: null,
  status: "unauthenticated",
  update: async () => null
};

/** Like useSession but does not throw when SessionProvider is missing (e.g. error boundaries, partial renders). Use in shared chrome; keep useSession on pages that require auth. */
export function useOptionalSession(): SessionContextValue {
  const context = useContext(SessionContext);
  return context ?? UNAUTHENTICATED;
}
