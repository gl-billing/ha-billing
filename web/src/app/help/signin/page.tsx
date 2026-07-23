import { Suspense } from "react";
import { SignInHelpClient } from "@/components/SignInHelpClient";
import { FirmAuthShell } from "@/components/FirmAuthShell";

export const metadata = {
  title: "Sign-in help"
};

/** Calm help page — silently records a staff sign-in issue for admins. */
export default function SignInHelpPage() {
  return (
    <FirmAuthShell variant="login">
      <Suspense
        fallback={
          <div className="login-page__body">
            <p className="login-page__subtitle">One moment…</p>
          </div>
        }
      >
        <SignInHelpClient />
      </Suspense>
    </FirmAuthShell>
  );
}
