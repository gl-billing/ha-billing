/** Letter / correspondence task form helpers — client-safe. */

import { LETTER_CORRESPONDENCE_FORM_TYPE } from "@/lib/office-tasks/task-form-utils";
import {
  FIELD_DISPATCH_LOCATION_PRESETS,
  FIELD_DISPATCH_TRAVEL_HOURS
} from "@/lib/gl-config";

import type { LetterBillTiming } from "@/lib/office-tasks/letter-billing";

export type { LetterBillTiming } from "@/lib/office-tasks/letter-billing";
export { LETTER_BILL_TIMING_LABELS } from "@/lib/office-tasks/letter-billing";

export const LETTER_TYPE_OPTIONS = ["Demand letter", "Reply", "Notice", "Other"] as const;
export type LetterTypeOption = (typeof LETTER_TYPE_OPTIONS)[number];

export type LetterCorrespondenceInput = {
  letterType: string;
  letterTypeOther?: string;
  recipient: string;
  serveViaLiaison: boolean;
  serveByDate?: string;
  serveAddress?: string;
  serveLocation?: string;
  advanceGiven?: number;
  serviceFee?: number;
  servicePaid?: boolean;
  billThis?: boolean;
  billAmount?: number;
  billTiming?: LetterBillTiming;
  billPaymentMethod?: string;
  /** Staff confirmed billing file matches this case after a mismatch warning. */
  billingConfirmed?: boolean;
};

export function resolvedLetterTypeLabel(letterType: string, letterTypeOther?: string): string {
  const type = String(letterType || "").trim();
  if (type === "Other") {
    const other = String(letterTypeOther || "").trim();
    return other || "letter";
  }
  return type || "letter";
}

export function isLetterCorrespondenceTaskType(taskType: string): boolean {
  return String(taskType || "").trim() === LETTER_CORRESPONDENCE_FORM_TYPE;
}

export function isOutsideDavaoFieldDispatch(location: string): boolean {
  const key = String(location || "").trim() || "Davao City";
  const hours = FIELD_DISPATCH_TRAVEL_HOURS[key] ?? FIELD_DISPATCH_TRAVEL_HOURS.Other;
  return hours > 0;
}

export function fieldDispatchPresetForLocation(location: string): {
  defaultAdvance: number;
  serviceFee: number;
} {
  const key = String(location || "").trim() || "Davao City";
  return (
    FIELD_DISPATCH_LOCATION_PRESETS[key] || {
      defaultAdvance: FIELD_DISPATCH_LOCATION_PRESETS.Other?.defaultAdvance ?? 0,
      serviceFee: FIELD_DISPATCH_LOCATION_PRESETS.Other?.serviceFee ?? 0
    }
  );
}

export function formatLetterDraftDescription(
  letterType: string,
  recipient: string,
  letterTypeOther?: string
): string {
  const kind = resolvedLetterTypeLabel(letterType, letterTypeOther);
  const who = String(recipient || "").trim() || "recipient";
  return `Draft ${kind} — ${who}`;
}

export function formatLetterServeDescription(
  letterType: string,
  recipient: string,
  letterTypeOther?: string
): string {
  const kind = resolvedLetterTypeLabel(letterType, letterTypeOther);
  const who = String(recipient || "").trim() || "recipient";
  return `Serve ${kind} — ${who}`;
}

export function validateLetterCorrespondenceInput(input: LetterCorrespondenceInput): string | null {
  if (!input.recipient?.trim()) return "Enter the letter recipient.";
  if (input.letterType === "Other" && !String(input.letterTypeOther || "").trim()) {
    return "Specify the letter type when Other is selected.";
  }
  if (!input.serveViaLiaison) return null;
  if (!input.serveByDate?.trim()) return "Enter the serve-by date for the liaison task.";
  if (!input.serveAddress?.trim()) return "Enter where to serve (address / recipient).";
  if (!input.serveLocation?.trim()) return "Select the field dispatch area.";
  if (input.billThis) {
    const amount = Number(input.billAmount) || 0;
    if (amount <= 0) return "Enter the billing amount.";
    if (input.billTiming === "pay_now" && !String(input.billPaymentMethod || "").trim()) {
      return "Select how the client paid.";
    }
  }
  return null;
}
