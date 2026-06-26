import type { FieldDispatchEntry, LedgerEntry } from "@/lib/gl-config";
import { fieldDispatchBillableTotal, fieldDispatchIsReconciled } from "@/lib/gl-config";
import { normalizePaymentIncomeType, type PaymentIncomeType } from "@/lib/payment-income";

export type MatterEconomics = {
  balance: number;
  retainerBalance: number;
  retainerDue: number;
  chargesTotal: number;
  paymentsTotal: number;
  appearanceFeesTotal: number;
  fieldDispatchSpend: number;
  openFieldDispatchCount: number;
  incomeMix: Partial<Record<PaymentIncomeType, number>>;
};

function findRetainerDue(entries: LedgerEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const haystack = `${entry.category} ${entry.description}`.toLowerCase();
    if (!haystack.includes("retainer")) continue;
    const due = Math.max(0, entry.charge - entry.payment);
    if (due > 0.005) return due;
  }
  return 0;
}

export function buildMatterEconomics(input: {
  balance: number;
  retainerBalance: number;
  ledgerEntries: LedgerEntry[];
  fieldDispatches: FieldDispatchEntry[];
}): MatterEconomics {
  const incomeMix: Partial<Record<PaymentIncomeType, number>> = {};
  let chargesTotal = 0;
  let paymentsTotal = 0;
  let appearanceFeesTotal = 0;

  for (const entry of input.ledgerEntries) {
    chargesTotal += entry.charge;
    paymentsTotal += entry.payment;
    if (/appearance fee/i.test(entry.category)) {
      appearanceFeesTotal += entry.charge;
    }
    const incomeType = normalizePaymentIncomeType(`${entry.category} ${entry.description}`);
    if (entry.charge > 0) {
      incomeMix[incomeType] = (incomeMix[incomeType] || 0) + entry.charge;
    }
  }

  const openFieldDispatch = input.fieldDispatches.filter((entry) => entry.status.toLowerCase() !== "deleted");
  const fieldDispatchSpend = openFieldDispatch.reduce((sum, entry) => {
    try {
      return sum + fieldDispatchBillableTotal(entry.advanceGiven, entry.returnedToOffice, entry.serviceFee, fieldDispatchIsReconciled(entry));
    } catch {
      return sum + Math.max(0, entry.serviceFee);
    }
  }, 0);

  return {
    balance: input.balance,
    retainerBalance: input.retainerBalance,
    retainerDue: findRetainerDue(input.ledgerEntries),
    chargesTotal: Math.round(chargesTotal * 100) / 100,
    paymentsTotal: Math.round(paymentsTotal * 100) / 100,
    appearanceFeesTotal: Math.round(appearanceFeesTotal * 100) / 100,
    fieldDispatchSpend: Math.round(fieldDispatchSpend * 100) / 100,
    openFieldDispatchCount: openFieldDispatch.length,
    incomeMix
  };
}

export function formatIncomeMixLabel(type: PaymentIncomeType): string {
  if (type === "Appearance Fee") return "Appearance";
  if (type === "Professional Fee") return "Professional";
  if (type === "Acceptance Fee") return "Acceptance";
  if (type === "Notarial Fee") return "Notarial";
  return type;
}

export function topIncomeMixLines(
  incomeMix: Partial<Record<PaymentIncomeType, number>>
): Array<{ label: string; amount: number }> {
  return Object.entries(incomeMix)
    .filter(([, amount]) => (amount || 0) > 0)
    .map(([type, amount]) => ({
      label: formatIncomeMixLabel(type as PaymentIncomeType),
      amount: Math.round((amount || 0) * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);
}
