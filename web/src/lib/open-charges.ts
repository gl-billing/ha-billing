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

function normalizeLabel(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function paymentMatchesCharge(payment: LedgerEntry, charge: LedgerEntry): boolean {
  const payDesc = normalizeLabel(payment.description);
  const payCat = normalizeLabel(payment.category);
  const chargeDesc = normalizeLabel(charge.description);
  const chargeCat = normalizeLabel(charge.category);
  const chargeLabel = chargeDesc || chargeCat;

  if (payDesc && chargeLabel && payDesc === chargeLabel) return true;
  if (payDesc && chargeDesc && payDesc === chargeDesc) return true;
  if (payCat && chargeCat && payCat === chargeCat) return true;

  const payIncome = normalizePaymentIncomeType(payment.category || payment.description);
  const chargeIncome = normalizePaymentIncomeType(charge.category || charge.description);
  if (payIncome !== "Other" && payIncome === chargeIncome) return true;

  return false;
}

/**
 * Remaining unpaid amount per charge row.
 * Prefers explicit `chargeRow:N` links; otherwise matches payments to the latest
 * prior charge with the same description / income type (covers partial pays made
 * before linking existed).
 */
export function remainingByChargeRow(entries: LedgerEntry[]): Map<number, number> {
  const charges = entries
    .filter((entry) => entry.type.toLowerCase() === "charge" && entry.charge > 0)
    .sort((a, b) => a.sheetRow - b.sheetRow);

  const remaining = new Map<number, number>();
  for (const charge of charges) {
    remaining.set(charge.sheetRow, Number(charge.charge) || 0);
  }

  const payments = entries
    .filter((entry) => entry.type.toLowerCase() === "payment" && entry.payment > 0)
    .sort((a, b) => a.sheetRow - b.sheetRow);

  for (const payment of payments) {
    let left = Number(payment.payment) || 0;
    if (left <= PAID_EPSILON) continue;

    const linkedRow = parseAppliedChargeRow(payment.details || "");
    if (linkedRow && remaining.has(linkedRow)) {
      const current = remaining.get(linkedRow) || 0;
      const applied = Math.min(left, current);
      remaining.set(linkedRow, current - applied);
      left -= applied;
    }

    if (left <= PAID_EPSILON) continue;

    // Unlinked / leftover: apply to the latest matching charge before this payment.
    const candidates = charges
      .filter(
        (charge) =>
          charge.sheetRow < payment.sheetRow &&
          (remaining.get(charge.sheetRow) || 0) > PAID_EPSILON &&
          paymentMatchesCharge(payment, charge)
      )
      .sort((a, b) => b.sheetRow - a.sheetRow);

    for (const charge of candidates) {
      if (left <= PAID_EPSILON) break;
      const current = remaining.get(charge.sheetRow) || 0;
      if (current <= PAID_EPSILON) continue;
      const applied = Math.min(left, current);
      remaining.set(charge.sheetRow, current - applied);
      left -= applied;
    }
  }

  return remaining;
}

/** Recent charge lines with remaining balance staff can match when recording a payment. */
export function listOpenChargesFromLedger(entries: LedgerEntry[], limit = 8): OpenChargeOption[] {
  const remainingByRow = remainingByChargeRow(entries);

  return entries
    .filter((entry) => entry.type.toLowerCase() === "charge" && entry.charge > 0)
    .map((entry) => {
      const originalAmount = Number(entry.charge) || 0;
      const remaining = Math.max(0, remainingByRow.get(entry.sheetRow) ?? originalAmount);
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
