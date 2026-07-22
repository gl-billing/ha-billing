"use client";

import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import { FirmLogoBanner } from "@/components/FirmLogoBanner";
import { HeaderSnapshotLine } from "@/components/HeaderSnapshotLine";
import { HeaderUserBadge } from "@/components/HeaderUserBadge";
import { HeaderWorkspaceLinks } from "@/components/HeaderWorkspaceLinks";
import type { FirmWorkspace } from "@/components/FirmWorkspaceShell";

const WORKSPACE_LABELS: Record<FirmWorkspace, string> = {
  billing: "Office",
  tasks: "Office"
};

type Props = {
  workspace?: FirmWorkspace;
  subtitle?: string;
  name?: string | null;
  email?: string | null;
  displayName?: string | null;
  billingAccess?: boolean;
  children?: ReactNode;
  className?: string;
  signOutCallbackUrl?: string;
};

export function FirmBrandHeader({
  workspace,
  subtitle,
  name,
  email,
  displayName,
  children,
  className = "",
  signOutCallbackUrl = "/login"
}: Props) {
  return (
    <header className={`brand-header ${className}`.trim()}>
      <FirmLogoBanner className="firm-logo-banner--workspace" priority />
      <div className="brand-header__inner">
        {(workspace || subtitle) && (
          <div className="brand-header__meta-row">
            {workspace ? (
              <div className="brand-header__workspace-row">
                <span className={`brand-header__workspace-pill brand-header__workspace-pill--${workspace}`}>
                  {WORKSPACE_LABELS[workspace]}
                </span>
              </div>
            ) : subtitle ? (
              <p className="brand-header__subtitle">{subtitle}</p>
            ) : null}
          </div>
        )}

        {email ? (
          <div className="brand-header__toolbar">
            <div className="brand-header__user-block">
              <HeaderUserBadge name={name} email={email} displayName={displayName} />
              {workspace ? <HeaderSnapshotLine workspace={workspace} /> : null}
            </div>
            <div className="brand-header__actions">
              {children}
              <HeaderWorkspaceLinks />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: signOutCallbackUrl })}
                className="header-app-link header-app-link--signout"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function HubHeaderLinks() {
  return null;
}
