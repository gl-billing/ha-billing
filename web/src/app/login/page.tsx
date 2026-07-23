import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { LoginPageContent } from "@/components/LoginPageContent";
import { SwitchAccountClient } from "@/components/login/SwitchAccountClient";
import { isGoogleOAuthConfigured, isNextAuthSecretConfigured } from "@/lib/auth-env";
import { resolvePostLoginPath } from "@/lib/app-access";

type Props = {
  searchParams: Promise<{ switch?: string; chooseAccount?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSafeServerSession();
  const params = await searchParams;
  const switching = params.switch === "1";
  const chooseAccount = params.chooseAccount === "1";

  if (session?.user?.email && switching) {
    return (
      <Suspense
        fallback={
          <div className="page-loading">
            <p className="page-loading__title">Loading…</p>
          </div>
        }
      >
        <SwitchAccountClient />
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
    <Suspense
      fallback={
        <div className="page-loading">
          <p className="page-loading__title">Loading…</p>
        </div>
      }
    >
      <LoginPageContent
        defaultChooseAccount={chooseAccount || Boolean(session?.user?.email)}
        oauthConfigured={isGoogleOAuthConfigured() && isNextAuthSecretConfigured()}
      />
    </Suspense>
  );
}
