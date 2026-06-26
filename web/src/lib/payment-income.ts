import type { LedgerEntry } from "@/lib/gl-config";

/** Income types when recording a payment (matches walk-in service types). */
export const PAYMENT_INCOME_TYPES = [
  "Acceptance Fee",
  "Professional Fee",
  "Notarial Fee",
  "Appearance Fee",
  "Filing Fee",
  "Other"
] as const;

export type PaymentIncomeType = (typeof PAYMENT_INCOME_TYPES)[number];

const INCOME_TYPE_LOOKUP = new Map(
  PAYMENT_INCOME_TYPES.map((type) => [type.toLowerCase(), type])
);

export function normalizePaymentIncomeType(value: string | undefined | null): PaymentIncomeType {
  const text = String(value ?? "").trim();
  if (!text) return "Professional Fee";
  const direct = INCOME_TYPE_LOOKUP.get(text.toLowerCase());
  if (direct) return direct;

  const lower = text.toLowerCase();
  if (lower.includes("acceptance")) return "Acceptance Fee";
  if (lower.includes("appearance")) return "Appearance Fee";
  if (lower.includes("notarial") || lower.includes("notarization")) return "Notarial Fee";
  if (lower.includes("filing")) return "Filing Fee";
  if (lower.includes("professional")) return "Professional Fee";
  return "Other";
}

export function paymentCategoryFromIncomeType(type: PaymentIncomeType | string): string {
  return normalizePaymentIncomeType(type);
}

export function paymentDescriptionFromIncomeType(
  type: PaymentIncomeType | string,
  customDescription?: string
): string {
  const custom = customDescription?.trim();
  if (custom) return custom;
  const normalized = normalizePaymentIncomeType(type);
  if (normalized === "Other") return "Payment received";
  return normalized;
}

export function buildPaymentLedgerFields(
  incomeType: PaymentIncomeType | string,
  customDescription?: string
): { category: string; description: string } {
  const category = paymentCategoryFromIncomeType(incomeType);
  return {
    category,
    description: paymentDescriptionFromIncomeType(incomeType, customDescription)
  };
}

export function isGenericPaymentLabel(category: string, description: string): boolean {
  const cat = category.trim().toLowerCase();
  const desc = description.trim().toLowerCase();
  if (cat === "payment" && (desc === "payment received" || desc === "")) return true;
  if (!cat && (desc === "payment received" || desc === "")) return true;
  return false;
}

export function inferPaymentIncomeTypeFromLedger(entries: LedgerEntry[]): PaymentIncomeType {
  const charges = entries
    .filter((entry) => entry.type.toLowerCase() === "charge" && entry.charge > 0)
    .sort((a, b) => a.sheetRow - b.sheetRow);

  if (!charges.length) return "Professional Fee";

  const lastCharge = charges[charges.length - 1];
  return normalizePaymentIncomeType(lastCharge.category || lastCharge.description);
}

export function inferPaymentIncomeTypeFromPayment(
  category: string,
  description: string
): PaymentIncomeType {
  if (isGenericPaymentLabel(category, description)) return "Professional Fee";
  return normalizePaymentIncomeType(category || description);
}

/** Infer income type from receipt / payment free text (AR ceremony, SOA notes). */
export function inferPaymentIncomeTypeFromText(...parts: Array<string | undefined | null>): PaymentIncomeType {
  const haystack = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (!haystack) return "Professional Fee";
  return normalizePaymentIncomeType(haystack);
}
