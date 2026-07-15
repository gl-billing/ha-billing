"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import type { SheetsAccessHint } from "@/lib/sheets-access-help";

type Props = {
  hint: SheetsAccessHint;
  onReload?: () => void;
  reloadBusy?: boolean;
};

export function SheetsAccessErrorPanel({ hint, onReload, reloadBusy }: Props) {
  return (
    <div className="sheets-access-error card mb-4" role="alert">
      <p className="sheets-access-error__title">{hint.title}</p>
      <p className="sheets-access-error__body">{hint.body}</p>
      {(hint.showReload || hint.showSignIn) && (
        <div className="sheets-access-error__actions">
          {hint.showReload && onReload ? (
            <button type="button" className="btn-primary btn-sm" disabled={reloadBusy} onClick={onReload}>
              {reloadBusy ? "Updating…" : "Update"}
            </button>
          ) : null}
          {hint.showSignIn ? (
            <SameWindowLink href="/login" className="btn-secondary btn-sm">
              Sign in again
            </SameWindowLink>
          ) : null}
        </div>
      )}
    </div>
  );
}
