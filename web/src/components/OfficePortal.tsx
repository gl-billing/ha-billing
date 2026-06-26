"use client";

import { signOut, useSession } from "next-auth/react";
import { FirmAuthShell } from "@/components/FirmAuthShell";
import { FirmContactFooter } from "@/components/FirmContactFooter";
import { HeaderUserBadge } from "@/components/HeaderUserBadge";
import { SameWindowLink } from "@/components/SameWindowLink";
import { firmAppHref } from "@/lib/firm-apps";

export function OfficePortal() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const name = session?.user?.name;
  const displayName = session?.user?.displayName;
  const billingAccess = session?.user?.billingAccess !== false;

  return (
    <FirmAuthShell footer={<FirmContactFooter />}>
      <div className="portal-page">
        <header className="portal-page__header">
          <p className="firm-auth-eyebrow text-center">Welcome back</p>
          <h1 className="firm-auth-title text-center">
            {billingAccess ? "Choose your workspace" : "Your workspace"}
          </h1>
          <p className="firm-auth-subtitle text-center">
            {billingAccess
              ? "Both systems share one sign-in. Choose a workspace below — switch anytime from the header."
              : "Your account has access to the task & calendar system only. Open it below."}
          </p>
          {email ? (
            <div className="portal-signed-in mx-auto max-w-sm text-center">
              <HeaderUserBadge
                name={name}
                email={email}
                displayName={displayName}
                variant="portal"
              />
            </div>
          ) : null}
        </header>

        <div className="portal-page__hub">
          <SameWindowLink href="/office-hub" className="portal-hub-btn">
            Open Office Hub →
          </SameWindowLink>
        </div>

        <div
          className={`portal-system-grid portal-page__grid ${billingAccess ? "" : "portal-system-grid--single"}`}
        >
          <SameWindowLink
            href={firmAppHref("/app")}
            className="portal-system-card portal-system-card--tasks"
          >
            <span className="portal-system-card__shine" aria-hidden />
            <span className="portal-system-card__icon" aria-hidden>
              ✓
            </span>
            <p className="portal-system-card__eyebrow">Operations</p>
            <h2 className="portal-system-card__title">Task & Calendar System</h2>
            <p className="portal-system-card__desc">
              Today&apos;s work, hearings, filings, team tracker, and calendar sync.
            </p>
            <span className="portal-system-card__cta">Open task & calendar system →</span>
          </SameWindowLink>

          {billingAccess ? (
            <SameWindowLink
              href="/billing"
              className="portal-system-card portal-system-card--billing"
            >
              <span className="portal-system-card__shine" aria-hidden />
              <span className="portal-system-card__icon" aria-hidden>
                ◆
              </span>
              <p className="portal-system-card__eyebrow">Financial</p>
              <h2 className="portal-system-card__title">Billing System</h2>
              <p className="portal-system-card__desc">
                Client ledger, statements of account, receipts, and billing reports.
              </p>
              <span className="portal-system-card__cta">Open billing system →</span>
            </SameWindowLink>
          ) : null}
        </div>

        <div className="portal-page__actions firm-auth-actions">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="firm-auth-link-btn"
          >
            Sign out
          </button>
        </div>
      </div>
    </FirmAuthShell>
  );
}
