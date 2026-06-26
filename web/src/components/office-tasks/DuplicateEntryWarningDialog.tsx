"use client";

import { ModalPortal } from "@/components/ModalPortal";
import { SourceIdDisplay } from "@/components/office-tasks/SourceIdDisplay";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  duplicateEntryKindLabel,
  duplicateEntryWarningMessage,
  type DuplicateEntryMatch
} from "@/lib/office-tasks/duplicate-entry-check";

type Props = {
  match: DuplicateEntryMatch | null;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirmAddAnyway: () => void;
};

export function DuplicateEntryWarningDialog({
  match,
  open,
  busy,
  onClose,
  onConfirmAddAnyway
}: Props) {
  useBodyScrollLock(open && Boolean(match));

  if (!open || !match) return null;

  const kind = duplicateEntryKindLabel(match);

  return (
    <ModalPortal>
      <div
        className="reset-dialog-backdrop no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-entry-dialog-title"
      >
        <div className="reset-dialog card">
          <p className="view-eyebrow text-amber-800">Possible duplicate</p>
          <h3 id="duplicate-entry-dialog-title" className="font-display text-xl font-semibold text-ink">
            Similar {kind} already exists
          </h3>
          <p className="mt-2 text-sm text-muted">{duplicateEntryWarningMessage(match)}</p>
          <p className="mt-2 text-xs text-muted">
            Registered as{" "}
            <SourceIdDisplay id={match.id} clientCase={match.clientCase} variant="mini" />
          </p>

          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-secondary flex-1 text-sm" disabled={busy} onClick={onClose}>
              Go back
            </button>
            <button
              type="button"
              className="btn-primary flex-1 text-sm"
              disabled={busy}
              onClick={onConfirmAddAnyway}
            >
              {busy ? "Saving…" : "Add anyway"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
