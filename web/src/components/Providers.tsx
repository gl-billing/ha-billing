"use client";

import type { Session } from "next-auth";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { PwaInstallBanner, PwaRegister, PwaWrongHomeScreenHint } from "@/components/PwaInstall";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ContentProtectionProvider } from "@/components/ContentProtectionProvider";
import { LayoutModeProvider } from "@/components/LayoutModeProvider";
import type { LayoutMode } from "@/lib/layout-mode-prefs";

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
  session,
  serverLayoutMode
}: {
  children: React.ReactNode;
  session?: Session | null;
  serverLayoutMode?: LayoutMode;
}) {
  return (
    <SessionProvider session={session}>
      <LayoutModeProvider serverLayoutMode={serverLayoutMode}>
        <PwaRegister />
        <PwaWrongHomeScreenHint />
        <OfflineBanner />
        <SessionGuard>{children}</SessionGuard>
        <ContentProtectionProvider />
        <PwaInstallBanner />
      </LayoutModeProvider>
    </SessionProvider>
  );
}
