"use client";

import type { Session } from "next-auth";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { PwaInstallBanner, PwaRegister, PwaWrongHomeScreenHint } from "@/components/PwaInstall";
import { OfflineBanner } from "@/components/OfflineBanner";

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  if (session?.error === "RefreshAccessTokenError") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-bold text-ink">Session expired</h1>
        <p className="mt-2 text-sm text-muted">
          Your Google sign-in expired. Sign in again to access the billing spreadsheet.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-primary mt-4"
        >
          Sign in again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function Providers({
  children,
  session
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <PwaRegister />
      <PwaWrongHomeScreenHint />
      <OfflineBanner />
      <SessionGuard>{children}</SessionGuard>
      <PwaInstallBanner />
    </SessionProvider>
  );
}
