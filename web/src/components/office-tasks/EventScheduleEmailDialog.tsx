"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { EventScheduleEmailPanel } from "@/components/office-tasks/EventScheduleEmailPanel";
import { isScheduleConfirmationEvent } from "@/lib/office-tasks/event-form-utils";

type Props = {
  open: boolean;
  item: ItemSummary | null;
  initialRecipientEmails?: string[];
  busy?: boolean;
  onClose: () => void;
  onSent?: (patch?: import("@/lib/office-tasks/event-join-link").EventScheduleEmailSentPatch) => void;
  onStatus?: (message: string, isError?: boolean) => void;
};

export function EventScheduleEmailDialog({
  open,
  item,
  initialRecipientEmails = [],
  busy,
  onClose,
  onSent,
  onStatus
}: Props) {
  const [customNote, setCustomNote] = useState("");
  const eligible = item ? isScheduleConfirmationEvent(item) : false;

  useEffect(() => {
    if (!open) return;
    setCustomNote("");
  }, [open, item?.id]);

  if (!open || !item) return null;

  if (!eligible) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-panel schedule-email-modal max-w-lg">
          <header className="schedule-email-modal__hero">
            <div>
              <p className="schedule-email-modal__eyebrow">Schedule confirmation</p>
              <h2 className="schedule-email-modal__title">Not available</h2>
            </div>
          </header>
          <div className="schedule-email-modal__body">
            <p className="schedule-email-modal__intro">
              Available for meetings, consultations, client calls, and internal meetings — in person or online.
            </p>
            <div className="schedule-email-footer schedule-email-footer--solo">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="schedule-email-title">
      <div className="modal-panel schedule-email-modal max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <header className="schedule-email-modal__hero">
          <div className="schedule-email-modal__hero-copy">
            <p className="schedule-email-modal__eyebrow">Missing client email</p>
            <h2 id="schedule-email-title" className="schedule-email-modal__title">
              Add email to send confirmation
            </h2>
            <p className="schedule-email-modal__subtitle">
              {item.clientCase || "—"} · {item.category}
              {item.platform ? ` · ${item.platform}` : ""}
            </p>
          </div>
          <button type="button" className="schedule-email-modal__close btn-secondary !text-xs" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        <div className="schedule-email-modal__body">
          <EventScheduleEmailPanel
            item={item}
            initialRecipientEmails={initialRecipientEmails}
            customNote={customNote}
            missingDetails
            onCustomNoteChange={setCustomNote}
            onStatus={onStatus}
            onSent={(patch) => {
              onSent?.(patch);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function canSendScheduleConfirmation(item: Pick<ItemSummary, "source" | "category" | "platform">): boolean {
  return isScheduleConfirmationEvent(item);
}
