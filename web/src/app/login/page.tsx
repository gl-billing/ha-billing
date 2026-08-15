import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { LoginPageContent } from "@/components/LoginPageContent";
import { SwitchAccountClient } from "@/components/login/SwitchAccountClient";
import { LoginAuthStatus } from "@/components/login/MobileLoginPage";
import { isGoogleOAuthConfigured, isNextAuthSecretConfigured } from "@/lib/auth-env";
import { resolvePostLoginPath } from "@/lib/app-access";
import { isPhoneUserAgent } from "@/lib/layout-mode-prefs";

type Props = {
  searchParams: Promise<{ switch?: string; chooseAccount?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSafeServerSession();
  const params = await searchParams;
  const switching = params.switch === "1";
  const chooseAccount = params.chooseAccount === "1";
  const initialIsPhone = isPhoneUserAgent((await headers()).get("user-agent"));
  const fallback = <LoginAuthStatus message="Loading…" layout={initialIsPhone ? "mobile" : "pending"} />;

  if (session?.user?.email && switching) {
    return (
      <Suspense fallback={fallback}>
        <SwitchAccountClient initialIsPhone={initialIsPhone} />
      </Suspense>
    );
  }

  if (session?.user?.email) {
    const destination = resolvePostLoginPath(session.user.email);
    // Denied accounts must not redirect back to /login (infinite 307 loop).
    if (!destination.startsWith("/login")) {
      redirect(destination);
    }
  }

  return (
    <Suspense fallback={fallback}>
      <LoginPageContent
        defaultChooseAccount={chooseAccount || Boolean(session?.user?.email)}
        oauthConfigured={isGoogleOAuthConfigured() && isNextAuthSecretConfigured()}
        initialIsPhone={initialIsPhone}
      />
    </Suspense>
  );
}
