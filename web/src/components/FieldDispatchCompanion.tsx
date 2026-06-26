"use client";

import { useMemo, useState } from "react";
import type { FieldDispatchEntry } from "@/lib/gl-config";
import {
  fieldDispatchBillableTotal,
  fieldDispatchHasReturnedInput,
  fieldDispatchIsReconciled,
  fieldDispatchSalaryCredit,
  fieldDispatchSpentAmount,
  formatPeso
} from "@/lib/gl-config";
import { matterHref } from "@/lib/matter-routes";

type Props = {
  dispatches: FieldDispatchEntry[];
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  onReconciled: () => void | Promise<void>;
};

function isActiveTrip(entry: FieldDispatchEntry): boolean {
  if (entry.status.toLowerCase() === "deleted") return false;
  return !fieldDispatchIsReconciled(entry);
}

export function FieldDispatchCompanion({ dispatches, busy, onBusy, onStatus, onReconciled }: Props) {
  const activeTrips = useMemo(
    () =>
      dispatches
        .filter(isActiveTrip)
        .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [dispatches]
  );
  const [returnedById, setReturnedById] = useState<Record<string, string>>({});
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  if (!activeTrips.length) return null;

  async function submitReconcile(entry: FieldDispatchEntry) {
    const returned = returnedById[entry.dispatchId] ?? "";
    if (!fieldDispatchHasReturnedInput(returned)) {
      onStatus("Enter change returned to office.", true);
      return;
    }
    setReconcilingId(entry.dispatchId);
    onBusy(true);
    try {
      const res = await fetch(`/api/field-dispatch/${encodeURIComponent(entry.dispatchId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reconcile",
          returnedToOffice: returned,
          notes: entry.notes
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not reconcile trip.");
      onStatus(json.message || "Trip reconciled.");
      setReturnedById((prev) => {
        const next = { ...prev };
        delete next[entry.dispatchId];
        return next;
      });
      await onReconciled();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not reconcile trip.", true);
    } finally {
      setReconcilingId(null);
      onBusy(false);
    }
  }

  return (
    <section className="field-dispatch-companion no-print" aria-label="Active field trips">
      <div className="field-dispatch-companion__head">
        <div>
          <p className="field-dispatch-companion__eyebrow">Mobile companion</p>
          <h3 className="field-dispatch-companion__title font-display">Active trips</h3>
          <p className="field-dispatch-companion__lede">
            Reconcile change returned when Jas is back — bill client from the register below.
          </p>
        </div>
        <span className="field-dispatch-companion__count">{activeTrips.length} open</span>
      </div>

      <div className="field-dispatch-companion__cards">
        {activeTrips.map((entry) => {
          const returned = returnedById[entry.dispatchId] ?? "";
          const hasReturned = fieldDispatchHasReturnedInput(returned);
          const spent = hasReturned ? fieldDispatchSpentAmount(entry.advanceGiven, returned) : 0;
          const billable = hasReturned
            ? fieldDispatchBillableTotal(entry.advanceGiven, returned, entry.serviceFee, true)
            : Math.max(0, entry.serviceFee);
          const salaryCredit = hasReturned ? fieldDispatchSalaryCredit(entry.serviceFee, returned, true) : 0;
          const reconciling = reconcilingId === entry.dispatchId;

          return (
            <article key={entry.dispatchId} className="field-dispatch-companion__card">
              <div className="field-dispatch-companion__card-top">
                <div>
                  <p className="field-dispatch-companion__location">{entry.location}</p>
                  <p className="field-dispatch-companion__sub">
                    {entry.date} · {entry.purpose}
                    {entry.clientCode ? (
                      <>
                        {" · "}
                        <a href={matterHref(entry.clientCode)} className="field-dispatch-companion__link">
                          {entry.clientCode}
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <span className="field-dispatch-companion__advance amount-serif">
                  {formatPeso(entry.advanceGiven)}
                </span>
              </div>

              <label className="field-dispatch-companion__field">
                <span>Change returned</span>
                <input
                  className="field"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={returned}
                  disabled={busy || reconciling}
                  onChange={(e) =>
                    setReturnedById((prev) => ({ ...prev, [entry.dispatchId]: e.target.value }))
                  }
                />
              </label>

              {hasReturned ? (
                <dl className="field-dispatch-companion__preview">
                  <div>
                    <dt>Spent</dt>
                    <dd className="amount-serif">{formatPeso(spent)}</dd>
                  </div>
                  <div>
                    <dt>Bill client</dt>
                    <dd className="amount-serif">{formatPeso(billable)}</dd>
                  </div>
                  <div>
                    <dt>Jas credit</dt>
                    <dd className="amount-serif">{formatPeso(salaryCredit)}</dd>
                  </div>
                </dl>
              ) : null}

              <button
                type="button"
                className="btn-gold field-dispatch-companion__submit"
                disabled={busy || reconciling || !hasReturned}
                onClick={() => void submitReconcile(entry)}
              >
                {reconciling ? "Saving…" : "Reconcile trip"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
