"use client";

import type { ReactNode } from "react";
import { FirmLogoBanner } from "@/components/FirmLogoBanner";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Login uses a single centered panel — no top bar or nested card. */
  variant?: "default" | "login";
};

export function FirmAuthShell({ children, footer, variant = "default" }: Props) {
  if (variant === "login") {
    return (
      <div className="login-page">
        <div className="login-page__panel">
          <FirmLogoBanner className="firm-logo-banner--login" priority />
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="firm-auth firm-auth--portal">
      <header className="firm-auth-topbar">
        <div className="firm-auth-topbar__inner">
          <FirmLogoBanner className="firm-logo-banner--auth-top" priority />
        </div>
      </header>

      <main className="firm-auth-main">
        <div className="firm-auth-card">{children}</div>
        {footer ? <footer className="firm-auth-footer">{footer}</footer> : null}
      </main>
    </div>
  );
}
