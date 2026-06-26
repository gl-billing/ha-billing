"use client";

import { useEffect, useState } from "react";
import {
  contactEmailsToFieldValue,
  formatContactEmails,
  mergeContactEmailFieldRows
} from "@/lib/contact-emails";

type Props = {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  /** When set, Save persists all addresses to Master List or walk-in sheet. */
  onSave?: (emails: string[]) => Promise<void>;
  disabled?: boolean;
  hint?: string;
  className?: string;
  /** Fits in a half-width form column beside phone (e.g. + Event walk-in). */
  compact?: boolean;
};

export function ClientContactEmailField({
  emails,
  onEmailsChange,
  onSave,
  disabled = false,
  hint,
  className = "",
  compact = false
}: Props) {
  const [draft, setDraft] = useState<string[]>(() => contactEmailsToFieldValue(emails));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft((current) => mergeContactEmailFieldRows(current, emails));
  }, [emails]);

  function updateEmail(index: number, value: string) {
    const next = draft.map((entry, i) => (i === index ? value : entry));
    setDraft(next);
    if (!onSave) onEmailsChange(next);
  }

  function addEmail() {
    const next = [...draft, ""];
    setDraft(next);
    onEmailsChange(next);
  }

  function removeEmail(index: number) {
    const next = draft.length <= 1 ? [""] : draft.filter((_, i) => i !== index);
    setDraft(next);
    onEmailsChange(next);
  }

  async function commitSave() {
    const normalized = contactEmailsToFieldValue(draft);
    onEmailsChange(normalized);
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setDraft(contactEmailsToFieldValue(emails));
  }

  const savedValue = formatContactEmails(emails);
  const draftValue = formatContactEmails(draft);
  const dirty = draftValue !== savedValue;

  const rootClass = [
    "client-contact-email",
    compact ? "client-contact-email--compact" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {compact ? (
        <div className="client-contact-email__label-row">
          <span className="form-field__label">Email</span>
          <button
            type="button"
            className="client-contact-email__add client-contact-email__add--compact"
            disabled={disabled || saving}
            aria-label="Add another email"
            onClick={addEmail}
          >
            <span className="client-contact-email__add-icon" aria-hidden>
              +
            </span>
          </button>
        </div>
      ) : (
        <span className="client-contact-email__label">Email</span>
      )}

      <div className="client-contact-email__list">
        {draft.map((email, index) => (
          <div
            key={`client-email-${index}`}
            className={`client-contact-email__row${index > 0 && compact ? " client-contact-email__row--extra" : ""}`}
          >
            <div className="client-contact-email__input-wrap">
              <input
                className="field-input client-contact-email__input"
                type="email"
                value={email}
                disabled={disabled || saving}
                placeholder={index === 0 ? "client@email.com" : "another.client@email.com"}
                onChange={(e) => updateEmail(index, e.target.value)}
              />
              {compact && index > 0 ? (
                <button
                  type="button"
                  className="client-contact-email__remove client-contact-email__remove--compact"
                  disabled={disabled || saving}
                  aria-label={`Remove email ${index + 1}`}
                  onClick={() => removeEmail(index)}
                >
                  ×
                </button>
              ) : null}
            </div>
            {!compact && draft.length > 1 ? (
              <button
                type="button"
                className="client-contact-email__remove"
                disabled={disabled || saving}
                aria-label={`Remove email ${index + 1}`}
                onClick={() => removeEmail(index)}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {!compact ? (
        <div className="client-contact-email__actions">
          <button
            type="button"
            className="client-contact-email__add-btn"
            disabled={disabled || saving}
            onClick={addEmail}
          >
            <span className="client-contact-email__add-icon" aria-hidden>
              +
            </span>
            Add email
          </button>
        </div>
      ) : null}
      {hint && !compact ? <p className="client-contact-email__hint">{hint}</p> : null}
      {onSave && dirty ? (
        <div className={`client-contact-email__save-row${compact ? " client-contact-email__save-row--compact" : ""}`}>
          <button
            type="button"
            className="client-contact-email__save"
            disabled={disabled || saving}
            onClick={() => void commitSave()}
          >
            {saving ? "Saving…" : "Save email"}
          </button>
          <button type="button" className="client-contact-email__cancel" disabled={saving} onClick={cancelEdit}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
