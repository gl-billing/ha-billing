"use client";

import {
  hasValidScheduleRecipients,
  normalizeRecipientEmailList
} from "@/lib/office-tasks/schedule-confirmation-client";

export { hasValidScheduleRecipients, normalizeRecipientEmailList };

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  hint?: string;
};

export function ScheduleConfirmationRecipientFields({
  emails,
  onChange,
  disabled = false,
  hint = "Add every client who should receive this confirmation. The first email is prefilled from the client file when available."
}: Props) {
  function updateEmail(index: number, value: string) {
    onChange(emails.map((entry, i) => (i === index ? value : entry)));
  }

  function addEmail() {
    onChange([...emails, ""]);
  }

  function removeEmail(index: number) {
    if (emails.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(emails.filter((_, i) => i !== index));
  }

  return (
    <div className="schedule-recipients">
      <div className="schedule-recipients__head">
        <span className="schedule-email-section__label">Send to</span>
        <button
          type="button"
          className="schedule-recipients__add"
          disabled={disabled}
          onClick={addEmail}
        >
          <span className="schedule-recipients__add-icon" aria-hidden>
            +
          </span>
          Add email
        </button>
      </div>
      <div className="schedule-recipients__list">
        {emails.map((email, index) => (
          <div key={`recipient-${index}`} className="schedule-recipients__row">
            <span className="schedule-recipients__index" aria-hidden>
              {index + 1}
            </span>
            <input
              className="field-input schedule-recipients__input"
              type="email"
              value={email}
              disabled={disabled}
              placeholder={index === 0 ? "client@email.com" : "another.client@email.com"}
              onChange={(e) => updateEmail(index, e.target.value)}
            />
            {emails.length > 1 ? (
              <button
                type="button"
                className="schedule-recipients__remove"
                disabled={disabled}
                aria-label={`Remove email ${index + 1}`}
                onClick={() => removeEmail(index)}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {hint ? <p className="schedule-recipients__hint">{hint}</p> : null}
    </div>
  );
}
