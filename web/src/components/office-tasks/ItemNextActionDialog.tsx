"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Props = {
  item: ItemSummary;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (item: ItemSummary, nextAction: string) => void;
};

export function ItemNextActionDialog({ item, open, busy, onClose, onConfirm }: Props) {
  const [text, setText] = useState(item.nextAction || "");
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) setText(item.nextAction || "");
  }, [open, item.nextAction]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="next-action-title">
      <div className="modal-panel max-w-md">
        <h2 id="next-action-title" className="font-display text-lg font-semibold text-ink">
          Next action
        </h2>
        <p className="mt-1 text-xs text-muted">
          {item.clientCase || "—"} · {item.id || "no code"}
        </p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
          What to do next
          <textarea
            className="field-input mt-1.5 min-h-[88px] w-full resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Draft motion, call client, file at RTC…"
            disabled={busy}
            autoFocus
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary !text-xs" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary !text-xs"
            disabled={busy || !text.trim()}
            onClick={() => onConfirm(item, text.trim())}
          >
            {busy ? "Saving…" : "Save next action"}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
