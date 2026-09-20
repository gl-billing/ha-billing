import type { LedgerEntry } from "@/lib/ha-config";
import { parseAppliedChargeRow } from "@/lib/ledger-display";
import { normalizePaymentIncomeType, type PaymentIncomeType } from "@/lib/payment-income";

export type OpenChargeOption = {
  sheetRow: number;
  date: string;
  category: string;
  description: string;
  /** Remaining unpaid amount on this charge (original charge minus applied payments). */
  amount: number;
  /** Original charge amount before applied payments. */
  originalAmount: number;
  incomeType: PaymentIncomeType;
  /** Charge ledger details — event billing metadata for lawyer attribution on payment. */
  details: string;
  display: string;
};

const PAID_EPSILON = 0.005;

function formatPeso(value: number): string {
  return `₱${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function appliedPaymentsByChargeRow(entries: LedgerEntry[]): Map<number, number> {
  const applied = new Map<number, number>();
  for (const entry of entries) {
    if (entry.type.toLowerCase() !== "payment") continue;
    const payment = Number(entry.payment) || 0;
    if (payment <= 0) continue;
    const chargeRow = parseAppliedChargeRow(entry.details || "");
    if (!chargeRow) continue;
    applied.set(chargeRow, (applied.get(chargeRow) || 0) + payment);
  }
  return applied;
}

/** Recent charge lines with remaining balance staff can match when recording a payment. */
export function listOpenChargesFromLedger(entries: LedgerEntry[], limit = 8): OpenChargeOption[] {
  const appliedByRow = appliedPaymentsByChargeRow(entries);

  return entries
    .filter((entry) => entry.type.toLowerCase() === "charge" && entry.charge > 0)
    .map((entry) => {
      const originalAmount = Number(entry.charge) || 0;
      const applied = appliedByRow.get(entry.sheetRow) || 0;
      const remaining = Math.max(0, originalAmount - applied);
      const incomeType = normalizePaymentIncomeType(entry.category || entry.description);
      const label = entry.description || entry.category || "Charge";
      const amountLabel =
        remaining + PAID_EPSILON < originalAmount
          ? `${formatPeso(remaining)} left of ${formatPeso(originalAmount)}`
          : formatPeso(remaining);
      return {
        sheetRow: entry.sheetRow,
        date: entry.date,
        category: entry.category,
        description: entry.description,
        amount: remaining,
        originalAmount,
        incomeType,
        details: entry.details || "",
        display: `${entry.date} · ${amountLabel} · ${label}`
      };
    })
    .filter((charge) => charge.amount > PAID_EPSILON)
    .sort((a, b) => b.sheetRow - a.sheetRow)
    .slice(0, limit);
}
