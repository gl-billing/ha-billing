"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { resetTargetDate, usesFilingDeadlineForReset } from "@/lib/office-tasks/reset-target";
import { todayYmd } from "@/lib/office-tasks/schedule";

type Props = {
  item: ItemSummary | null;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (item: ItemSummary, newDate: string) => void;
};

export function ItemResetDialog({ item, open, busy, onClose, onConfirm }: Props) {
  const [newDate, setNewDate] = useState("");
  useBodyScrollLock(open && Boolean(item));

  useEffect(() => {
    if (open && item) {
      const current = resetTargetDate(item);
      setNewDate(current && current >= todayYmd() ? current : todayYmd());
    }
  }, [open, item]);

  if (!open || !item) return null;

  const currentDate = resetTargetDate(item);

  const dateLabel =
    item.source === "Task"
      ? "New due date"
      : usesFilingDeadlineForReset(item)
        ? "New filing / deadline date"
        : "New event date";

  return (
    <ModalPortal>
      <div className="reset-dialog-backdrop no-print" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
      <div className="reset-dialog card">
        <p className="view-eyebrow">Reset item</p>
        <h3 id="reset-dialog-title" className="font-display text-xl font-semibold text-ink">
          {item.clientCase || "Task / event"}
        </h3>
        <p className="mt-2 text-sm text-muted">
          Pick a new date. The item will return to <strong>{item.source === "Task" ? "In Progress" : "Scheduled"}</strong> and
          show on your calendar for that day.
          {currentDate ? (
            <>
              {" "}
              Current {usesFilingDeadlineForReset(item) ? "filing deadline" : "date"}: <strong>{currentDate}</strong>
            </>
          ) : null}
        </p>

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-muted">
          {dateLabel}
          <input
            type="date"
            className="field-input mt-1"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 text-sm"
            disabled={busy || !newDate}
            onClick={() => onConfirm(item, newDate)}
          >
            {busy ? "Saving…" : "Reset with new date"}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
