"use client";

import { useEffect, useState } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";

const DISMISS_KEY = "gl-office-welcome-hint";

type Props = {
  email?: string | null;
};

export function NewStaffHint({ email }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!email) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, [email]);

  if (!visible) return null;

  return (
    <aside className="new-staff-hint firm-auth-animate firm-auth-animate--1" aria-label="New here">
      <p className="new-staff-hint__title">New here?</p>
      <p className="new-staff-hint__text">
        Read the 5-minute office guide for daily workflows, who to ask, and how billing and tasks connect.
      </p>
      <div className="new-staff-hint__actions">
        <SameWindowLink href="/office-hub/instructions" className="new-staff-hint__link">
          Open guide →
        </SameWindowLink>
        <button
          type="button"
          className="new-staff-hint__dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
