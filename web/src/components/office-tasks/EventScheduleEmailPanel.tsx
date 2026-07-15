"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import {
  hasValidScheduleRecipients,
  normalizeRecipientEmailList
} from "@/lib/office-tasks/schedule-confirmation-client";
import type { ScheduleConfirmationDraft } from "@/lib/office-tasks/event-form-utils";
import { buildScheduleEmailSummary } from "@/lib/office-tasks/schedule-email-ui";
import { sendScheduleConfirmation } from "@/lib/office-tasks/schedule-confirmation-client";
import { ScheduleConfirmationRecipientFields } from "@/components/office-tasks/ScheduleConfirmationRecipientFields";

type Props = {
  item: ItemSummary;
  draft?: ScheduleConfirmationDraft;
  initialRecipientEmails?: string[];
  customNote: string;
  onCustomNoteChange: (value: string) => void;
  onEnsureSaved?: () => Promise<ItemSummary>;
  onStatus?: (message: string, isError?: boolean) => void;
  onSent?: (patch?: import("@/lib/office-tasks/event-join-link").EventScheduleEmailSentPatch) => void;
  /** Dialog opened because client email was missing — collect details then send. */
  missingDetails?: boolean;
};

export function EventScheduleEmailPanel({
  item,
  draft,
  initialRecipientEmails = [],
  customNote,
  onCustomNoteChange,
  onEnsureSaved,
  onStatus,
  onSent,
  missingDetails = true
}: Props) {
  const [sending, setSending] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([""]);
  
  const summary = useMemo(() => buildScheduleEmailSummary(item), [item]);

  useEffect(() => {
    const seeds = initialRecipientEmails.map((email) => email.trim()).filter(Boolean);
    setRecipientEmails(seeds.length ? seeds : [""]);
  }, [initialRecipientEmails, item.id, item.rowNumber, draft?.clientCase, draft?.platform]);

  async function handleSend() {
    setSending(true);
    try {
      let target = item;
      if (!item.rowNumber && onEnsureSaved) {
        target = await onEnsureSaved();
      }
      const entered = normalizeRecipientEmailList(recipientEmails);
      if (!hasValidScheduleRecipients(entered)) {
        throw new Error("Add at least one valid client email before sending.");
      }

      const result = await sendScheduleConfirmation({
        source: target.source,
        rowNumber: target.rowNumber,
        itemId: target.id,
        recipientEmails: entered,
        customNote,
        createMeetLink: target.platform === "Google Meet"
      });
      onStatus?.(result.message);
      onSent?.({
        source: target.source,
        rowNumber: target.rowNumber,
        meetLink: result.meetLink,
        venue: result.venue,
        details: result.details
      });
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not send schedule confirmation.", true);
    } finally {
      setSending(false);
    }
  }

  const canSend = hasValidScheduleRecipients(recipientEmails);

  return (
    <div className="event-schedule-email">
      <section className="schedule-email-summary" aria-label="Appointment summary">
        <div className="schedule-email-summary__top">
          <span className="schedule-email-summary__badge">{summary.category}</span>
          {summary.platform ? <span className="schedule-email-summary__chip">{summary.platform}</span> : null}
        </div>
        <p className="schedule-email-summary__case">{summary.clientCase}</p>
        <dl className="schedule-email-summary__meta">
          <div className="schedule-email-summary__meta-item">
            <dt>When</dt>
            <dd>{summary.whenLabel}</dd>
          </div>
          {summary.assignedTo ? (
            <div className="schedule-email-summary__meta-item">
              <dt>With</dt>
              <dd>{summary.assignedTo}</dd>
            </div>
          ) : null}
          {summary.venue ? (
            <div className="schedule-email-summary__meta-item schedule-email-summary__meta-item--wide">
              <dt>Details</dt>
              <dd>{summary.venue}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {missingDetails ? (
        <div className="schedule-email-callout schedule-email-callout--banner">
          <p className="schedule-email-callout__title">Client email needed</p>
          <p className="schedule-email-callout__text">
            This client does not have an email on file yet. Add at least one address below, then send the confirmation
            using the appointment details above.
          </p>
        </div>
      ) : null}

      <div className="schedule-email-compose">
        <section className="schedule-email-section">
          <ScheduleConfirmationRecipientFields
            emails={recipientEmails}
            disabled={sending}
            hint="Add every client who should receive this confirmation."
            onChange={setRecipientEmails}
          />
        </section>

        <section className="schedule-email-section">
          <label className="form-field">
            <span className="schedule-email-section__label">Personal note</span>
            <span className="schedule-email-section__hint">Optional — appended to the confirmation email.</span>
            <textarea
              className="field-input field-input--textarea schedule-email-note"
              value={customNote}
              onChange={(e) => onCustomNoteChange(e.target.value)}
              placeholder="e.g. Please have your documents ready."
              disabled={sending}
            />
          </label>
        </section>

        {item.platform === "Google Meet" ? (
          <div className="schedule-email-callout">
            <p className="schedule-email-callout__title">Google Meet</p>
            <p className="schedule-email-callout__text">
              A secure meeting link is created automatically when you send this confirmation, and it will appear on the
              event entry right away.
            </p>
          </div>
        ) : null}

        <footer className="schedule-email-footer schedule-email-footer--solo">
          <button
            type="button"
            className="btn-primary schedule-email-footer__primary"
            disabled={sending || !canSend}
            onClick={() => void handleSend()}
          >
            {sending ? "Sending…" : "Send confirmation email"}
          </button>
        </footer>
      </div>
    </div>
  );
}
