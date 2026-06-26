"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveLastSignInHint } from "@/lib/login-session-hint";

type Props = {
  email: string;
  authProvider: string;
  destination: string;
};

export function AuthContinueClient({ email, authProvider, destination }: Props) {
  const router = useRouter();

  useEffect(() => {
    saveLastSignInHint({ email, provider: authProvider });
    router.replace(destination);
  }, [authProvider, destination, email, router]);

  return (
    <div className="page-loading">
      <p className="page-loading__title">Welcome back…</p>
    </div>
  );
}
