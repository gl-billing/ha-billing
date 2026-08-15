"use client";

import { useEffect, useState } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import { readBrowserStorage, writeBrowserStorage } from "@/lib/ha-browser-storage";

const DISMISS_KEY = "ha-office-welcome-hint";
const LEGACY_DISMISS_KEY = "gl-office-welcome-hint";

type Props = {
  email?: string | null;
};

export function NewStaffHint({ email }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!email) return;
    if (readBrowserStorage(DISMISS_KEY, LEGACY_DISMISS_KEY) === "1") return;
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
            writeBrowserStorage(DISMISS_KEY, "1", LEGACY_DISMISS_KEY);
            setVisible(false);
          }}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
