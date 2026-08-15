"use client";

import { useLayoutEffect, useState } from "react";
import {
  initialLoginLayout,
  LOGIN_MOBILE_MQ,
  resolveClientLoginLayout,
  type LoginLayoutMode
} from "@/lib/login-mobile";

/**
 * Login-only viewport. Phone UA paints mobile immediately.
 * Unknown devices stay pending until matchMedia resolves — never the desktop landing.
 */
export function useLoginMobileLayout(initialIsPhone = false): LoginLayoutMode {
  const [layout, setLayout] = useState<LoginLayoutMode>(() => initialLoginLayout(initialIsPhone));

  useLayoutEffect(() => {
    const compute = (): Exclude<LoginLayoutMode, "pending"> => {
      let matches = false;
      try {
        matches = window.matchMedia(LOGIN_MOBILE_MQ).matches;
      } catch {
        matches = false;
      }
      return resolveClientLoginLayout({
        userAgent: navigator.userAgent,
        width: window.innerWidth || 0,
        matchMediaMatches: matches
      });
    };

    const apply = () => setLayout(compute());
    apply();

    const mq = window.matchMedia(LOGIN_MOBILE_MQ);
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  return layout;
}
