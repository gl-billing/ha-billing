"use client";

import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { SourceIdDisplay } from "@/components/office-tasks/SourceIdDisplay";

type Props = {
  item: ItemSummary | null;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (item: ItemSummary) => void;
};

export function ItemDeleteDialog({ item, open, busy, onClose, onConfirm }: Props) {
  useBodyScrollLock(open && Boolean(item));

  if (!open || !item) return null;

  const kind = item.source === "Task" ? "task" : "event";

  return (
    <ModalPortal>
      <div
        className="reset-dialog-backdrop no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="reset-dialog card">
          <p className="view-eyebrow text-red-800">Delete permanently</p>
          <h3 id="delete-dialog-title" className="font-display text-xl font-semibold text-ink">
            {item.clientCase || "Task / event"}
          </h3>
          <p className="mt-2 text-sm text-muted">
            This {kind} will be removed from{" "}
            <strong>{item.source === "Task" ? "Master Tasks" : "Hearings & Events"}</strong> and cannot be undone.
            Linked follow-up or prep tasks are not deleted automatically.
          </p>
          {item.id ? (
            <p className="mt-2 text-xs text-muted">
              <SourceIdDisplay id={item.id} clientCase={item.clientCase} variant="mini" />
            </p>
          ) : null}

          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-secondary flex-1 text-sm" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger flex-1 text-sm"
              disabled={busy}
              onClick={() => onConfirm(item)}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
