"use client";

import { signIn } from "next-auth/react";
import { GoogleMark } from "@/components/login/GoogleMark";
import { APP_SHORT_NAME, FIRM_COPYRIGHT_HOLDER } from "@/lib/firm-brand";
import { STAFF_GOOGLE_PROVIDER_ID } from "@/lib/guest-oauth";
import {
  clearLastSignInHint,
  maskEmail,
  type LastSignInHint
} from "@/lib/login-session-hint";
import styles from "./mobile-login.module.css";

type Props = {
  errorMessage?: string | null;
  oauthConfigured?: boolean;
  submitting?: boolean;
  lastHint?: LastSignInHint | null;
  callbackUrl: string;
  onHintClear: () => void;
  onSubmitting: (value: boolean) => void;
};

export function MobileLoginPage({
  errorMessage,
  oauthConfigured = true,
  submitting = false,
  lastHint,
  callbackUrl,
  onHintClear,
  onSubmitting
}: Props) {
  async function handleSignIn(chooseAccount = false) {
    onSubmitting(true);
    try {
      if (chooseAccount) {
        await signIn(STAFF_GOOGLE_PROVIDER_ID, { callbackUrl }, { prompt: "select_account" });
      } else {
        await signIn(STAFF_GOOGLE_PROVIDER_ID, { callbackUrl });
      }
    } finally {
      onSubmitting(false);
    }
  }

  const ctaLabel = submitting
    ? "Opening Google…"
    : lastHint
      ? "Continue"
      : "Continue as HA staff";

  return (
    <div className={styles.page} data-ha-login="mobile">
      <div className={styles.stage}>
        <div className={styles.brand}>
          <span className={styles.logoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="" width={72} height={72} className={styles.logo} />
          </span>
          <p className={styles.firmName}>{APP_SHORT_NAME}</p>
          <p className={styles.practice}>{FIRM_COPYRIGHT_HOLDER}</p>
        </div>

        <div className={styles.card}>
          <h1 className={styles.heading}>Staff sign-in</h1>
          <p className={styles.lede}>Use your Hernandez & Associates Google account.</p>

          {errorMessage ? (
            <div className={styles.alert} role="alert">
              <p className={styles.alertBody}>{errorMessage}</p>
            </div>
          ) : null}

          {lastHint ? (
            <p className={styles.note}>
              Last signed in as <span className={styles.accountEmail}>{maskEmail(lastHint.email)}</span>
            </p>
          ) : null}

          <button
            type="button"
            className={styles.primary}
            disabled={submitting || !oauthConfigured}
            onClick={() => void handleSignIn()}
          >
            <GoogleMark className={styles.googleMark} />
            <span className={styles.primaryLabel}>{ctaLabel}</span>
          </button>

          <p className={styles.orRule}>or</p>

          <button
            type="button"
            className={styles.secondary}
            disabled={submitting}
            onClick={() => {
              clearLastSignInHint();
              onHintClear();
              void handleSignIn(true);
            }}
          >
            <span className={styles.secondaryLabel}>Use a different Google account</span>
          </button>
        </div>

        <footer className={styles.footer}>
          <p className={styles.accessNote}>Firm Google account required.</p>
          <div className={styles.legal}>
            <a href="/privacy" className={styles.footerLink}>
              Privacy
            </a>
            <span className={styles.footerSep} aria-hidden>
              ·
            </span>
            <a href="/terms" className={styles.footerLink}>
              Terms
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
