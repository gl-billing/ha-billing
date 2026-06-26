import type { BillingTriggerKind } from "@/lib/billing-task-triggers";

const BILLING_TRIGGER_RE = /BILLING_TRIGGER:(CHARGE|PAYMENT|SOA|AR):/i;

export function parseBillingTriggerKind(remarks: string): BillingTriggerKind | null {
  const match = remarks.match(BILLING_TRIGGER_RE);
  if (!match) return null;
  return match[1].toLowerCase() as BillingTriggerKind;
}

export function isBillingChargeTask(remarks: string): boolean {
  return parseBillingTriggerKind(remarks) === "charge";
}

export function isBillingPaymentTask(remarks: string): boolean {
  return parseBillingTriggerKind(remarks) === "payment";
}

/** Guided workflows for charge/payment only — not SOA/AR send or follow-up. */
export function billingAdminTaskActionLabel(remarks: string): string | null {
  const kind = parseBillingTriggerKind(remarks);
  if (kind === "charge") return "Review charge";
  if (kind === "payment") return "Confirm payment";
  return null;
}

export function billingAdminTaskHint(remarks: string): string | null {
  const kind = parseBillingTriggerKind(remarks);
  if (kind === "charge") {
    return "Open the matter ledger, confirm the charge entry, then mark done.";
  }
  if (kind === "payment") {
    return "Confirm retainer update and receipt; generate AR if needed, then mark done.";
  }
  return null;
}
