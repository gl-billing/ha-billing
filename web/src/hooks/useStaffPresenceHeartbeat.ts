"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { PresenceWorkspace } from "@/lib/staff-presence";

const HEARTBEAT_MS = 90_000;

type Options = {
  workspace: PresenceWorkspace;
  enabled?: boolean;
};

/** Quietly reports that this signed-in user has the app open. */
export function useStaffPresenceHeartbeat({ workspace, enabled = true }: Options) {
  const pathname = usePathname();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const send = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastSent.current < 45_000) return;
      lastSent.current = now;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          path: pathname || window.location.pathname || "/"
        })
      }).catch(() => undefined);
    };

    send();
    const timer = window.setInterval(send, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pathname, workspace]);
}
