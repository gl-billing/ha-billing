"use client";

import { useState } from "react";
import type { FilingProofWarning } from "@/lib/matter-automation";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

type Props = {
  warnings: FilingProofWarning[];
  itemsById?: Map<string, OfficeItem>;
  onJump: (anchorId: string) => void;
  onStatus?: (message: string, isError?: boolean) => void;
  onRefresh?: () => void | Promise<void>;
};

export function MatterFilingProofWarnings({
  warnings,
  itemsById,
  onJump,
  onStatus,
  onRefresh
}: Props) {
  const [busyId, setBusyId] = useState("");

  if (!warnings.length) return null;

  async function markProofDone(warning: FilingProofWarning) {
    const item = itemsById?.get(warning.itemId);
    if (!item) {
      onJump(warning.anchorId);
      return;
    }

    setBusyId(warning.itemId);
    try {
      const res = await fetch("/api/tasks/items/filing-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.source,
          rowNumber: item.rowNumber,
          itemId: item.id,
          clientCase: item.clientCase
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed.");
      onStatus?.(json.message || "Filing proof marked complete.");
      await onRefresh?.();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Update failed.", true);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="matter-filing-proof-warnings no-print" aria-label="Filing proof reminders">
      {warnings.map((warning) => (
        <div key={warning.itemId} className="matter-post-hearing-warnings__card" role="status">
          <p className="matter-post-hearing-warnings__title">Proof of filing pending</p>
          <p className="matter-post-hearing-warnings__text">{warning.message}</p>
          <div className="matter-post-hearing-warnings__actions">
            <button
              type="button"
              className="btn-gold matter-post-hearing-warnings__link"
              disabled={busyId === warning.itemId}
              onClick={() => void markProofDone(warning)}
            >
              {busyId === warning.itemId ? "Saving…" : "Mark proof received"}
            </button>
            <button
              type="button"
              className="matter-post-hearing-warnings__link"
              onClick={() => onJump(warning.anchorId)}
            >
              Open {warning.filingLabel}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
