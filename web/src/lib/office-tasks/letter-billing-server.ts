import "server-only";

import { validateLedgerBillingClientAlignment } from "@/lib/ledger-billing-client-match";
import { normalizePaymentMethod } from "@/lib/gl-config";
import { resolveEventLedgerBillingCode } from "@/lib/event-ledger-charge-server";
import { triggerTaskOnCharge, triggerTaskOnPayment } from "@/lib/billing-task-triggers";
import { letterBillingMarker } from "@/lib/office-tasks/letter-billing";
import {
  resolvedLetterTypeLabel,
  type LetterCorrespondenceInput
} from "@/lib/office-tasks/letter-task-utils";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { addLedgerEntry } from "@/lib/sheets/ledger";

export async function postLetterCorrespondenceBilling(
  accessToken: string,
  input: {
    clientCase: string;
    letter: LetterCorrespondenceInput;
    taskId: string;
    auditUser?: string;
  }
): Promise<{ posted: boolean; message?: string; marker?: string; clientCode?: string }> {
  if (!input.letter.billThis) return { posted: false };

  const amount = Number(input.letter.billAmount) || 0;
  if (amount <= 0) {
    return { posted: false, message: "Enter a valid billing amount." };
  }

  const billing = await resolveEventLedgerBillingCode(accessToken, {
    clientCase: input.clientCase
  });
  const clientCode = billing.code;
  if (!clientCode) {
    return {
      posted: false,
      message: "Select a billing client file before posting letter charges."
    };
  }

  const alignmentError = validateLedgerBillingClientAlignment({
    clientCase: input.clientCase,
    ledgerClientCode: clientCode,
    confirmed: input.letter.billingConfirmed === true
  });
  if (alignmentError) {
    return { posted: false, message: alignmentError };
  }

  const letterLabel = resolvedLetterTypeLabel(input.letter.letterType, input.letter.letterTypeOther);
  const recipient = input.letter.recipient.trim();
  const description = `Letter / correspondence — ${letterLabel}${recipient ? ` — ${recipient}` : ""} (${input.taskId})`;
  const chargeDate = todayYmd();
  const audit = input.auditUser ? { auditUser: input.auditUser } : undefined;
  const timing = input.letter.billTiming || "client_billing";

  const chargePayload = {
    clientCode,
    type: "Charge" as const,
    date: chargeDate,
    category: "Professional Fee",
    description,
    charge: amount
  };

  await addLedgerEntry(accessToken, chargePayload, audit);
  try {
    await triggerTaskOnCharge(accessToken, chargePayload);
  } catch {
    /* best-effort ops alert */
  }

  if (timing === "pay_now") {
    const method =
      normalizePaymentMethod(input.letter.billPaymentMethod || "") ||
      input.letter.billPaymentMethod?.trim() ||
      "Cash";
    const paymentPayload = {
      clientCode,
      type: "Payment" as const,
      date: chargeDate,
      category: "Professional Fee",
      description: `Payment — ${description}`,
      payment: amount,
      method
    };
    await addLedgerEntry(accessToken, paymentPayload, audit);
    try {
      await triggerTaskOnPayment(accessToken, paymentPayload);
    } catch {
      /* best-effort */
    }
  }

  const marker = letterBillingMarker(timing, amount);
  const timingLabel =
    timing === "pay_now" ? "Payment recorded on client ledger." : "Charge added to client billing file.";

  return {
    posted: true,
    marker,
    clientCode,
    message: `${timingLabel} (₱${amount.toLocaleString("en-PH")} · ${clientCode}).`
  };
}
