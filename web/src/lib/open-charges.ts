import type { LedgerEntry } from "@/lib/gl-config";
import { normalizePaymentIncomeType, type PaymentIncomeType } from "@/lib/payment-income";

export type OpenChargeOption = {
  sheetRow: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  incomeType: PaymentIncomeType;
  /** Charge ledger details — event billing metadata for lawyer attribution on payment. */
  details: string;
  display: string;
};

function formatPeso(value: number): string {
  return `₱${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Recent charge lines staff can match when recording a payment. */
export function listOpenChargesFromLedger(entries: LedgerEntry[], limit = 8): OpenChargeOption[] {
  return entries
    .filter((entry) => entry.type.toLowerCase() === "charge" && entry.charge > 0)
    .sort((a, b) => b.sheetRow - a.sheetRow)
    .slice(0, limit)
    .map((entry) => {
      const incomeType = normalizePaymentIncomeType(entry.category || entry.description);
      const label = entry.description || entry.category || "Charge";
      return {
        sheetRow: entry.sheetRow,
        date: entry.date,
        category: entry.category,
        description: entry.description,
        amount: entry.charge,
        incomeType,
        details: entry.details || "",
        display: `${entry.date} · ${formatPeso(entry.charge)} · ${label}`
      };
    });
}
