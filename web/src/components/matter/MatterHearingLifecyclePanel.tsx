"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppearanceFeeOption } from "@/lib/sheets/ledger-read";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  buildHearingLifecycleStates,
  hearingLifecycleOpenCount,
  suggestedAppearanceCharge
} from "@/lib/hearing-lifecycle";
import { formatPeso } from "@/lib/gl-config";

export type MatterChargeDraft = {
  category: string;
  description: string;
  amount?: string;
};

type Props = {
  events: OfficeItem[];
  clientCode: string;
  busy?: boolean;
  onStatus: (message: string, isError?: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onDraftCharge: (draft: MatterChargeDraft) => void;
};

function itemActionPayload(item: OfficeItem) {
  return {
    source: item.source,
    rowNumber: item.rowNumber,
    itemId: item.id,
    clientCase: item.clientCase
  };
}

export function MatterHearingLifecyclePanel({
  events,
  clientCode,
  busy,
  onStatus,
  onRefresh,
  onDraftCharge
}: Props) {
  const [appearanceFees, setAppearanceFees] = useState<AppearanceFeeOption[]>([]);
  const [confirmingKey, setConfirmingKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/appearance-fees`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.appearanceFees) {
          setAppearanceFees(json.appearanceFees as AppearanceFeeOption[]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  const states = useMemo(
    () => buildHearingLifecycleStates(events, appearanceFees),
    [appearanceFees, events]
  );

  const openCount = hearingLifecycleOpenCount(states);
  const upcoming = states.filter((state) => !state.item.done);

  const markCourtConfirmed = useCallback(
    async (item: OfficeItem) => {
      const key = `${item.source}-${item.rowNumber}`;
      setConfirmingKey(key);
      try {
        const res = await fetch("/api/tasks/items/court-confirmed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemActionPayload(item))
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed.");
        onStatus(json.message || "Court confirmed.");
        await onRefresh();
      } catch (error) {
        onStatus(error instanceof Error ? error.message : "Update failed.", true);
      } finally {
        setConfirmingKey("");
      }
    },
    [onRefresh, onStatus]
  );

  if (!upcoming.length) return null;

  return (
    <section className="matter-hearing-lifecycle card no-print" aria-label="Hearing lifecycle">
      <div className="matter-hearing-lifecycle__head">
        <div>
          <p className="matter-hearing-lifecycle__eyebrow">Tasks + billing</p>
          <h2 className="matter-hearing-lifecycle__title font-display">Hearing lifecycle</h2>
          <p className="matter-hearing-lifecycle__lede">
            Confirm court dates, prep checklist, and draft appearance fees from one place.
          </p>
        </div>
        {openCount > 0 ? (
          <span className="matter-hearing-lifecycle__badge">
            {openCount} need{openCount === 1 ? "s" : ""} court confirm
          </span>
        ) : null}
      </div>

      <ul className="matter-hearing-lifecycle__list">
        {upcoming.map((state) => {
          const item = state.item;
          const key = `${item.source}-${item.rowNumber}`;
          const draft = suggestedAppearanceCharge(item);
          const feeAmount = state.linkedAppearanceFee?.amount;
          const confirming = confirmingKey === key;

          return (
            <li key={key} className="matter-hearing-lifecycle__item">
              <div className="matter-hearing-lifecycle__item-main">
                <p className="matter-hearing-lifecycle__item-title">{item.details.trim() || "Hearing"}</p>
                <p className="matter-hearing-lifecycle__item-meta">
                  {item.date || item.eventDate || "Date TBD"}
                  {item.venue?.trim() ? ` · ${item.venue.trim()}` : ""}
                  {item.startTime?.trim() ? ` · ${item.startTime.trim()}` : ""}
                </p>
                <ul className="matter-hearing-lifecycle__prep">
                  {state.prepItems.slice(0, 3).map((prep) => (
                    <li key={prep}>{prep}</li>
                  ))}
                </ul>
              </div>

              <div className="matter-hearing-lifecycle__actions">
                {state.needsCourtConfirmation ? (
                  <button
                    type="button"
                    className="btn-gold matter-hearing-lifecycle__btn"
                    disabled={busy || confirming}
                    onClick={() => void markCourtConfirmed(item)}
                  >
                    {confirming ? "Saving…" : "Court confirmed"}
                  </button>
                ) : state.courtConfirmed ? (
                  <span className="matter-hearing-lifecycle__confirmed">Court confirmed</span>
                ) : null}

                <button
                  type="button"
                  className="btn-secondary matter-hearing-lifecycle__btn"
                  disabled={busy}
                  onClick={() =>
                    onDraftCharge({
                      category: draft.category,
                      description: draft.description,
                      amount: feeAmount ? String(feeAmount) : undefined
                    })
                  }
                >
                  Draft appearance fee
                  {feeAmount ? ` · ${formatPeso(feeAmount)}` : ""}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
