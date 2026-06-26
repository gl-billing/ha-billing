"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { clearLastSignInHint } from "@/lib/login-session-hint";

/** Signs out and returns to login with Google account picker enabled. */
export function SwitchAccountClient() {
  useEffect(() => {
    clearLastSignInHint();
    void signOut({ callbackUrl: "/login?chooseAccount=1" });
  }, []);

  return (
    <div className="page-loading">
      <p className="page-loading__title">Switching Google account…</p>
    </div>
  );
}
