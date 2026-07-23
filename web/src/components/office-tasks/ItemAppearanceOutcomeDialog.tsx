"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  APPEARANCE_COURT_FOLLOW_UP_KINDS,
  type AppearanceCourtFollowUpKind,
  type AppearanceOutcomeAction
} from "@/lib/office-tasks/appearance-outcome-shared";
import { isHearingItem } from "@/lib/hearing-escalation";
import { todayYmd } from "@/lib/office-tasks/schedule";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

export type AppearanceOutcomeConfirmPayload = {
  item: ItemSummary;
  action: AppearanceOutcomeAction;
  whatHappened: string;
  nextDate?: string;
  createNextDateFollowUp: boolean;
  courtFollowUpKind: AppearanceCourtFollowUpKind;
  followUpDate?: string;
  followUpNote?: string;
};

type Props = {
  item: ItemSummary;
  open: boolean;
  busy?: boolean;
  /** Prefill disposition when opened from a shortcut (e.g. past-hearing reminder). */
  initialAction?: AppearanceOutcomeAction;
  initialNote?: string;
  onClose: () => void;
  onConfirm: (payload: AppearanceOutcomeConfirmPayload) => void;
};

const ACTIONS: Array<{
  id: AppearanceOutcomeAction;
  label: string;
  hint: string;
}> = [
  { id: "completed", label: "Completed", hint: "Taken up / finished as scheduled." },
  { id: "rescheduled", label: "Reschedule", hint: "New date is known — move the event." },
  { id: "postponed", label: "Postpone", hint: "No new date yet — creates a follow-up to ask." },
  { id: "cancelled", label: "Cancel", hint: "Called off — optionally follow up for a new date." }
];

export function ItemAppearanceOutcomeDialog({
  item,
  open,
  busy,
  initialAction = "completed",
  initialNote = "",
  onClose,
  onConfirm
}: Props) {
  const [whatHappened, setWhatHappened] = useState("");
  const [action, setAction] = useState<AppearanceOutcomeAction>("completed");
  const [nextDate, setNextDate] = useState(todayYmd());
  const [createFollowUp, setCreateFollowUp] = useState(true);
  const [courtFollowUpKind, setCourtFollowUpKind] = useState<AppearanceCourtFollowUpKind>("none");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  useBodyScrollLock(open);

  const hearing = isHearingItem(item as OfficeItem);
  const kind = item.category?.trim() || "Event";
  const showCourtFollowUp = action === "completed" || action === "rescheduled";
  const needsDate = action === "rescheduled";
  const showNextDateToggle = action === "postponed" || action === "cancelled";
  const needsFollowUpDateLabel =
    courtFollowUpKind === "next_hearing"
      ? "Next hearing date (optional)"
      : courtFollowUpKind === "submission"
        ? "Submission / filing due date (optional)"
        : "Follow-up due date (optional)";

  useEffect(() => {
    if (!open) return;
    setWhatHappened(initialNote);
    setAction(initialAction);
    setNextDate(todayYmd());
    setCreateFollowUp(true);
    setCourtFollowUpKind("none");
    setFollowUpDate("");
    setFollowUpNote("");
  }, [open, item.id, initialAction, initialNote]);

  if (!open) return null;

  const canSave =
    whatHappened.trim().length > 0 && (!needsDate || Boolean(nextDate.trim())) && !busy;

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appearance-outcome-title">
        <div className="modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto">
          <h2 id="appearance-outcome-title" className="font-display text-lg font-semibold text-ink">
            What happened
          </h2>
          <p className="mt-1 text-xs text-muted">
            {item.clientCase || "—"} · {item.id || "no code"} · {kind}
          </p>
          <p className="mt-2 text-sm text-muted">
            Short note for the matter status report. Add any follow-up hearing or submission the court required.
          </p>

          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
            What happened
            <textarea
              className="field-input mt-1.5 min-h-[88px] w-full resize-y"
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              placeholder={
                hearing
                  ? "e.g. Reset by court — counsel appeared; directed to file position paper."
                  : "e.g. Client requested to move the meeting; no new slot yet."
              }
              disabled={busy}
              autoFocus
            />
          </label>

          <fieldset className="mt-4 space-y-2" disabled={busy}>
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">Then</legend>
            {ACTIONS.map((row) => (
              <label
                key={row.id}
                className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 ${
                  action === row.id ? "border-ink/40 bg-paper" : "border-line/60"
                }`}
              >
                <input
                  type="radio"
                  name="appearance-outcome"
                  className="mt-1"
                  checked={action === row.id}
                  onChange={() => {
                    setAction(row.id);
                    if (row.id === "postponed" || row.id === "cancelled") {
                      setCourtFollowUpKind("none");
                    }
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{row.label}</span>
                  <span className="block text-xs text-muted">{row.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {needsDate ? (
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
              New scheduled date
              <input
                type="date"
                className="field-input mt-1.5 w-full"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                disabled={busy}
                required
              />
            </label>
          ) : null}

          {showNextDateToggle ? (
            <label className="mt-4 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={createFollowUp}
                onChange={(e) => setCreateFollowUp(e.target.checked)}
                disabled={busy}
              />
              <span>
                {hearing
                  ? "Create a task to call the court for the next hearing date"
                  : "Create a follow-up task to get the new date"}
              </span>
            </label>
          ) : null}

          {showCourtFollowUp ? (
            <fieldset className="mt-4 space-y-2" disabled={busy}>
              <legend className="text-xs font-bold uppercase tracking-wide text-muted">
                Court / next steps required?
              </legend>
              {APPEARANCE_COURT_FOLLOW_UP_KINDS.map((row) => (
                <label
                  key={row.id}
                  className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 ${
                    courtFollowUpKind === row.id ? "border-ink/40 bg-paper" : "border-line/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="appearance-court-follow-up"
                    className="mt-1"
                    checked={courtFollowUpKind === row.id}
                    onChange={() => setCourtFollowUpKind(row.id)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{row.label}</span>
                    <span className="block text-xs text-muted">{row.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {showCourtFollowUp && courtFollowUpKind !== "none" ? (
            <>
              <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
                {needsFollowUpDateLabel}
                <input
                  type="date"
                  className="field-input mt-1.5 w-full"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-muted">
                Follow-up note (optional)
                <input
                  className="field-input mt-1.5 w-full"
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder={
                    courtFollowUpKind === "submission"
                      ? "e.g. Position paper; 15 days to file"
                      : courtFollowUpKind === "next_hearing"
                        ? "e.g. Pre-trial conference; same court"
                        : "e.g. Update client; request documents"
                  }
                  disabled={busy}
                />
              </label>
              <p className="mt-2 text-xs text-muted">
                {courtFollowUpKind === "next_hearing"
                  ? followUpDate
                    ? "Creates a new hearing event on that date."
                    : "Creates a task to confirm the next hearing date."
                  : courtFollowUpKind === "submission"
                    ? followUpDate
                      ? "Creates a submission deadline event."
                      : "Creates a court follow-up task for the filing."
                    : "Creates a follow-up task on the desk."}
              </p>
            </>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary !text-xs" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              className="btn-primary !text-xs"
              disabled={!canSave}
              onClick={() =>
                onConfirm({
                  item,
                  action,
                  whatHappened: whatHappened.trim(),
                  nextDate: needsDate ? nextDate.trim() : undefined,
                  createNextDateFollowUp: showNextDateToggle ? createFollowUp : false,
                  courtFollowUpKind: showCourtFollowUp ? courtFollowUpKind : "none",
                  followUpDate:
                    showCourtFollowUp && courtFollowUpKind !== "none" && followUpDate.trim()
                      ? followUpDate.trim()
                      : undefined,
                  followUpNote:
                    showCourtFollowUp && courtFollowUpKind !== "none" && followUpNote.trim()
                      ? followUpNote.trim()
                      : undefined
                })
              }
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
