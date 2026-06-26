"use client";

import {
  formatLitigationAcceptanceFee,
  litigationAppearanceFeeRowsForIntake,
  resolveLitigationFeeSchedule
} from "@/lib/engagement-letter";

type Props = {
  courtPending: string;
  disabled?: boolean;
  onExampleCourtSelect?: (example: string) => void;
};

export function LitigationAppearanceFeeTable({ courtPending, disabled, onExampleCourtSelect }: Props) {
  const rows = litigationAppearanceFeeRowsForIntake();
  const selectedTier = resolveLitigationFeeSchedule(courtPending).tier;
  const selectedSchedule = resolveLitigationFeeSchedule(courtPending);

  return (
    <div className="litigation-fee-table">
      <p className="litigation-fee-table__lede text-[11px] leading-relaxed text-muted">
        Choose where the case will be filed (court on step 2). The matching row suggests an appearance fee — enter or
        adjust the amount in the appearance fee field above. Appearance fees are exclusive of gas, meal, and
        accommodation expenses.
      </p>
      {courtPending.trim() ? (
        <p className="mt-2 text-xs text-ink">
          Selected for <strong>{courtPending.trim()}</strong>: appearance fee{" "}
          <strong>{formatLitigationAcceptanceFee(selectedSchedule.appearanceFee)}</strong> per hearing.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-muted">Enter the court on step 2 to highlight the matching row.</p>
      )}
      <div className="mt-3 overflow-x-auto rounded-md border border-line/70">
        <table className="litigation-fee-table__grid w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="border-b border-line/70 bg-soft/60 text-[10px] font-extrabold uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Where the case will be filed</th>
              <th className="px-3 py-2">Example courts / areas</th>
              <th className="px-3 py-2">Appearance fee</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.tier === selectedTier && Boolean(courtPending.trim());
              return (
                <tr
                  key={row.tier}
                  className={`border-b border-line/40 last:border-b-0 ${selected ? "litigation-fee-table__row--selected bg-gold/10" : ""}`}
                >
                  <td className="px-3 py-2 align-top text-ink">{row.filingArea}</td>
                  <td className="px-3 py-2 align-top text-muted">
                    {onExampleCourtSelect ? (
                      <button
                        type="button"
                        className="text-left underline decoration-line/80 underline-offset-2 hover:text-ink disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => onExampleCourtSelect(row.exampleCourts.split(",")[0]?.trim() || row.exampleCourts)}
                      >
                        {row.exampleCourts}
                      </button>
                    ) : (
                      row.exampleCourts
                    )}
                  </td>
                  <td className="px-3 py-2 align-top font-bold text-ink">{row.appearanceFeeLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
