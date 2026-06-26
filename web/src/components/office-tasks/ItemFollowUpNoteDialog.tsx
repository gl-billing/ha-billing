"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { displayRemarks } from "@/lib/office-tasks/follow-up-marker";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";

type Props = {
  item: ItemSummary;
  status: Extract<ItemStatusUpdate, "Started" | "Waiting">;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (item: ItemSummary, status: Extract<ItemStatusUpdate, "Started" | "Waiting">, note: string) => void;
};

export function ItemFollowUpNoteDialog({ item, status, open, busy, onClose, onConfirm }: Props) {
  const [text, setText] = useState("");
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) setText(displayRemarks(item.remarks || ""));
  }, [open, item.remarks]);

  if (!open) return null;

  const title = status === "Started" ? "Mark as started" : "Mark as waiting";
  const actionLabel = status === "Started" ? "Mark started" : "Mark waiting";

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="follow-up-note-title">
        <div className="modal-panel max-w-md">
          <h2 id="follow-up-note-title" className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {item.clientCase || "—"} · {item.id || "no code"}
          </p>
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
            Note (optional)
            <textarea
              className="field-input mt-1.5 min-h-[88px] w-full resize-y"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Already started — waiting for Dr. Batican's reply"
              disabled={busy}
              autoFocus
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Add context for your team — why this is started or what you&apos;re waiting on.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary !text-xs" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !text-xs"
              disabled={busy}
              onClick={() => onConfirm(item, status, text.trim())}
            >
              {busy ? "Saving…" : actionLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
