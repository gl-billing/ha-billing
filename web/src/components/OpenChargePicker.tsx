"use client";

import type { OpenChargeOption } from "@/lib/open-charges";
import { formatPeso } from "@/lib/ha-config";

type Props = {
  charges: OpenChargeOption[];
  selectedSheetRow?: number | null;
  disabled?: boolean;
  onPick: (charge: OpenChargeOption) => void;
};

export function OpenChargePicker({ charges, selectedSheetRow, disabled, onPick }: Props) {
  if (!charges.length) return null;

  return (
    <div className="open-charge-picker">
      <p className="open-charge-picker__label">Pay an open charge</p>
      <div className="open-charge-picker__chips">
        {charges.map((charge) => {
          const selected = selectedSheetRow === charge.sheetRow;
          const partial = charge.amount + 0.005 < charge.originalAmount;
          return (
            <button
              key={charge.sheetRow}
              type="button"
              className={`open-charge-picker__chip${selected ? " open-charge-picker__chip--selected" : ""}`}
              disabled={disabled}
              onClick={() => onPick(charge)}
              title={charge.display}
              aria-pressed={selected}
            >
              <span className="open-charge-picker__chip-amount">{formatPeso(charge.amount)}</span>
              <span className="open-charge-picker__chip-text">
                {charge.description || charge.category || "Charge"}
                {partial ? " · remaining" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
