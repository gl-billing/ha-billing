"use client";

import { FormStatusReport } from "@/components/FormStatusReport";
import type { FormSaveStatus } from "@/lib/firm-status-report";

type Props = {
  busy: boolean;
  label: string;
  savingLabel: string;
  status?: FormSaveStatus | null;
  error?: string;
  /** When true, block double-submit only — not page reload busy state. */
  submitDisabled?: boolean;
};

export function EntryFormFooter({ busy, label, savingLabel, status, error, submitDisabled = false }: Props) {
  const display: FormSaveStatus | null = error
    ? { phase: "error", message: error }
    : status?.message
      ? status
      : null;

  return (
    <footer className="entry-form__footer entry-form__footer--sticky-mobile">
      <FormStatusReport status={display} />
      <p className="entry-form__footer-note">
        Required fields marked <span className="entry-form__required-mark">*</span>. Saves to the office spreadsheet.
      </p>
      <button type="submit" className="btn-primary entry-form__submit" disabled={submitDisabled || busy}>
        {busy ? savingLabel : label}
      </button>
    </footer>
  );
}
