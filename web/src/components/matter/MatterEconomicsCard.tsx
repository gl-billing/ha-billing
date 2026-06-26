"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldDispatchEntry, LedgerEntry } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { buildMatterEconomics, topIncomeMixLines } from "@/lib/matter-economics";

type Props = {
  clientCode: string;
  balance: number;
  retainerBalance: number;
  ledgerEntries: LedgerEntry[];
};

export function MatterEconomicsCard({
  clientCode,
  balance,
  retainerBalance,
  ledgerEntries
}: Props) {
  const [dispatches, setDispatches] = useState<FieldDispatchEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/field-dispatch`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.dispatches) setDispatches(json.dispatches as FieldDispatchEntry[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  const economics = useMemo(
    () =>
      buildMatterEconomics({
        balance,
        retainerBalance,
        ledgerEntries,
        fieldDispatches: dispatches
      }),
    [balance, retainerBalance, dispatches, ledgerEntries]
  );

  const incomeLines = topIncomeMixLines(economics.incomeMix);

  return (
    <section className="matter-economics card no-print" aria-label="Matter economics">
      <div className="matter-economics__head">
        <div>
          <p className="matter-economics__eyebrow">Partner view</p>
          <h2 className="matter-economics__title font-display">Matter economics</h2>
        </div>
        {economics.retainerDue > 0.005 ? (
          <span className="matter-economics__badge">Retainer due {formatPeso(economics.retainerDue)}</span>
        ) : null}
      </div>

      <div className="matter-economics__grid">
        <div className="matter-economics__metric">
          <span className="matter-economics__metric-label">Balance</span>
          <span className="matter-economics__metric-value amount-serif">{formatPeso(economics.balance)}</span>
        </div>
        <div className="matter-economics__metric">
          <span className="matter-economics__metric-label">Charges</span>
          <span className="matter-economics__metric-value amount-serif">{formatPeso(economics.chargesTotal)}</span>
        </div>
        <div className="matter-economics__metric">
          <span className="matter-economics__metric-label">Payments</span>
          <span className="matter-economics__metric-value amount-serif">{formatPeso(economics.paymentsTotal)}</span>
        </div>
        <div className="matter-economics__metric">
          <span className="matter-economics__metric-label">Appearance fees</span>
          <span className="matter-economics__metric-value amount-serif">
            {formatPeso(economics.appearanceFeesTotal)}
          </span>
        </div>
        <div className="matter-economics__metric">
          <span className="matter-economics__metric-label">Field dispatch</span>
          <span className="matter-economics__metric-value amount-serif">
            {formatPeso(economics.fieldDispatchSpend)}
          </span>
          {economics.openFieldDispatchCount > 0 ? (
            <span className="matter-economics__metric-hint">
              {economics.openFieldDispatchCount} trip{economics.openFieldDispatchCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="matter-economics__metric">
          <span className="matter-economics__metric-label">Retainer held</span>
          <span className="matter-economics__metric-value amount-serif">
            {formatPeso(economics.retainerBalance)}
          </span>
        </div>
      </div>

      {incomeLines.length ? (
        <div className="matter-economics__mix">
          <p className="matter-economics__mix-label">Income mix</p>
          <ul className="matter-economics__mix-list">
            {incomeLines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <span className="amount-serif">{formatPeso(line.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
