"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { LoginAuthStatus } from "@/components/login/MobileLoginPage";
import { clearLastSignInHint } from "@/lib/login-session-hint";

type Props = {
  initialIsPhone?: boolean;
};

/** Signs out and returns to login with Google account picker enabled. */
export function SwitchAccountClient({ initialIsPhone = false }: Props) {
  useEffect(() => {
    clearLastSignInHint();
    void signOut({ callbackUrl: "/login?chooseAccount=1" });
  }, []);

  return (
    <LoginAuthStatus message="Switching Google account…" layout={initialIsPhone ? "mobile" : "desktop"} />
  );
}
