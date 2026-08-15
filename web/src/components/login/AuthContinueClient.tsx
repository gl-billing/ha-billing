"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginAuthStatus } from "@/components/login/MobileLoginPage";
import { saveLastSignInHint } from "@/lib/login-session-hint";

type Props = {
  email: string;
  authProvider: string;
  destination: string;
  initialIsPhone?: boolean;
};

export function AuthContinueClient({
  email,
  authProvider,
  destination,
  initialIsPhone = false
}: Props) {
  const router = useRouter();

  useEffect(() => {
    saveLastSignInHint({ email, provider: authProvider });
    router.replace(destination);
  }, [authProvider, destination, email, router]);

  return <LoginAuthStatus message="Welcome back…" layout={initialIsPhone ? "mobile" : "desktop"} />;
}
