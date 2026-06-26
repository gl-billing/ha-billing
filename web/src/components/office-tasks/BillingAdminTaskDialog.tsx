"use client";

import Link from "next/link";
import { ModalPortal } from "@/components/ModalPortal";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  billingAdminTaskHint,
  isBillingChargeTask,
  isBillingPaymentTask,
  parseBillingTriggerKind
} from "@/lib/billing-admin-tasks";
import { clientCodeFromCase } from "@/lib/office-tasks/client-matter";
import { matterHref } from "@/lib/matter-routes";

type Props = {
  item: ItemSummary;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onStatus?: (message: string, isError?: boolean) => void;
};

export function BillingAdminTaskDialog({ item, open, busy = false, onClose, onComplete, onStatus }: Props) {
  useBodyScrollLock(open);

  const remarks = item.remarks?.trim() || "";
  const kind = parseBillingTriggerKind(remarks);
  const clientCase = item.clientCase?.trim() || "";
  const clientCode = clientCodeFromCase(clientCase);
  const matterLink = clientCode ? matterHref(clientCode, undefined, { case: clientCase, section: "add" }) : null;
  const hint = billingAdminTaskHint(remarks);
  const title = isBillingChargeTask(remarks)
    ? "Review charge"
    : isBillingPaymentTask(remarks)
      ? "Confirm payment"
      : "Billing task";

  if (!open || !kind) return null;

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="billing-admin-task-title">
        <div className="modal-panel max-h-[92vh] w-full max-w-lg overflow-y-auto">
          <h2 id="billing-admin-task-title" className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {clientCase || "—"} · {item.details?.trim() || "Billing follow-up"}
          </p>

          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted">{hint}</p>
            {item.nextAction?.trim() ? (
              <p className="rounded-md border border-line/70 bg-soft/40 px-3 py-2 text-xs text-ink">
                <strong>Next:</strong> {item.nextAction.trim()}
              </p>
            ) : null}

            {kind === "charge" ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
                <li>Open the matter ledger and confirm the charge amount, category, and description.</li>
                <li>Update client notes if the charge needs clarification.</li>
              </ul>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
                <li>Confirm the payment posted to the ledger and retainer balance updated.</li>
                <li>Send or file the official receipt if not already sent.</li>
                <li>Generate AR separately when needed — this task is not for SOA/AR follow-up.</li>
              </ul>
            )}

            {matterLink ? (
              <Link href={matterLink} className="btn-secondary inline-flex !text-xs" onClick={onClose}>
                Open matter ledger
              </Link>
            ) : (
              <p className="text-[11px] text-muted">Could not resolve matter link from this task label.</p>
            )}

            <button
              type="button"
              className="btn-primary !text-xs"
              disabled={busy}
              onClick={() => {
                onComplete?.();
                onClose();
                onStatus?.("Billing task marked done.");
              }}
            >
              Mark done
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-secondary !text-xs" disabled={busy} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
