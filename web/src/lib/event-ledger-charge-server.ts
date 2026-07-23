import {
  buildEventLedgerChargeDescription,
  findEventLedgerCharge,
  resolveEventLedgerChargeAmount,
  resolveEventLedgerChargeCategory
} from "@/lib/event-ledger-charge";
import {
  buildEventLedgerChargePostedNotice,
  formatPostedLedgerChargeNotice
} from "@/lib/ledger-charge-notices";
import { validateLedgerBillingClientAlignment } from "@/lib/ledger-billing-client-match";
import { normalizePaymentMethod } from "@/lib/gl-config";
import { triggerTaskOnCharge, triggerTaskOnPayment } from "@/lib/billing-task-triggers";
import {
  clientCodeFromCase,
  parseExplicitLabelCode
} from "@/lib/office-tasks/client-matter";
import { todayYmd } from "@/lib/office-tasks/schedule";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { addLedgerEntry, editLedgerEntry } from "@/lib/sheets/ledger";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { findClientForTaskCode, findMasterRow } from "@/lib/sheets/master";

/** When staff chose to bill, a silent miss is not acceptable — surface a clear error. */
export function requireLedgerBillingPosted(
  requested: boolean,
  result: { posted: boolean; message?: string },
  fallback = "Could not post to the client ledger. Open the matter billing tab and add the charge manually."
): string | null {
  if (!requested || result.posted) return null;
  return result.message?.trim() || fallback;
}

export async function resolveEventLedgerBillingCode(
  accessToken: string,
  form: Pick<EventFormInput, "ledgerClientCode" | "clientCase">
): Promise<{ code: string; courtPending?: string }> {
  const direct = form.ledgerClientCode?.trim().toUpperCase();
  if (direct) {
    const found = await findMasterRow(accessToken, direct);
    if (found) {
      return {
        code: direct,
        courtPending: String(found.values[5] || "").trim() || undefined
      };
    }

    const directDetail = await findClientForTaskCode(accessToken, direct);
    if (directDetail?.code?.trim()) {
      return {
        code: directDetail.code.trim().toUpperCase(),
        courtPending: directDetail.courtPending?.trim() || undefined
      };
    }

    if (/^[A-Z][A-Z0-9_-]{1,11}$/.test(direct)) {
      return { code: direct };
    }
  }

  const explicit = parseExplicitLabelCode(form.clientCase || "");
  const prefix = clientCodeFromCase(form.clientCase || "");
  const candidates = [...new Set([direct, explicit, prefix].filter(Boolean))] as string[];

  for (const candidate of candidates) {
    const detail = await findClientForTaskCode(accessToken, candidate);
    if (detail?.code?.trim()) {
      return {
        code: detail.code.trim().toUpperCase(),
        courtPending: detail.courtPending?.trim() || undefined
      };
    }
  }

  return { code: direct || "" };
}

export async function postEventLedgerCharge(
  accessToken: string,
  input: {
    form: EventFormInput;
    eventId: string;
    courtPending?: string;
    auditUser?: string;
  }
): Promise<{ posted: boolean; message?: string; clientCode?: string; notice?: ReturnType<typeof buildEventLedgerChargePostedNotice> }> {
  if (!input.form.postLedgerCharge) {
    return { posted: false };
  }

  const billing = await resolveEventLedgerBillingCode(accessToken, input.form);
  const clientCode = billing.code;
  if (!clientCode) {
    return {
      posted: false,
      message: "Select a billing client file before posting a ledger charge."
    };
  }

  const alignmentError = validateLedgerBillingClientAlignment({
    clientCase: input.form.clientCase || "",
    ledgerClientCode: clientCode,
    confirmed: input.form.ledgerBillingConfirmed === true
  });
  if (alignmentError) {
    return { posted: false, message: alignmentError };
  }

  const courtPending = input.courtPending?.trim() || billing.courtPending;
  const amount = resolveEventLedgerChargeAmount(input.form, courtPending);
  if (!amount || amount <= 0) {
    return { posted: false, message: "Ledger charge amount is missing." };
  }

  const category = resolveEventLedgerChargeCategory(input.form.category, input.form.categoryOther);
  const chargeDate =
    input.form.eventDate?.trim() || input.form.filingDeadline?.trim() || todayYmd();
  const description = buildEventLedgerChargeDescription(input.form, input.eventId);

  const chargePayload = {
    clientCode,
    type: "Charge" as const,
    date: chargeDate,
    category,
    description,
    charge: amount
  };

  const audit = input.auditUser ? { auditUser: input.auditUser } : undefined;

  try {
    let existingCharge:
      | ReturnType<typeof findEventLedgerCharge>
      | undefined;
    try {
      const ledger = await getClientLedger(accessToken, clientCode);
      existingCharge = findEventLedgerCharge(input.eventId, ledger.entries);
    } catch {
      existingCharge = undefined;
    }

    if (existingCharge) {
      await editLedgerEntry(accessToken, {
        clientCode,
        sheetRow: existingCharge.sheetRow,
        date: chargeDate,
        category,
        description,
        charge: amount
      });
    } else {
      await addLedgerEntry(accessToken, chargePayload, audit);
      try {
        await triggerTaskOnCharge(accessToken, chargePayload);
      } catch {
        /* best-effort ops alert */
      }
    }

    const timing = input.form.ledgerBillTiming || "client_billing";
    if (timing === "pay_now" && !existingCharge) {
      const method =
        normalizePaymentMethod(input.form.ledgerPaymentMethod || "") ||
        input.form.ledgerPaymentMethod?.trim() ||
        "Cash";
      const paymentPayload = {
        clientCode,
        type: "Payment" as const,
        date: chargeDate,
        category,
        description: `Payment — ${chargePayload.description}`,
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

    const notice = buildEventLedgerChargePostedNotice(
      { ...input.form, ledgerClientCode: clientCode },
      { amount, postedDate: chargeDate }
    );

    return {
      posted: true,
      clientCode,
      notice,
      message: formatPostedLedgerChargeNotice(notice)
    };
  } catch (error) {
    return {
      posted: false,
      clientCode,
      message:
        error instanceof Error
          ? error.message
          : "Could not post the ledger charge. Open the matter billing tab to add the charge manually."
    };
  }
}
