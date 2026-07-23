/** Letter correspondence billing markers — client-safe. */

export type LetterBillTiming = "client_billing" | "pay_now";

export const LETTER_BILL_TIMING_LABELS: Record<LetterBillTiming, string> = {
  client_billing: "Include in client billing",
  pay_now: "Client pays now"
};

const LETTER_BILL_RE = /LETTER_BILL:(client_billing|pay_now):(\d+(?:\.\d+)?)/i;

export function letterBillingMarker(timing: LetterBillTiming, amount: number): string {
  const value = Math.max(0, Number(amount) || 0);
  return `LETTER_BILL:${timing}:${value}`;
}

export function parseLetterBillingMarker(
  remarks: string
): { timing: LetterBillTiming; amount: number } | null {
  const match = String(remarks || "").match(LETTER_BILL_RE);
  if (!match) return null;
  return {
    timing: match[1].toLowerCase() as LetterBillTiming,
    amount: Number(match[2]) || 0
  };
}
