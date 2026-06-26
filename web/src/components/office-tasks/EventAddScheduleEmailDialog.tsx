"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { EventScheduleEmailPanel } from "@/components/office-tasks/EventScheduleEmailPanel";
import type { ScheduleConfirmationDraft } from "@/lib/office-tasks/event-form-utils";
import {
  buildScheduleConfirmationDraftItem,
  isScheduleConfirmationEvent
} from "@/lib/office-tasks/event-form-utils";

export type SavedEventInfo = {
  eventId: string;
  sheetRow: number;
  message?: string;
};

type Props = {
  open: boolean;
  draft: ScheduleConfirmationDraft | null;
  initialRecipientEmails?: string[];
  busy?: boolean;
  onClose: () => void;
  onSaveEvent: () => Promise<SavedEventInfo | null>;
  onSent?: (saved: SavedEventInfo) => void;
  onStatus?: (message: string, isError?: boolean) => void;
};

export function EventAddScheduleEmailDialog({
  open,
  draft,
  initialRecipientEmails = [],
  busy,
  onClose,
  onSaveEvent,
  onSent,
  onStatus
}: Props) {
  const [customNote, setCustomNote] = useState("");
  const [savedItem, setSavedItem] = useState<ItemSummary | null>(null);

  const draftItem = draft ? buildScheduleConfirmationDraftItem(draft) : null;
  const eligible = draftItem ? isScheduleConfirmationEvent(draftItem) : false;

  useEffect(() => {
    if (!open) return;
    setCustomNote("");
    setSavedItem(null);
  }, [open, draft]);

  if (!open || !draft || !draftItem) return null;

  const panelItem: ItemSummary = savedItem ?? {
    ...draftItem,
    id: "",
    rowNumber: 0,
    filingDeadline: null,
    priority: "Medium",
    status: "Scheduled",
    nextAction: "",
    done: false,
    remarks: "",
    reminderDays: 1,
    calendarSync: false,
    filingMode: "",
    pleadingType: "",
    pleadingCaseNature: "",
    receivedDate: null,
    periodToFileDays: 0,
    filingDate: null
  };

  async function ensureSavedItem(): Promise<ItemSummary> {
    if (savedItem?.rowNumber) return savedItem;
    const saved = await onSaveEvent();
    if (!saved?.eventId || !saved.sheetRow) {
      throw new Error("Save the event before sending the confirmation email.");
    }
    const next: ItemSummary = {
      ...panelItem,
      id: saved.eventId,
      rowNumber: saved.sheetRow
    };
    setSavedItem(next);
    return next;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-schedule-email-title">
      <div className="modal-panel schedule-email-modal max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <header className="schedule-email-modal__hero">
          <div className="schedule-email-modal__hero-copy">
            <p className="schedule-email-modal__eyebrow">Missing client email</p>
            <h2 id="add-schedule-email-title" className="schedule-email-modal__title">
              Add email to send confirmation
            </h2>
            <p className="schedule-email-modal__subtitle">
              {draft.clientCase || "—"} · {draftItem.category}
              {draft.platform ? ` · ${draft.platform}` : ""}
            </p>
          </div>
          <button type="button" className="schedule-email-modal__close btn-secondary !text-xs" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        <div className="schedule-email-modal__body">
          {!eligible ? (
            <p className="schedule-email-modal__intro">
              Schedule confirmation is available for meetings, consultations, client calls, and internal meetings.
            </p>
          ) : (
            <EventScheduleEmailPanel
              item={panelItem}
              draft={draft}
              initialRecipientEmails={initialRecipientEmails}
              customNote={customNote}
              missingDetails
              onCustomNoteChange={setCustomNote}
              onEnsureSaved={ensureSavedItem}
              onStatus={onStatus}
              onSent={() => {
                void (async () => {
                  const saved = await ensureSavedItem();
                  onSent?.({ eventId: saved.id, sheetRow: saved.rowNumber });
                  onClose();
                })();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
