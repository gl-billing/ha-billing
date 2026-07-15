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
    <aside className="new-staff-hint firm-auth-animate firm-auth-animate--1" aria-label="Desk procedures">
      <p className="new-staff-hint__title">Desk procedures</p>
      <p className="new-staff-hint__text">
        Morning register, task vs event, walk-ins, charges, SOA/AR, and who to contact — kept as desk procedures for the firm.
      </p>
      <div className="new-staff-hint__actions">
        <SameWindowLink href="/office-hub/instructions" className="new-staff-hint__link">
          Open procedures →
        </SameWindowLink>
        <button
          type="button"
          className="new-staff-hint__dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
