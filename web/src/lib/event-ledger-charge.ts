import { parseMoney, type LedgerEntry } from "@/lib/gl-config";
import type { CaseOption } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  isConsultationEventCategory,
  isEventLedgerBillableCategory,
  isHearingEventCategory,
  isMeetingEventCategory,
  isPleadingCategory,
  resolveEventCategory,
  splitEventCategory
} from "@/lib/office-tasks/event-form-utils";
import { resolveLitigationFeeSchedule, formatLitigationAcceptanceFee } from "@/lib/litigation-venue-fees";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

export const EVENT_LEDGER_CHARGE_MARKER = "EVENT_LEDGER_CHARGE";

export type EventLedgerBillTiming = "client_billing" | "pay_now";

export const EVENT_LEDGER_BILL_TIMING_LABELS: Record<EventLedgerBillTiming, string> = {
  client_billing: "Include in client billing",
  pay_now: "Client pays now"
};

export function eventLedgerBillingCopy(
  category: string,
  categoryOther?: string
): {
  sectionTitle: string;
  sectionHint: string;
  toggleLabel: string;
  toggleHint: string;
  amountLabel: string;
} {
  const resolved = resolveEventCategory(category, categoryOther);
  if (isHearingEventCategory(resolved)) {
    return {
      sectionTitle: "Bill client",
      sectionHint: "Appearance fee on the client billing file",
      toggleLabel: "Bill appearance fee",
      toggleHint: "Charge when you save — on SOA or paid now.",
      amountLabel: "Appearance fee (₱)"
    };
  }
  if (isConsultationEventCategory(resolved)) {
    return {
      sectionTitle: "Bill client",
      sectionHint: "Consultation fee — including unrelated work under the client code",
      toggleLabel: "Bill consultation fee",
      toggleHint: "Charge when you save — on SOA or paid now.",
      amountLabel: "Consultation fee (₱)"
    };
  }
  if (isMeetingEventCategory(resolved)) {
    return {
      sectionTitle: "Bill client",
      sectionHint: "Meeting or compromise — bill only when not covered by retainer",
      toggleLabel: "Bill this meeting",
      toggleHint: "Charge when you save — on SOA or paid now.",
      amountLabel: "Meeting fee (₱)"
    };
  }
  if (isPleadingCategory(resolved)) {
    return {
      sectionTitle: "Bill client",
      sectionHint: "Filing or deadline work on the client billing file",
      toggleLabel: "Bill this?",
      toggleHint: "Charge when you save — on SOA or paid now.",
      amountLabel: "Charge amount (₱)"
    };
  }
  return {
    sectionTitle: "Bill client",
    sectionHint: "Charge on the client billing file",
    toggleLabel: "Bill this?",
    toggleHint: "Charge when you save — on SOA or paid now.",
    amountLabel: "Charge amount (₱)"
  };
}

/** Master List client code used for ledger billing — not walk-ins or firm work. */
export function billingClientCodeFromCaseOption(
  option: Pick<CaseOption, "kind" | "clientCode"> | null | undefined
): string {
  if (!option || option.kind !== "master") return "";
  return option.clientCode?.trim().toUpperCase() || "";
}

export function shouldOfferEventLedgerCharge(input: {
  billingAccess?: boolean;
  category: string;
  categoryOther?: string;
  clientCode?: string;
  billingClientKind?: CaseOption["kind"] | null;
}): boolean {
  if (!input.billingAccess || !input.clientCode?.trim()) return false;
  if (input.billingClientKind && input.billingClientKind !== "master") return false;
  return isEventLedgerBillableCategory(input.category, input.categoryOther);
}

export function resolveEventLedgerChargeCategory(category: string, categoryOther?: string): string {
  const resolved = resolveEventCategory(category, categoryOther);
  if (isHearingEventCategory(resolved)) return "Appearance Fee";
  if (isPleadingCategory(resolved)) return "Filing Fee";
  if (isConsultationEventCategory(resolved)) return "Professional Fee";
  return "Professional Fee";
}

export type EventLedgerChargeLink = {
  sheetRow: number;
  date: string;
  amount: number;
  /** Alias used by some notice builders. */
  charge: number;
  category: string;
  description: string;
};

export function parseEventIdFromLedgerDescription(description: string): string | null {
  const match = String(description || "").match(
    new RegExp(`${EVENT_LEDGER_CHARGE_MARKER}:([A-Z0-9-]+)`, "i")
  );
  return match?.[1]?.toUpperCase() || null;
}

/** Find a ledger charge row posted from + Event (EVENT_LEDGER_CHARGE marker). */
export function findEventLedgerCharge(
  eventId: string,
  entries: Array<Pick<LedgerEntry, "sheetRow" | "date" | "charge" | "category" | "description" | "type">>
): EventLedgerChargeLink | undefined {
  const marker = `${EVENT_LEDGER_CHARGE_MARKER}:${eventId}`.toLowerCase();
  const match = entries.find(
    (entry) =>
      entry.type.toLowerCase() === "charge" &&
      entry.charge > 0 &&
      entry.description.toLowerCase().includes(marker)
  );
  if (!match) return undefined;
  return {
    sheetRow: match.sheetRow,
    date: match.date,
    amount: match.charge,
    charge: match.charge,
    category: match.category,
    description: match.description
  };
}

export function suggestedEventLedgerChargeDraft(
  item: Pick<OfficeItem, "category" | "details" | "venue" | "eventDate" | "date" | "filingDeadline">
): { category: string; description: string } {
  const split = splitEventCategory(item.category);
  const category = resolveEventLedgerChargeCategory(split.category, split.categoryOther);
  const resolved = resolveEventCategory(split.category, split.categoryOther);
  const date = item.eventDate?.trim() || item.date?.trim() || item.filingDeadline?.trim() || "";
  const venue = item.venue?.trim();
  const snippet = item.details?.trim() || (isHearingEventCategory(resolved) ? "Hearing" : "Filing");
  if (isHearingEventCategory(resolved)) {
    return {
      category,
      description: `Appearance fee — ${snippet}${venue ? ` · ${venue}` : ""}${date ? ` · ${date}` : ""}`
    };
  }
  const label =
    resolved === "Court Filing" ? "Court filing" : resolved === "Submission" ? "Submission" : "Deadline";
  return {
    category,
    description: `${label} — ${snippet}${venue ? ` · ${venue}` : ""}${date ? ` · ${date}` : ""}`
  };
}

export function defaultEventLedgerChargeAmount(input: {
  category: string;
  categoryOther?: string;
  venue?: string;
  courtPending?: string;
}): number {
  const category = resolveEventCategory(input.category, input.categoryOther);
  if (!isHearingEventCategory(category)) return 0;
  const schedule = resolveLitigationFeeSchedule(input.venue?.trim() || input.courtPending?.trim() || "");
  return schedule.appearanceFee;
}

export function formatDefaultEventLedgerChargeAmount(input: {
  category: string;
  categoryOther?: string;
  venue?: string;
  courtPending?: string;
}): string {
  const amount = defaultEventLedgerChargeAmount(input);
  return amount > 0 ? formatLitigationAcceptanceFee(amount) : "";
}

export function buildEventLedgerChargeDescription(
  form: Pick<EventFormInput, "category" | "categoryOther" | "details" | "venue" | "eventDate" | "filingDeadline">,
  eventId: string
): string {
  const category = resolveEventCategory(form.category, form.categoryOther);
  const date = form.eventDate?.trim() || form.filingDeadline?.trim() || "";
  if (isHearingEventCategory(category)) {
    const venue = form.venue?.trim();
    const snippet = form.details.trim() || "Hearing";
    return `Appearance fee — ${snippet}${venue ? ` · ${venue}` : ""}${date ? ` · ${date}` : ""} (${EVENT_LEDGER_CHARGE_MARKER}:${eventId})`;
  }

  if (isConsultationEventCategory(category)) {
    const snippet = form.details.trim() || "Consultation";
    return `Consultation fee — ${snippet}${date ? ` · ${date}` : ""} (${EVENT_LEDGER_CHARGE_MARKER}:${eventId})`;
  }

  const label = category === "Court Filing" ? "Court filing" : category === "Submission" ? "Submission" : "Deadline";
  const snippet = form.details.trim().slice(0, 100) || label;
  const venue = form.venue?.trim();
  return `${label} — ${snippet}${venue ? ` · ${venue}` : ""}${date ? ` · ${date}` : ""} (${EVENT_LEDGER_CHARGE_MARKER}:${eventId})`;
}

export function resolveEventLedgerChargeAmount(form: EventFormInput, courtPending?: string): number {
  const parsed = parseMoney(form.ledgerChargeAmount);
  if (parsed > 0) return parsed;
  return defaultEventLedgerChargeAmount({
    category: form.category,
    categoryOther: form.categoryOther,
    venue: form.venue,
    courtPending
  });
}

export function validateEventLedgerCharge(form: EventFormInput, courtPending?: string): string | null {
  if (!form.postLedgerCharge) return null;
  if (!form.ledgerClientCode?.trim()) {
    return "Select a billing client file before posting a ledger charge.";
  }
  const amount = resolveEventLedgerChargeAmount(form, courtPending);
  const category = resolveEventCategory(form.category, form.categoryOther);
  if (!amount || amount <= 0) {
    if (isHearingEventCategory(category)) {
      return "Enter an appearance fee amount or set the court / venue so the suggested fee can apply.";
    }
    if (isConsultationEventCategory(category)) {
      return "Enter the consultation fee amount.";
    }
    return "Enter the charge amount to post on the client ledger.";
  }
  const timing = form.ledgerBillTiming || "client_billing";
  if (timing === "pay_now" && !String(form.ledgerPaymentMethod || "").trim()) {
    return "Select how the client paid.";
  }
  return null;
}
