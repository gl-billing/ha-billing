"use client";

import type { OpenChargeOption } from "@/lib/open-charges";
import { formatPeso } from "@/lib/gl-config";

type Props = {
  charges: OpenChargeOption[];
  disabled?: boolean;
  onPick: (charge: OpenChargeOption) => void;
};

export function OpenChargePicker({ charges, disabled, onPick }: Props) {
  if (!charges.length) return null;

  return (
    <div className="open-charge-picker">
      <p className="open-charge-picker__label">Pay an open charge</p>
      <div className="open-charge-picker__chips">
        {charges.map((charge) => (
          <button
            key={charge.sheetRow}
            type="button"
            className="open-charge-picker__chip"
            disabled={disabled}
            onClick={() => onPick(charge)}
            title={charge.display}
          >
            <span className="open-charge-picker__chip-amount">{formatPeso(charge.amount)}</span>
            <span className="open-charge-picker__chip-text">
              {charge.description || charge.category || "Charge"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
