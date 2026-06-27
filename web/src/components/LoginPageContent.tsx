"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FirmAuthShell } from "@/components/FirmAuthShell";
import { FirmPublicContactDetails } from "@/components/FirmPublicContactDetails";
import { GoogleMark } from "@/components/login/GoogleMark";
import { STAFF_GOOGLE_PROVIDER_ID } from "@/lib/guest-oauth";
import {
  clearLastSignInHint,
  maskEmail,
  readLastSignInHint,
  type LastSignInHint
} from "@/lib/login-session-hint";

const AUTH_ERRORS: Record<string, string> = {
  AccessDenied:
    "This Google account is not authorized. Ask your office administrator to add your email.",
  Configuration:
    "Sign-in is not set up. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXTAUTH_SECRET in web/.env.local, then restart the dev server.",
  OAuthSignin: "Could not start Google sign-in. Try again.",
  OAuthCallback: "Google sign-in did not complete. Try again.",
  Default: "Sign-in failed. Please try again."
};

type Props = {
  defaultChooseAccount?: boolean;
  oauthConfigured?: boolean;
};

export function LoginPageContent({ defaultChooseAccount = false, oauthConfigured = true }: Props) {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/auth/continue";
  const [lastHint, setLastHint] = useState<LastSignInHint | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLastHint(readLastSignInHint());
  }, []);

  useEffect(() => {
    if (defaultChooseAccount || searchParams.get("chooseAccount") === "1") {
      clearLastSignInHint();
      setLastHint(null);
    }
  }, [defaultChooseAccount, searchParams]);

  const errorMessage = useMemo(() => {
    if (!oauthConfigured) {
      return AUTH_ERRORS.Configuration;
    }
    if (!errorCode) return null;
    return AUTH_ERRORS[errorCode] ?? AUTH_ERRORS.Default;
  }, [errorCode, oauthConfigured]);

  async function handleSignIn(chooseAccount = false) {
    setSubmitting(true);
    try {
      if (chooseAccount) {
        await signIn(STAFF_GOOGLE_PROVIDER_ID, { callbackUrl }, { prompt: "select_account" });
      } else {
        await signIn(STAFF_GOOGLE_PROVIDER_ID, { callbackUrl });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const ctaLabel = submitting
    ? "Opening Google…"
    : lastHint
      ? "Continue"
      : "Continue with Google";

  return (
    <FirmAuthShell variant="login">
      <div className="login-page__body">
        {errorMessage ? (
          <div className="login-page__alert" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <header className="login-page__head">
          <p className="login-page__eyebrow">Staff access</p>
          <p className="login-page__subtitle">Firm Google account required.</p>
        </header>

        {lastHint ? (
          <p className="login-page__session">
            Signed in last as <span>{maskEmail(lastHint.email)}</span>
          </p>
        ) : null}

        <button
          type="button"
          className="login-page__cta"
          disabled={submitting || !oauthConfigured}
          onClick={() => void handleSignIn()}
        >
          <GoogleMark className="login-page__cta-icon" />
          <span>{ctaLabel}</span>
        </button>

        <button
          type="button"
          className="login-page__alt"
          disabled={submitting}
          onClick={() => {
            clearLastSignInHint();
            setLastHint(null);
            void handleSignIn(true);
          }}
        >
          Use a different account
        </button>
      </div>

      <footer className="login-page__footer">
        <FirmPublicContactDetails className="login-page__contact" layout="stacked" />
        <div className="login-page__footer-links">
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </FirmAuthShell>
  );
}
