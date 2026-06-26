"use client";

import { AmountDisplay } from "@/components/AmountDisplay";

type Props = {
  receiptNumber: string;
  amount?: number;
  subtitle?: string;
  onDismiss?: () => void;
};

/** Brief success moment after an acknowledgment receipt is issued. */
export function ReceiptCeremony({ receiptNumber, amount, subtitle, onDismiss }: Props) {
  return (
    <section className="receipt-ceremony" role="status">
      <div className="receipt-ceremony__seal" aria-hidden>
        AR
      </div>
      <div className="receipt-ceremony__body">
        <p className="receipt-ceremony__eyebrow">Acknowledgment receipt issued</p>
        <p className="receipt-ceremony__number amount-serif">{receiptNumber}</p>
        {typeof amount === "number" && amount > 0.005 ? (
          <p className="receipt-ceremony__amount">
            <AmountDisplay value={amount} className="text-lg text-ink" />
          </p>
        ) : null}
        <p className="receipt-ceremony__text">
          {subtitle || "PDF saved to the client folder and logged in the document trail."}
        </p>
        {onDismiss ? (
          <button type="button" className="btn-secondary receipt-ceremony__dismiss" onClick={onDismiss}>
            Continue
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function parseReceiptNumberFromMessage(message: string, fallback = "Receipt issued"): string {
  const explicit = message.match(/\b(AR[-\s]?[\dA-Z-]+)\b/i)?.[1];
  if (explicit) return explicit.replace(/\s+/g, "");
  const numbered = message.match(/receipt\s+(?:no\.?\s*)?([A-Z0-9-]+)/i)?.[1];
  if (numbered) return numbered;
  return fallback;
}
